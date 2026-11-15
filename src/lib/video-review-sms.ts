// Pure rules for the text a merchant gets after an admin reviews their video.
import { REJECT_REASONS, type RejectReason } from '@/lib/reel-video';

/** Kenyan mobile in the 2547XXXXXXXX / 2541XXXXXXXX form the SMS provider expects, or null. */
export function kenyanMsisdn(phone: string | null | undefined): string | null {
  let d = (phone ?? '').replace(/\D/g, '');
  if (d.length === 10 && /^0[17]/.test(d)) d = `254${d.slice(1)}`;
  else if (d.length === 9 && /^[17]/.test(d)) d = `254${d}`;
  return /^254[17]\d{8}$/.test(d) ? d : null;
}

export type VideoReviewSms =
  | { decision: 'live' | 'rejected'; kind: 'intro' | 'product'; shopName: string; productName?: string | null; reason?: string | null }
  | { decision: 'bulk'; shopName: string; count: number };

export function buildVideoReviewSms(input: VideoReviewSms): string {
  if (input.decision === 'bulk') {
    const n = input.count;
    return `Beez: ${n} video${n === 1 ? ' from ' + input.shopName + ' is' : 's from ' + input.shopName + ' are'} now live. Customers can watch ${n === 1 ? 'it' : 'them'} in the Beez reel.`;
  }
  const what = input.kind === 'intro' ? 'Your shop intro video' : `Your video for ${input.productName?.trim() || 'your product'}`;
  if (input.decision === 'live') return `Beez: ${what} is now live. Customers can watch it in the Beez reel.`;
  const fix = input.reason && input.reason in REJECT_REASONS
    ? REJECT_REASONS[input.reason as RejectReason].fix
    : 'Please record a new one.';
  return `Beez: ${what} was not approved. ${fix} Open Videos in your Beez dashboard to try again.`;
}
