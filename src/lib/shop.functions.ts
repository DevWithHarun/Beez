import { z } from 'zod';
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { DELIVERY_FEE, buildItemsSummary, coordsFor, singleShopError } from '@/lib/marketplace';

const schema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive().max(99),
  })).min(1).max(50),
  delivery: z.boolean(),
  address: z.string().trim().min(1).max(300),
  paymentMethod: z.enum(['M-Pesa', 'Cash on Delivery']),
  customerName: z.string().trim().min(2, 'Add your name.').max(120),
  customerPhone: z.string().trim().regex(/^\+254[17]\d{8}$/, 'Add a valid Kenyan phone number.'),
  instructions: z.string().trim().max(300).default(''),
});

type ProductRow = { id: string; name: string; price_kes: number; stock: number; merchant_id: string | null; merchants: { name: string; area: string; is_open?: boolean; active?: boolean } | null };

// Creates a real order from the customer's cart. Prices always come from the
// saved products, never from the browser.
export const createCustomerOrder = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(schema)
  .handler(async ({ data, context }) => {
    const { data: products, error } = await context.supabase
      .from('products')
      .select('id, name, price_kes, stock, merchant_id, merchants(*)')
      .in('id', data.items.map(i => i.productId))
      .eq('active', true);
    if (error) throw new Error('Your order could not be placed. Please try again.');
    if (!products || products.length !== data.items.length) {
      throw new Error('Some items in your cart are no longer available. Please review your cart.');
    }

    const rows = products as unknown as ProductRow[];
    // One shop per order: the rider collects everything from a single stop.
    const mixedShops = singleShopError(rows.map(p => p.merchant_id));
    if (mixedShops) throw new Error(mixedShops);
    const closed = rows.find(p => p.merchant_id && (!p.merchants || p.merchants.is_open === false || p.merchants.active === false));
    if (closed) throw new Error(`${closed.merchants?.name ?? 'This shop'} is closed right now. Please try again when it opens.`);
    const items = data.items.map(i => {
      const product = rows.find(p => p.id === i.productId)!;
      return { product, quantity: i.quantity };
    });
    const unavailable = items.find(i => i.product.stock <= 0 || i.quantity > i.product.stock);
    if (unavailable) {
      throw new Error(unavailable.product.stock <= 0
        ? `${unavailable.product.name} is sold out. Please update your cart.`
        : `Only ${unavailable.product.stock} ${unavailable.product.name} available. Please update your cart.`);
    }

    const subtotalKes = items.reduce((sum, i) => sum + i.product.price_kes * i.quantity, 0);
    const deliveryFeeKes = data.delivery ? DELIVERY_FEE : 0;
    const totalKes = subtotalKes + deliveryFeeKes;
    const summary = buildItemsSummary(items.map(i => ({ name: i.product.name, quantity: i.quantity })));

    const primary = items[0]!.product;
    const merchant = primary.merchants ?? { name: 'Local merchant', area: 'Mombasa' };
    const pickup = coordsFor(merchant.area || 'Mombasa');
    const drop = coordsFor(data.address);

    const insert = {
      merchant_name: merchant.name,
      pickup_area: merchant.area || 'Mombasa',
      customer_area: data.address,
      items_summary: summary,
      total_kes: totalKes,
      // Shop orders wait for the merchant to accept (2-minute window); others go straight to preparing.
      status: primary.merchant_id ? 'Pending' : 'Preparing',
      pickup_lat: pickup.lat,
      pickup_lng: pickup.lng,
      drop_lat: drop.lat,
      drop_lng: drop.lng,
      customer_id: context.userId,
      customer_name: data.customerName,
      customer_phone: data.customerPhone,
      payment_method: data.paymentMethod,
      // Only Safaricom's confirmation marks an order paid (see mpesa.functions).
      payment_status: 'Unpaid',
      delivery_fee_kes: deliveryFeeKes,
      merchant_id: primary.merchant_id,
      delivery_instructions: data.delivery && data.instructions ? data.instructions : null,
    };

    // Shoppers can't save orders directly; the server saves them after the checks above.
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    // Order ids are BEE + 6 digits; retry if the random id collides.
    for (let attempt = 0; attempt < 3; attempt++) {
      const id = `BEE${Math.floor(100000 + Math.random() * 900000)}`;
      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .insert({ id, ...insert })
        .select('id, total_kes, delivery_fee_kes')
        .single();
      if (!orderError) {
        const { error: itemsError } = await supabaseAdmin.from('order_items').insert(
          items.map(i => ({
            order_id: order!.id,
            product_id: i.product.id,
            product_name: i.product.name,
            quantity: i.quantity,
            unit_price_kes: i.product.price_kes,
          })),
        );
        if (itemsError) {
          await supabaseAdmin.from('orders').delete().eq('id', order!.id);
          throw new Error('Your order could not be placed. Please try again.');
        }
        return { id: order!.id, totalKes: order!.total_kes, deliveryFeeKes: order!.delivery_fee_kes };
      }
      if (orderError.code !== '23505') throw new Error('Your order could not be placed. Please try again.');
    }
    throw new Error('Your order could not be placed. Please try again.');
  });
