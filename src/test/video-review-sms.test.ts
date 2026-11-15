import { describe, expect, it } from 'vitest';
import { buildVideoReviewSms, kenyanMsisdn } from '@/lib/video-review-sms';

describe('merchant video review text', () => {
  it('tells the merchant their video is live once approved', () => {
    expect(buildVideoReviewSms({ decision: 'live', kind: 'product', shopName: 'PayLoom', productName: 'Tomatoes' }))
      .toBe('Beez: Your video for Tomatoes is now live. Customers can watch it in the Beez reel.');
    expect(buildVideoReviewSms({ decision: 'live', kind: 'intro', shopName: 'PayLoom' }))
      .toBe('Beez: Your shop intro video is now live. Customers can watch it in the Beez reel.');
  });
  it('includes the fix when a video is rejected', () => {
    expect(buildVideoReviewSms({ decision: 'rejected', kind: 'intro', shopName: 'PayLoom', reason: 'too_dark' }))
      .toContain('Too dark. Record somewhere brighter.');
  });
  it('sends one text for "approve all from this shop"', () => {
    expect(buildVideoReviewSms({ decision: 'bulk', shopName: 'PayLoom', count: 3 }))
      .toBe('Beez: 3 videos from PayLoom are now live. Customers can watch them in the Beez reel.');
  });
  it('only texts valid Kenyan mobile numbers', () => {
    expect(kenyanMsisdn('0712 345 678')).toBe('254712345678');
    expect(kenyanMsisdn('+254112345678')).toBe('254112345678');
    expect(kenyanMsisdn('020 123 4567')).toBeNull();
    expect(kenyanMsisdn(null)).toBeNull();
  });
});
