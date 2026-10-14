package com.beez.payment.spi;

import java.math.BigDecimal;

public interface PaymentProvider {
  PaymentRequest initiate(PaymentCommand command);

  PaymentVerification verify(String checkoutRequestId);

  record PaymentCommand(
      String reference, BigDecimal amount, String currency, String phoneNumber, String callbackUrl) {}

  record PaymentRequest(String merchantRequestId, String checkoutRequestId) {}

  record PaymentVerification(int resultCode, String resultDescription) {
    public boolean succeeded() {
      return resultCode == 0;
    }
  }
}
