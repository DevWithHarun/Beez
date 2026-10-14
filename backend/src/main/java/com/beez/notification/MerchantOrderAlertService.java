package com.beez.notification;

import com.beez.auth.service.AuthException;
import com.beez.auth.spi.SmsSender;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
@Profile({"prod", "sandbox"})
public class MerchantOrderAlertService {
  private static final Logger LOGGER = LoggerFactory.getLogger(MerchantOrderAlertService.class);
  private final JdbcTemplate jdbc;
  private final SmsSender smsSender;

  public MerchantOrderAlertService(JdbcTemplate jdbc, SmsSender smsSender) {
    this.jdbc = jdbc;
    this.smsSender = smsSender;
  }

  @Scheduled(fixedDelayString = "${beez.notifications.order-alert-poll-interval-ms:5000}")
  public void deliverQueuedAlerts() {
    for (OrderAlert alert : claimBatch()) {
      deliver(alert);
    }
  }

  List<OrderAlert> claimBatch() {
    jdbc.update(
        """
        UPDATE merchant_order_alerts
           SET status = 'FAILED', claimed_at = NULL, last_error_code = 'delivery_attempts_exhausted'
         WHERE status = 'PROCESSING'
           AND attempts >= 3
           AND claimed_at < now() - interval '2 minutes'
        """);
    return jdbc.query(
        """
        UPDATE merchant_order_alerts
           SET status = 'PROCESSING', attempts = attempts + 1, claimed_at = now()
         WHERE id IN (
           SELECT id
             FROM merchant_order_alerts
            WHERE (status = 'PENDING' AND next_attempt_at <= now())
               OR (status = 'PROCESSING' AND attempts < 3
                   AND claimed_at < now() - interval '2 minutes')
            ORDER BY created_at, id
            FOR UPDATE SKIP LOCKED
            LIMIT 20
         )
        RETURNING id, vendor_order_id, merchant_user_id, attempts
        """,
        (rs, row) ->
            new OrderAlert(
                rs.getObject("id", UUID.class),
                rs.getObject("vendor_order_id", UUID.class),
                rs.getObject("merchant_user_id", UUID.class),
                rs.getInt("attempts")));
  }

  private void deliver(OrderAlert alert) {
    Recipient recipient =
        jdbc.query(
                """
                SELECT u.phone, m.business_name
                  FROM users u
                  JOIN merchants m ON m.user_id = u.id
                  JOIN vendor_orders vo ON vo.merchant_id = m.id
                 WHERE u.id = ? AND vo.id = ?
                """,
                (rs, row) -> new Recipient(rs.getString("phone"), rs.getString("business_name")),
                alert.merchantUserId(),
                alert.vendorOrderId())
            .stream()
            .findFirst()
            .orElse(null);
    if (recipient == null) {
      markFailed(alert.id(), "merchant_recipient_unavailable");
      LOGGER.warn("Merchant order SMS alert {} has no active recipient", alert.id());
      return;
    }

    String shopName =
        recipient.shopName().length() > 80
            ? recipient.shopName().substring(0, 77) + "..."
            : recipient.shopName();
    try {
      smsSender.send(
          recipient.phone(),
          "Beez: A new paid order has arrived for "
              + shopName
              + ". Sign in to review and prepare it.");
      jdbc.update(
          """
          UPDATE merchant_order_alerts
             SET status = 'SENT', sent_at = now(), claimed_at = NULL, last_error_code = NULL
           WHERE id = ? AND status = 'PROCESSING'
          """,
          alert.id());
    } catch (AuthException | IllegalArgumentException exception) {
      retryOrFail(alert, exception instanceof AuthException ? "sms_unavailable" : "recipient_invalid");
    }
  }

  private void retryOrFail(OrderAlert alert, String errorCode) {
    String status = alert.attempts() >= 3 ? "FAILED" : "PENDING";
    jdbc.update(
        """
        UPDATE merchant_order_alerts
           SET status = ?,
               next_attempt_at = now() + CASE WHEN attempts = 1
                 THEN interval '30 seconds' ELSE interval '5 minutes' END,
               claimed_at = NULL, last_error_code = ?
         WHERE id = ? AND status = 'PROCESSING'
        """,
        status,
        errorCode,
        alert.id());
    LOGGER.warn("Merchant order alert {} delivery failed ({})", alert.id(), errorCode);
  }

  private void markFailed(UUID id, String errorCode) {
    jdbc.update(
        """
        UPDATE merchant_order_alerts
           SET status = 'FAILED', claimed_at = NULL, last_error_code = ?
         WHERE id = ? AND status = 'PROCESSING'
        """,
        errorCode,
        id);
  }

  record OrderAlert(UUID id, UUID vendorOrderId, UUID merchantUserId, int attempts) {}

  record Recipient(String phone, String shopName) {}
}
