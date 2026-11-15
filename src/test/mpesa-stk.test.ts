import { describe, expect, it } from 'vitest';
import { darajaTimestamp, maskPhone, parseStkCallback, stkPassword, stkQueryResult, stkStatusFor, toMsisdn } from '@/lib/mpesa-stk';

describe('daraja request details', () => {
  it('stamps requests in Nairobi time', () => {
    expect(darajaTimestamp(new Date('2026-11-14T21:46:05Z'))).toBe('20261115004605');
  });
  it('builds the password from shortcode, passkey and timestamp', () => {
    expect(atob(stkPassword('174379', 'key', '20261115004605'))).toBe('174379key20261115004605');
  });
  it('sends phones as 2547… / 2541…', () => {
    expect(toMsisdn('+254712345678')).toBe('254712345678');
    expect(toMsisdn('0112 345 678')).toBe('254112345678');
    expect(toMsisdn('0212345678')).toBeNull();
    expect(maskPhone('254712345678')).toBe('0712 *** 678');
  });
});

describe('payment outcome', () => {
  it('only result code 0 counts as paid', () => {
    expect(stkStatusFor(0)).toBe('paid');
    expect(stkStatusFor(1032)).toBe('cancelled');
    expect(stkStatusFor(1037)).toBe('timeout');
    expect(stkStatusFor(1)).toBe('failed');
    expect(stkStatusFor(2001)).toBe('failed');
  });
  it('reads the receipt and amount from a successful callback', () => {
    const cb = parseStkCallback({ Body: { stkCallback: {
      MerchantRequestID: 'm1', CheckoutRequestID: 'ws_CO_1', ResultCode: 0, ResultDesc: 'Processed',
      CallbackMetadata: { Item: [{ Name: 'Amount', Value: 330 }, { Name: 'MpesaReceiptNumber', Value: 'QKX1AB2CD3' }, { Name: 'PhoneNumber', Value: 254712345678 }] },
    } } });
    expect(cb).toEqual({ checkoutRequestId: 'ws_CO_1', resultCode: 0, resultDesc: 'Processed', receipt: 'QKX1AB2CD3', amount: 330 });
  });
  it('rejects bodies that are not STK callbacks', () => {
    expect(parseStkCallback({ Result: {} })).toBeNull();
    expect(parseStkCallback({ Body: { stkCallback: { CheckoutRequestID: 'x', ResultCode: 'abc' } } })).toBeNull();
  });
  it('treats "still processing" query answers as not final', () => {
    expect(stkQueryResult({ errorCode: '500.001.1001' })).toBeNull();
    expect(stkQueryResult({ ResultCode: '1032', ResultDesc: 'Cancelled' })).toEqual({ resultCode: 1032, resultDesc: 'Cancelled' });
  });
});
