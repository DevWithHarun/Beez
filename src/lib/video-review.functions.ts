// Admin video review on the server, so the merchant gets a text once a video is
// approved (live) or rejected. The admin check lives in the database functions.
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { REJECT_REASON_KEYS } from '@/lib/reel-video';
import { buildVideoReviewSms, kenyanMsisdn, type VideoReviewSms } from '@/lib/video-review-sms';

const reviewSchema = z
  .object({
    kind: z.enum(['intro', 'product']),
    target: z.string().uuid(),
    decision: z.enum(['live', 'rejected']),
    reason: z.enum(REJECT_REASON_KEYS as [string, ...string[]]).optional(),
  })
  .refine((v) => v.decision === 'live' || !!v.reason, { message: 'Pick a reason so the merchant knows what to fix' });

const missing = (m: string) => /does not exist|could not find the function|schema cache/i.test(m);

/** Texts the shop owner. Never fails the review: a messaging problem is only logged. */
async function textMerchant(merchantId: string, build: (shopName: string) => VideoReviewSms): Promise<boolean> {
  try {
    const { sendSms, smsConfigured } = await import('@/lib/sms.server');
    if (!smsConfigured()) return false;
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: shop } = await supabaseAdmin.from('merchants').select('name, phone').eq('id', merchantId).maybeSingle();
    const phone = kenyanMsisdn(shop?.phone);
    if (!shop || !phone) return false;
    const result = await sendSms(phone, buildVideoReviewSms(build(shop.name)));
    if (!result.ok) console.error('Video review SMS failed', result.error);
    return result.ok;
  } catch (e) {
    console.error('Video review SMS failed', e instanceof Error ? e.message : e);
    return false;
  }
}

export const reviewVideoAndNotify = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(reviewSchema)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc('admin_review_video', {
      _kind: data.kind, _target: data.target, _decision: data.decision, ...(data.reason ? { _reason: data.reason } : {}),
    });
    if (error) throw new Error(missing(error.message) ? 'Video review is not switched on yet on the backend.' : error.message);

    let merchantId = data.target;
    let productName: string | null = null;
    if (data.kind === 'product') {
      const { data: product } = await context.supabase.from('products').select('name, merchant_id').eq('id', data.target).maybeSingle();
      if (!product?.merchant_id) return { texted: false };
      merchantId = product.merchant_id;
      productName = product.name;
    }
    const texted = await textMerchant(merchantId, (shopName) => ({
      decision: data.decision, kind: data.kind, shopName, productName, reason: data.reason ?? null,
    }));
    return { texted };
  });

export const approveShopVideosAndNotify = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ merchantId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: count, error } = await context.supabase.rpc('admin_approve_shop_videos', { _merchant_id: data.merchantId });
    if (error) throw new Error(missing(error.message) ? 'Video review is not switched on yet on the backend.' : error.message);
    const n = Number(count ?? 0);
    const texted = n > 0 ? await textMerchant(data.merchantId, (shopName) => ({ decision: 'bulk', shopName, count: n })) : false;
    return { count: n, texted };
  });
