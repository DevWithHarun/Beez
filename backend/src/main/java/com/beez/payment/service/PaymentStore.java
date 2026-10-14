package com.beez.payment.service;

import com.beez.basket.api.BasketException;
import com.beez.dispatch.service.DeliveryCodeService;
import com.beez.payment.api.PaymentCallback;
import com.beez.wallet.service.MerchantWalletService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class PaymentStore {
  private final JdbcTemplate jdbc;
  private final MerchantWalletService wallet;

  public PaymentStore(JdbcTemplate jdbc, MerchantWalletService wallet) {
    this.jdbc = jdbc;
    this.wallet = wallet;
  }

  @Transactional
  public PaymentAttempt prepare(String trackingToken, byte[] deliveryCodeHash) {
    byte[] trackingHash = sha256(trackingToken);
    Basket basket =
        jdbc.query(
                """
                SELECT id, basket_no, customer_phone, total_kes, status, expires_at
                  FROM baskets
                 WHERE tracking_hash = ?
                 FOR UPDATE
                """,
                (rs, row) ->
                    new Basket(
                        rs.getObject("id", UUID.class),
                        rs.getString("basket_no"),
                        rs.getString("customer_phone"),
                        rs.getInt("total_kes"),
                        rs.getString("status"),
                        rs.getTimestamp("expires_at").toInstant()),
                trackingHash)
            .stream()
            .findFirst()
            .orElseThrow(
                () ->
                    new BasketException(
                        "basket_not_found",
                        "This tracking link is invalid or has expired.",
                        HttpStatus.NOT_FOUND));

    if (!"PENDING_PAYMENT".equals(basket.status()) || !basket.expiresAt().isAfter(Instant.now())) {
      throw new BasketException(
          "basket_not_payable",
          "This basket can no longer be paid. Please create a new basket.",
          HttpStatus.CONFLICT);
    }
    if (basket.totalKes() <= 0) {
      throw new BasketException(
          "basket_not_payable",
          "This basket total cannot be processed as an M-Pesa payment.",
          HttpStatus.UNPROCESSABLE_ENTITY);
    }

    List<PaymentAttempt> previous =
        jdbc.query(
            """
            SELECT id, merchant_request_id, checkout_request_id, status, created_at
              FROM payments
             WHERE basket_id = ?
             ORDER BY created_at DESC
             LIMIT 1
            """,
            (rs, row) ->
                new PaymentAttempt(
                    rs.getObject("id", UUID.class),
                    basket.id(),
                    basket.basketNo(),
                    basket.phone(),
                    basket.totalKes(),
                    rs.getString("merchant_request_id"),
                    rs.getString("checkout_request_id"),
                    rs.getString("status"),
                    rs.getTimestamp("created_at").toInstant(),
                    false),
            basket.id());
    if (!previous.isEmpty()) {
      PaymentAttempt latest = previous.get(0);
      if ("PENDING".equals(latest.status()) || "REVIEW".equals(latest.status())) {
        return latest;
      }
      if (!latest.createdAt().isBefore(Instant.now().minusSeconds(60))) return latest;
      if ("INITIATED".equals(latest.status())) {
        jdbc.update("UPDATE payments SET status = 'REVIEW' WHERE id = ?", latest.id());
        return new PaymentAttempt(
            latest.id(),
            latest.basketId(),
            latest.basketNo(),
            latest.phone(),
            latest.amountKes(),
            latest.merchantRequestId(),
            latest.checkoutRequestId(),
            "REVIEW",
            latest.createdAt(),
            false);
      }
    }

    UUID paymentId = UUID.randomUUID();
    jdbc.update(
        """
        INSERT INTO payments (id, basket_id, amount_kes, phone, status)
        VALUES (?, ?, ?, ?, 'INITIATED')
        """,
        paymentId,
        basket.id(),
        basket.totalKes(),
        basket.phone());
    jdbc.update(
        """
        INSERT INTO delivery_code_secrets (basket_id, code_hash)
        VALUES (?, ?)
        ON CONFLICT (basket_id) DO UPDATE SET code_hash = EXCLUDED.code_hash, created_at = now()
        """,
        basket.id(),
        deliveryCodeHash);
    return new PaymentAttempt(
        paymentId,
        basket.id(),
        basket.basketNo(),
        basket.phone(),
        basket.totalKes(),
        null,
        null,
        "INITIATED",
        Instant.now(),
        true);
  }

  @Transactional
  public void markPending(UUID paymentId, String merchantRequestId, String checkoutRequestId) {
    int updated = jdbc.update(
        """
        UPDATE payments
           SET merchant_request_id = ?, checkout_request_id = ?, status = 'PENDING'
         WHERE id = ? AND status = 'INITIATED'
        """,
        merchantRequestId,
        checkoutRequestId,
        paymentId);
    if (updated != 1) {
      throw new PaymentProviderException("Payment initiation could not be recorded safely.");
    }
  }

  @Transactional
  public void markInitiationFailed(UUID paymentId) {
    jdbc.update(
        "UPDATE payments SET status = 'FAILED', completed_at = now() WHERE id = ? AND status = 'INITIATED'",
        paymentId);
  }

  @Transactional
  public void markInitiationUncertain(UUID paymentId) {
    jdbc.update(
        "UPDATE payments SET status = 'REVIEW', completed_at = now() WHERE id = ? AND status = 'INITIATED'",
        paymentId);
  }

  @Transactional
  public void receiveCallback(String checkoutRequestId, String payload) {
    jdbc.update(
        """
        INSERT INTO payment_callback_inbox (checkout_request_id, payload)
        VALUES (?, ?::jsonb)
        ON CONFLICT (checkout_request_id) DO NOTHING
        """,
        checkoutRequestId,
        payload);
  }

  @Transactional
  public List<CallbackEnvelope> pendingCallbacks() {
    jdbc.update(
        """
        UPDATE payment_callback_inbox
           SET status = 'RETRY', claimed_at = NULL
         WHERE status = 'PROCESSING' AND claimed_at < now() - interval '1 minute'
        """);
    return jdbc.query(
        """
        WITH candidates AS (
            SELECT id
              FROM payment_callback_inbox
             WHERE status IN ('RECEIVED', 'RETRY')
             ORDER BY received_at
             FOR UPDATE SKIP LOCKED
             LIMIT 20
        )
        UPDATE payment_callback_inbox inbox
           SET status = 'PROCESSING', claimed_at = now()
          FROM candidates
         WHERE inbox.id = candidates.id
        RETURNING inbox.id, inbox.checkout_request_id, inbox.payload::text AS payload, inbox.attempts
        """,
        (rs, row) ->
            new CallbackEnvelope(
                rs.getObject("id", UUID.class),
                rs.getString("checkout_request_id"),
                rs.getString("payload"),
                rs.getInt("attempts")));
  }

  @Transactional(readOnly = true)
  public PaymentAttempt findForCallback(String checkoutRequestId) {
    return jdbc.query(
            """
            SELECT p.id, p.basket_id, b.basket_no, p.phone, p.amount_kes,
                   p.merchant_request_id, p.checkout_request_id, p.status, p.created_at
              FROM payments p JOIN baskets b ON b.id = p.basket_id
             WHERE p.checkout_request_id = ?
            """,
            (rs, row) ->
                new PaymentAttempt(
                    rs.getObject("id", UUID.class),
                    rs.getObject("basket_id", UUID.class),
                    rs.getString("basket_no"),
                    rs.getString("phone"),
                    rs.getInt("amount_kes"),
                    rs.getString("merchant_request_id"),
                    rs.getString("checkout_request_id"),
                    rs.getString("status"),
                    rs.getTimestamp("created_at").toInstant(),
                    false),
            checkoutRequestId)
        .stream()
        .findFirst()
        .orElse(null);
  }

  @Transactional
  public void retryCallback(UUID callbackId, int attempts) {
    String status = attempts + 1 >= 12 ? "REVIEW" : "RETRY";
    jdbc.update(
        """
        UPDATE payment_callback_inbox
           SET attempts = attempts + 1, status = ?, claimed_at = NULL
         WHERE id = ? AND status = 'PROCESSING'
        """,
        status,
        callbackId);
    if ("REVIEW".equals(status)) {
      jdbc.update(
          """
          UPDATE payments SET status = 'REVIEW'
           WHERE checkout_request_id =
               (SELECT checkout_request_id FROM payment_callback_inbox WHERE id = ?)
             AND status IN ('INITIATED', 'PENDING')
          """,
          callbackId);
    }
  }

  @Transactional
  public void markReview(UUID callbackId, UUID paymentId) {
    jdbc.update(
        """
        UPDATE payment_callback_inbox
           SET status = 'REVIEW', attempts = attempts + 1, claimed_at = NULL
         WHERE id = ? AND status = 'PROCESSING'
        """,
        callbackId);
    if (paymentId != null) {
      jdbc.update(
          "UPDATE payments SET status = 'REVIEW' WHERE id = ? AND status IN ('INITIATED', 'PENDING')",
          paymentId);
    }
  }

  @Transactional
  public void settle(UUID callbackId, PaymentAttempt attempt, PaymentCallback callback, boolean paid) {
    String basketStatus =
        jdbc.queryForObject(
            "SELECT status FROM baskets WHERE id = ? FOR UPDATE", String.class, attempt.basketId());
    String paymentStatus =
        jdbc.queryForObject(
            "SELECT status FROM payments WHERE id = ? FOR UPDATE", String.class, attempt.id());
    if (paid) {
      if ("SUCCEEDED".equals(paymentStatus)) {
        if ("PAID".equals(basketStatus)) {
          markCallbackProcessed(callbackId);
        } else {
          markReview(callbackId, attempt.id());
        }
        return;
      }
      if (!"PENDING_PAYMENT".equals(basketStatus)
          || !("INITIATED".equals(paymentStatus) || "PENDING".equals(paymentStatus))) {
        markReview(callbackId, attempt.id());
        return;
      }
    }

    String receipt = callback.receipt();
    if (paid
        && Boolean.TRUE.equals(
            jdbc.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM payments WHERE mpesa_receipt = ? AND id <> ?)",
                Boolean.class,
                receipt,
                attempt.id()))) {
      markReview(callbackId, attempt.id());
      return;
    }
    int updated =
        jdbc.update(
            """
            UPDATE payments
               SET status = ?, result_code = ?, result_desc = ?, mpesa_receipt = ?,
                   completed_at = now()
             WHERE id = ? AND status IN ('INITIATED', 'PENDING')
            """,
            paid ? "SUCCEEDED" : "FAILED",
            callback.resultCode(),
            callback.description(),
            receipt,
            attempt.id());
    if (updated == 0) {
      String current =
          jdbc.queryForObject(
              "SELECT status FROM payments WHERE id = ?", String.class, attempt.id());
      String expected = paid ? "SUCCEEDED" : "FAILED";
      if (!expected.equals(current)) {
        markReview(callbackId, attempt.id());
        return;
      }
    }
    if (paid) {
      int basketUpdated =
          jdbc.update(
              """
              UPDATE baskets
                 SET status = 'PAID'
               WHERE id = ? AND status = 'PENDING_PAYMENT'
              """,
              attempt.basketId());
      int ordersUpdated =
          jdbc.update(
              """
              UPDATE vendor_orders
                 SET status = 'PAID', paid_at = COALESCE(paid_at, now())
               WHERE basket_id = ? AND status = 'AWAITING_PAYMENT'
              """,
              attempt.basketId());
      if (basketUpdated != 1 || ordersUpdated < 1) {
        throw new IllegalStateException(
            "Verified payment could not be settled against its basket and merchant orders.");
      }
      jdbc.update(
          """
          INSERT INTO merchant_order_alerts (vendor_order_id, merchant_user_id)
          SELECT vo.id, m.user_id
            FROM vendor_orders vo
            JOIN merchants m ON m.id = vo.merchant_id
           WHERE vo.basket_id = ?
          ON CONFLICT (vendor_order_id) DO NOTHING
          """,
          attempt.basketId());
      wallet.recordPayment(attempt.id(), attempt.amountKes());
    }
    markCallbackProcessed(callbackId);
  }

  private void markCallbackProcessed(UUID callbackId) {
    jdbc.update(
        """
        UPDATE payment_callback_inbox
           SET status = 'PROCESSED', attempts = attempts + 1,
               processed_at = now(), claimed_at = NULL
         WHERE id = ? AND status = 'PROCESSING'
        """,
        callbackId);
  }

  private static byte[] sha256(String value) {
    try {
      return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
    } catch (java.security.NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is unavailable.", exception);
    }
  }

  public record PaymentAttempt(
      UUID id,
      UUID basketId,
      String basketNo,
      String phone,
      int amountKes,
      String merchantRequestId,
      String checkoutRequestId,
      String status,
      Instant createdAt,
      boolean mayInitiate) {}

  public record CallbackEnvelope(
      UUID id, String checkoutRequestId, String payload, int attempts) {}

  private record Basket(
      UUID id, String basketNo, String phone, int totalKes, String status, Instant expiresAt) {}
}
