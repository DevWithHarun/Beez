package com.beez.payment.service;

import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.beez.payment.api.PaymentCallback;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import com.beez.wallet.service.MerchantWalletService;

class PaymentStoreTest {
  private static final UUID PAYMENT_ID = UUID.randomUUID();
  private static final UUID BASKET_ID = UUID.randomUUID();
  private static final UUID CALLBACK_ID = UUID.randomUUID();
  private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
  private final MerchantWalletService wallet = mock(MerchantWalletService.class);
  private final PaymentStore store = new PaymentStore(jdbc, wallet);

  @Test
  void putsVerifiedPaymentIntoReviewWhenBasketCannotBePaid() {
    var attempt =
        new PaymentStore.PaymentAttempt(
            PAYMENT_ID,
            BASKET_ID,
            "BZ-001001",
            "+254712345678",
            245,
            "merchant-123",
            "ws_CO_123",
            "PENDING",
            Instant.now(),
            false);
    when(jdbc.queryForObject(
            contains("SELECT status FROM baskets"), eq(String.class), eq(BASKET_ID)))
        .thenReturn("CANCELLED");
    when(jdbc.queryForObject(
            contains("SELECT status FROM payments"), eq(String.class), eq(PAYMENT_ID)))
        .thenReturn("PENDING");

    store.settle(
        CALLBACK_ID,
        attempt,
        new PaymentCallback(
            "merchant-123", "ws_CO_123", 0, "Verified success", 245, "254712345678", "QAB12CDEF3"),
        true);

    verify(jdbc).update(contains("UPDATE payment_callback_inbox"), eq(CALLBACK_ID));
    verify(jdbc).update(contains("UPDATE payments SET status = 'REVIEW'"), eq(PAYMENT_ID));
    verify(jdbc, never()).update(contains("SET status = ?, result_code = ?"), eq("SUCCEEDED"));
  }
}
