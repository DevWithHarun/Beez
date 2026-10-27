import { z } from 'zod';
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { DELIVERY_FEE, buildItemsSummary, coordsFor } from '@/lib/marketplace';

const schema = z.object({
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive().max(99),
  })).min(1).max(50),
  delivery: z.boolean(),
  address: z.string().trim().min(1).max(300),
  paymentMethod: z.enum(['M-Pesa', 'Cash on Delivery', 'Bank Transfer']),
  customerName: z.string().trim().max(120).default(''),
  customerPhone: z.string().trim().max(30).default(''),
});

type ProductRow = { id: string; name: string; price_kes: number; merchant_id: string | null; merchants: { name: string; area: string } | null };

// Creates a real order from the customer's cart. Prices always come from the
// saved products, never from the browser.
export const createCustomerOrder = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(schema)
  .handler(async ({ data, context }) => {
    const { data: products, error } = await context.supabase
      .from('products')
      .select('id, name, price_kes, merchant_id, merchants(name, area)')
      .in('id', data.items.map(i => i.productId))
      .eq('active', true);
    if (error) throw new Error('Your order could not be placed. Please try again.');
    if (!products || products.length !== data.items.length) {
      throw new Error('Some items in your cart are no longer available. Please review your cart.');
    }

    const rows = products as unknown as ProductRow[];
    const items = data.items.map(i => {
      const product = rows.find(p => p.id === i.productId)!;
      return { product, quantity: i.quantity };
    });

    const subtotalKes = items.reduce((sum, i) => sum + i.product.price_kes * i.quantity, 0);
    const deliveryFeeKes = data.delivery ? DELIVERY_FEE : 0;
    const totalKes = subtotalKes + deliveryFeeKes;
    const summary = buildItemsSummary(items.map(i => ({ name: i.product.name, quantity: i.quantity })));

    const primary = items[0]!.product;
    const merchant = primary.merchants ?? { name: 'Local merchant', area: 'Mombasa' };
    const pickup = coordsFor(merchant.area || 'Mombasa');
    const drop = coordsFor(data.address);
    const paidNow = data.paymentMethod !== 'Cash on Delivery';

    const insert = {
      merchant_name: merchant.name,
      pickup_area: merchant.area || 'Mombasa',
      customer_area: data.address,
      items_summary: summary,
      total_kes: totalKes,
      status: 'Preparing',
      pickup_lat: pickup.lat,
      pickup_lng: pickup.lng,
      drop_lat: drop.lat,
      drop_lng: drop.lng,
      customer_id: context.userId,
      customer_name: data.customerName,
      customer_phone: data.customerPhone,
      payment_method: data.paymentMethod,
      payment_status: paidNow ? 'Paid' : 'Unpaid',
      delivery_fee_kes: deliveryFeeKes,
      merchant_id: primary.merchant_id,
    };

    // Order ids are BEE + 6 digits; retry if the random id collides.
    for (let attempt = 0; attempt < 3; attempt++) {
      const id = `BEE${Math.floor(100000 + Math.random() * 900000)}`;
      const { data: order, error: orderError } = await context.supabase
        .from('orders')
        .insert({ id, ...insert })
        .select('id, total_kes, delivery_fee_kes')
        .single();
      if (!orderError) {
        const { error: itemsError } = await context.supabase.from('order_items').insert(
          items.map(i => ({
            order_id: order!.id,
            product_id: i.product.id,
            product_name: i.product.name,
            quantity: i.quantity,
            unit_price_kes: i.product.price_kes,
          })),
        );
        if (itemsError) throw new Error('Your order could not be placed. Please try again.');
        return { id: order!.id, totalKes: order!.total_kes, deliveryFeeKes: order!.delivery_fee_kes };
      }
      if (orderError.code !== '23505') throw new Error('Your order could not be placed. Please try again.');
    }
    throw new Error('Your order could not be placed. Please try again.');
  });
