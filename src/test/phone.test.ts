import { describe, it, expect } from 'vitest';
import { toE164, friendlyPhoneError } from '@/lib/phone';

describe('toE164', () => {
  it('converts a local 07xx number to Kenyan E.164', () => {
    expect(toE164('0712 345 678')).toBe('+254712345678');
  });
  it('keeps an already-prefixed 254 number intact', () => {
    expect(toE164('254712345678')).toBe('+254712345678');
  });
  it('accepts a bare number without leading zero', () => {
    expect(toE164('712345678')).toBe('+254712345678');
  });
});

describe('friendlyPhoneError', () => {
  it('explains a disabled phone provider', () => {
    expect(friendlyPhoneError('Unsupported phone provider')).toBe(
      'No code was sent. Phone sign-in is disabled for this Supabase project. Enable the Phone provider and configure an SMS provider in Supabase Authentication settings.',
    );
  });
  it('explains a failed SMS send', () => {
    expect(friendlyPhoneError('SMS could not be sent')).toBe(
      "We couldn't text your code right now. Please check the number and try again in a moment.",
    );
  });
  it('explains rate limiting', () => {
    expect(friendlyPhoneError('Request rate limit reached')).toBe(
      'Too many attempts. Please wait a minute and request a new code.',
    );
  });
  it('explains a wrong or expired code', () => {
    expect(friendlyPhoneError('Invalid otp')).toBe(
      "That code isn't right. Check the text message and try again.",
    );
    expect(friendlyPhoneError('otp_expired')).toBe('That code has expired. Please request a new one.');
  });
  it('passes unknown messages through untouched', () => {
    expect(friendlyPhoneError('Something unusual')).toBe('Something unusual');
  });
});
