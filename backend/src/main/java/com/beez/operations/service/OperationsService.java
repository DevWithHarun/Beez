package com.beez.operations.service;

import static com.beez.operations.api.OperationsModels.*;

import com.beez.operations.api.OperationsException;
import com.beez.auth.service.AuthService;
import com.beez.catalogue.service.CatalogueService;
import com.beez.wallet.api.WithdrawalModels.PendingWithdrawalPage;
import com.beez.wallet.service.MerchantWalletService;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OperationsService {
  private static final ZoneId BUSINESS_ZONE = ZoneId.of("Africa/Nairobi");

  private final JdbcTemplate jdbc;
  private final MerchantWalletService wallet;
  private final CatalogueService catalogue;
  private final AuthService auth;

  public OperationsService(
      JdbcTemplate jdbc,
      MerchantWalletService wallet,
      CatalogueService catalogue,
      AuthService auth) {
    this.jdbc = jdbc;
    this.wallet = wallet;
    this.catalogue = catalogue;
    this.auth = auth;
  }

  @Transactional(readOnly = true)
  public OperationsSummary operationsSummary(UUID actor) {
    requireOperator(actor);
    LocalDate businessDate = LocalDate.now(BUSINESS_ZONE);
    Timestamp dayStart =
        Timestamp.from(businessDate.atStartOfDay(BUSINESS_ZONE).toInstant());
    Timestamp dayEnd =
        Timestamp.from(businessDate.plusDays(1).atStartOfDay(BUSINESS_ZONE).toInstant());
    OperationsSummary summary =
        jdbc.queryForObject(
        """
        WITH bounds AS (
          SELECT ?::timestamptz AS day_start, ?::timestamptz AS day_end
        ),
        metrics AS (
          SELECT
            (SELECT count(*) FROM baskets b, bounds
              WHERE b.created_at >= day_start AND b.created_at < day_end) AS orders_today,
            (SELECT COALESCE(sum(p.amount_kes), 0) FROM payments p, bounds
              WHERE p.status = 'SUCCEEDED'
                AND p.completed_at >= day_start AND p.completed_at < day_end) AS paid_today_kes,
            (SELECT count(*) FROM merchants m
              JOIN users u ON u.id = m.user_id
              WHERE m.status = 'ACTIVE' AND u.status = 'ACTIVE') AS active_merchants,
            (SELECT count(*) FROM rider_profiles rp
              JOIN users u ON u.id = rp.user_id
              WHERE rp.approval_status = 'APPROVED' AND u.status = 'ACTIVE') AS active_riders,
            (SELECT round(avg(extract(epoch FROM (d.delivered_at - d.created_at)) / 60.0))::bigint
              FROM deliveries d, bounds
              WHERE d.status = 'DELIVERED' AND d.delivered_at >= day_start
                AND d.delivered_at < day_end AND d.delivered_at >= d.created_at)
              AS average_delivery_minutes,
            (SELECT count(*) FROM deliveries
              WHERE status IN ('WAITING_READY', 'AVAILABLE', 'CLAIMED', 'PICKED_UP', 'ON_THE_WAY'))
              AS open_deliveries,
            (SELECT count(*) FROM deliveries WHERE status = 'FAILED') AS failed_deliveries,
            (SELECT count(*) FROM merchants m
              JOIN users u ON u.id = m.user_id
              WHERE m.status = 'PENDING_REVIEW' AND u.status = 'ACTIVE')
              AS pending_merchant_approvals,
            (SELECT count(*) FROM rider_profiles rp
              JOIN users u ON u.id = rp.user_id
              WHERE rp.approval_status = 'PENDING' AND u.status = 'ACTIVE')
              AS pending_rider_approvals,
            (SELECT count(*) FROM payments WHERE status = 'REVIEW')
              + (SELECT count(*) FROM payment_callback_inbox
                  WHERE status = 'REVIEW'
                    OR (status IN ('RECEIVED', 'RETRY')
                        AND received_at < now() - interval '15 minutes'))
              AS payment_issues,
            (SELECT count(*) FROM merchant_withdrawal_requests
              WHERE status IN ('REQUESTED', 'PROCESSING')) AS pending_withdrawals,
            (SELECT count(*) FROM merchant_refund_requests
              WHERE status = 'PENDING') AS pending_refunds
        )
        SELECT metrics.*,
          pending_merchant_approvals + pending_rider_approvals + failed_deliveries
            + payment_issues + pending_withdrawals + pending_refunds AS attention_items
        FROM metrics
        """,
        (rs, row) ->
            new OperationsSummary(
                rs.getLong("orders_today"),
                rs.getLong("paid_today_kes"),
                rs.getLong("active_merchants"),
                rs.getLong("active_riders"),
                (Long) rs.getObject("average_delivery_minutes"),
                rs.getLong("open_deliveries"),
                rs.getLong("failed_deliveries"),
                rs.getLong("pending_merchant_approvals"),
                rs.getLong("pending_rider_approvals"),
                rs.getLong("payment_issues"),
                rs.getLong("pending_withdrawals"),
                rs.getLong("pending_refunds"),
                rs.getLong("attention_items"),
                Instant.now()),
        dayStart,
        dayEnd);
    return summary;
  }

  @Transactional(readOnly = true)
  public MerchantApplicantPage pendingMerchants(UUID actor) {
    requireOperator(actor);
    return new MerchantApplicantPage(
        jdbc.query(
            """
            SELECT m.id, m.user_id, m.business_name, m.category, z.name AS zone_name,
                   m.location_text, u.display_name,
                   CASE WHEN u.phone IS NULL THEN NULL
                        ELSE '••••••' || RIGHT(u.phone, 4) END AS phone_masked,
                   m.created_at
              FROM merchants m
              JOIN users u ON u.id = m.user_id
              JOIN zones z ON z.id = m.zone_id
             WHERE m.status = 'PENDING_REVIEW' AND u.status = 'ACTIVE'
             ORDER BY m.created_at, m.id
             LIMIT 100
            """,
            (rs, row) ->
                new MerchantApplicant(
                    rs.getObject("id", UUID.class),
                    rs.getObject("user_id", UUID.class),
                    rs.getString("business_name"),
                    rs.getString("category"),
                    rs.getString("zone_name"),
                    rs.getString("location_text"),
                    rs.getString("display_name"),
                    rs.getString("phone_masked"),
                    rs.getTimestamp("created_at").toInstant())));
  }

  @Transactional
  public void decideMerchant(UUID actor, UUID merchantId, boolean approved, String reason) {
    requireOperator(actor);
    requireReason(reason, "Enter a review reason of 1 to 240 characters.");
    catalogue.reviewMerchant(merchantId, approved);
    audit(
        actor,
        approved ? "MERCHANT_APPROVED" : "MERCHANT_REJECTED",
        "MERCHANT",
        merchantId,
        reason.trim());
  }

  @Transactional(readOnly = true)
  public AdminOrderPage orders(UUID actor) {
    requireOperator(actor);
    return new AdminOrderPage(
        jdbc.query(
            """
            SELECT vo.id, b.basket_no, m.business_name,
                   CASE WHEN b.customer_phone IS NULL THEN NULL
                        ELSE '••••••' || RIGHT(b.customer_phone, 4) END AS phone_masked,
                   vo.status, d.status AS delivery_status, vo.subtotal_kes,
                   vo.created_at, vo.paid_at
              FROM vendor_orders vo
              JOIN baskets b ON b.id = vo.basket_id
              JOIN merchants m ON m.id = vo.merchant_id
              LEFT JOIN deliveries d ON d.basket_id = b.id
             ORDER BY vo.created_at DESC, vo.id DESC
             LIMIT 100
            """,
            (rs, row) ->
                new AdminOrder(
                    rs.getObject("id", UUID.class),
                    rs.getString("basket_no"),
                    rs.getString("business_name"),
                    rs.getString("phone_masked"),
                    rs.getString("status"),
                    rs.getString("delivery_status"),
                    rs.getInt("subtotal_kes"),
                    rs.getTimestamp("created_at").toInstant(),
                    rs.getTimestamp("paid_at") == null
                        ? null
                        : rs.getTimestamp("paid_at").toInstant())));
  }

  @Transactional(readOnly = true)
  public OrderTimeline orderTimeline(UUID actor, UUID orderId) {
    requireOperator(actor);
    return new OrderTimeline(
        jdbc.query(
            """
            SELECT type, from_status, to_status, detail, created_at
              FROM (
                SELECT 'ORDER' AS type, from_status, to_status,
                       'Order status changed' AS detail, created_at
                  FROM vendor_order_events WHERE vendor_order_id = ?
                UNION ALL
                SELECT 'DELIVERY', de.from_status, de.to_status, de.detail, de.created_at
                  FROM delivery_events de
                  JOIN delivery_stops ds ON ds.delivery_id = de.delivery_id
                 WHERE ds.vendor_order_id = ?
                UNION ALL
                SELECT 'PAYMENT', NULL, p.status,
                       COALESCE(p.result_desc, 'Payment attempt recorded'), p.created_at
                  FROM payments p
                  JOIN vendor_orders vo ON vo.basket_id = p.basket_id
                 WHERE vo.id = ?
                UNION ALL
                SELECT 'REFUND', NULL, rr.status, COALESCE(rr.resolution_note, rr.reason),
                       rr.requested_at
                  FROM merchant_refund_requests rr
                 WHERE rr.vendor_order_id = ?
              ) events
             ORDER BY created_at DESC
             LIMIT 100
            """,
            (rs, row) ->
                new OrderEvent(
                    rs.getString("type"),
                    rs.getString("from_status"),
                    rs.getString("to_status"),
                    rs.getString("detail"),
                    rs.getTimestamp("created_at").toInstant()),
            orderId,
            orderId,
            orderId,
            orderId));
  }

  @Transactional(readOnly = true)
  public AdminPaymentPage payments(UUID actor) {
    requireOperator(actor);
    return new AdminPaymentPage(
        jdbc.query(
            """
            SELECT p.id, b.basket_no,
                   '••••••' || RIGHT(p.phone, 4) AS phone_masked,
                   p.amount_kes, p.provider, p.status, p.mpesa_receipt,
                   ci.status AS callback_status, p.created_at, p.completed_at, p.result_desc
              FROM payments p
              JOIN baskets b ON b.id = p.basket_id
              LEFT JOIN payment_callback_inbox ci
                ON ci.checkout_request_id = p.checkout_request_id
             ORDER BY p.created_at DESC, p.id DESC
             LIMIT 100
            """,
            (rs, row) ->
                new AdminPayment(
                    rs.getObject("id", UUID.class),
                    rs.getString("basket_no"),
                    rs.getString("phone_masked"),
                    rs.getInt("amount_kes"),
                    rs.getString("provider"),
                    rs.getString("status"),
                    rs.getString("mpesa_receipt"),
                    rs.getString("callback_status"),
                    rs.getTimestamp("created_at").toInstant(),
                    rs.getTimestamp("completed_at") == null
                        ? null
                        : rs.getTimestamp("completed_at").toInstant(),
                    rs.getString("result_desc"))));
  }

  @Transactional(readOnly = true)
  public AdminExceptionPage exceptions(UUID actor) {
    requireOperator(actor);
    return new AdminExceptionPage(
        jdbc.query(
            """
            SELECT id, type, basket_no, status, detail, occurred_at
              FROM (
                SELECT d.id, 'DELIVERY' AS type, b.basket_no, d.status,
                       'Delivery failed; review the delivery timeline' AS detail,
                       d.updated_at AS occurred_at
                  FROM deliveries d JOIN baskets b ON b.id = d.basket_id
                 WHERE d.status = 'FAILED'
                UNION ALL
                SELECT p.id, 'PAYMENT', b.basket_no, p.status,
                       COALESCE(p.result_desc, 'Payment requires review'), p.created_at
                  FROM payments p JOIN baskets b ON b.id = p.basket_id
                 WHERE p.status = 'REVIEW'
                    OR (p.status IN ('INITIATED', 'PENDING')
                        AND p.created_at < now() - interval '15 minutes')
                UNION ALL
                SELECT ci.id, 'CALLBACK', b.basket_no, ci.status,
                       'Payment callback needs attention', ci.received_at
                  FROM payment_callback_inbox ci
                  LEFT JOIN payments p ON p.checkout_request_id = ci.checkout_request_id
                  LEFT JOIN baskets b ON b.id = p.basket_id
                 WHERE ci.status = 'REVIEW'
                    OR (ci.status IN ('RECEIVED', 'RETRY')
                        AND ci.received_at < now() - interval '15 minutes')
              ) exceptions
             ORDER BY occurred_at DESC
             LIMIT 100
            """,
            (rs, row) ->
                new AdminException(
                    rs.getObject("id", UUID.class),
                    rs.getString("type"),
                    rs.getString("basket_no"),
                    rs.getString("status"),
                    rs.getString("detail"),
                    rs.getTimestamp("occurred_at").toInstant())));
  }

  @Transactional(readOnly = true)
  public AdminLedgerPage ledger(UUID actor) {
    requireOperator(actor);
    return new AdminLedgerPage(
        jdbc.query(
            """
            SELECT le.id, wa.account_type,
                   COALESCE(m.business_name, u.display_name, aa.email, 'Beez platform') AS owner_name,
                   lt.reference_type, lt.description, le.amount_kes, le.created_at,
                   b.basket_no
              FROM ledger_entries le
              JOIN wallet_accounts wa ON wa.id = le.account_id
              JOIN ledger_transactions lt ON lt.id = le.transaction_id
              LEFT JOIN users u ON u.id = wa.owner_user_id
              LEFT JOIN merchants m ON m.user_id = wa.owner_user_id
              LEFT JOIN admin_accounts aa ON aa.user_id = wa.owner_user_id
              LEFT JOIN vendor_orders vo
                ON lt.reference_type = 'DELIVERY' AND vo.id = lt.reference_id
              LEFT JOIN baskets b ON b.id = vo.basket_id
             ORDER BY le.created_at DESC, le.id DESC
             LIMIT 100
            """,
            (rs, row) ->
                new AdminLedgerEntry(
                    rs.getObject("id", UUID.class),
                    rs.getString("account_type"),
                    rs.getString("owner_name"),
                    rs.getString("reference_type"),
                    rs.getString("description"),
                    rs.getLong("amount_kes"),
                    rs.getTimestamp("created_at").toInstant(),
                    rs.getString("basket_no"))));
  }

  @Transactional(readOnly = true)
  public AdminUserPage users(UUID actor, String query) {
    requireOperator(actor);
    String pattern = queryPattern(query);
    return new AdminUserPage(
        jdbc.query(
            """
            SELECT u.id, u.role, COALESCE(u.display_name, u.shop_name, 'Account') AS display_name,
                   CASE WHEN u.phone IS NULL THEN NULL
                        ELSE '••••••' || RIGHT(u.phone, 4) END AS phone_masked,
                   u.status, m.status AS merchant_status, rp.approval_status AS rider_status,
                   u.created_at, u.last_login_at
              FROM users u
              LEFT JOIN merchants m ON m.user_id = u.id
              LEFT JOIN rider_profiles rp ON rp.user_id = u.id
             WHERE u.role IN ('MERCHANT', 'RIDER')
               AND (CAST(? AS text) IS NULL OR u.display_name ILIKE ? ESCAPE E'\\\\'
                    OR u.shop_name ILIKE ? ESCAPE E'\\\\'
                    OR u.phone ILIKE ? ESCAPE E'\\\\')
             ORDER BY u.created_at DESC, u.id DESC
             LIMIT 100
            """,
            (rs, row) ->
                new AdminUser(
                    rs.getObject("id", UUID.class),
                    rs.getString("role"),
                    rs.getString("display_name"),
                    rs.getString("phone_masked"),
                    rs.getString("status"),
                    rs.getString("merchant_status"),
                    rs.getString("rider_status"),
                    rs.getTimestamp("created_at").toInstant(),
                    rs.getTimestamp("last_login_at") == null
                        ? null
                        : rs.getTimestamp("last_login_at").toInstant()),
            pattern,
            pattern,
            pattern,
            pattern));
  }

  @Transactional(readOnly = true)
  public AuditEventPage audit(UUID actor, String query) {
    requireOperator(actor);
    String pattern = queryPattern(query);
    return new AuditEventPage(
        jdbc.query(
            """
            SELECT e.id, COALESCE(a.email, u.display_name, 'Beez admin') AS actor_email,
                   e.action, e.entity_type, e.entity_id, e.detail, e.created_at
              FROM operations_audit_events e
              LEFT JOIN admin_accounts a ON a.user_id = e.actor_user_id
              LEFT JOIN users u ON u.id = e.actor_user_id
             WHERE CAST(? AS text) IS NULL OR e.action ILIKE ? ESCAPE E'\\\\'
                OR e.entity_type ILIKE ? ESCAPE E'\\\\'
                OR e.detail ILIKE ? ESCAPE E'\\\\'
             ORDER BY e.created_at DESC, e.id DESC
             LIMIT 100
            """,
            (rs, row) ->
                new AuditEvent(
                    rs.getObject("id", UUID.class),
                    rs.getString("actor_email"),
                    rs.getString("action"),
                    rs.getString("entity_type"),
                    rs.getObject("entity_id", UUID.class),
                    rs.getString("detail"),
                    rs.getTimestamp("created_at").toInstant()),
            pattern,
            pattern,
            pattern,
            pattern));
  }

  @Transactional
  public void suspendUser(UUID actor, UUID userId, String reason) {
    requireOperator(actor);
    requireReason(reason, "Enter a suspension reason of 1 to 240 characters.");
    auth.suspendAccount(userId);
    audit(actor, "USER_SUSPENDED", "USER", userId, reason.trim());
  }

  @Transactional
  public void restoreUser(UUID actor, UUID userId, String reason) {
    requireOperator(actor);
    requireReason(reason, "Enter a restoration reason of 1 to 240 characters.");
    auth.restoreAccount(userId);
    audit(actor, "USER_RESTORED", "USER", userId, reason.trim());
  }

  @Transactional
  public void logoutUserSessions(UUID actor, UUID userId, String reason) {
    requireOperator(actor);
    requireReason(reason, "Enter a logout reason of 1 to 240 characters.");
    Boolean isTarget =
        jdbc.queryForObject(
            "SELECT EXISTS (SELECT 1 FROM users WHERE id = ? AND role IN ('MERCHANT','RIDER'))",
            Boolean.class,
            userId);
    if (!Boolean.TRUE.equals(isTarget)) {
      throw new OperationsException(
          "user_not_found", "This merchant or rider account was not found.", HttpStatus.NOT_FOUND);
    }
    auth.logoutAll(userId);
    audit(actor, "USER_SESSIONS_REVOKED", "USER", userId, reason.trim());
  }

  @Transactional(readOnly = true)
  public PendingRefundPage pendingRefunds(UUID actor) {
    requireOperator(actor);
    return new PendingRefundPage(
        jdbc.query(
            """
            SELECT rr.id, rr.vendor_order_id, b.basket_no, m.business_name,
                   CASE WHEN b.customer_phone IS NULL THEN NULL
                        ELSE '••••••' || RIGHT(b.customer_phone, 4) END AS customer_phone_masked,
                   rr.amount_kes, rr.reason, rr.requested_at
              FROM merchant_refund_requests rr
              JOIN vendor_orders vo ON vo.id = rr.vendor_order_id
              JOIN baskets b ON b.id = vo.basket_id
              JOIN merchants m ON m.id = vo.merchant_id
             WHERE rr.status = 'PENDING'
             ORDER BY rr.requested_at, rr.id
             LIMIT 100
            """,
            (rs, row) ->
                new PendingRefund(
                    rs.getObject("id", UUID.class),
                    rs.getObject("vendor_order_id", UUID.class),
                    rs.getString("basket_no"),
                    rs.getString("business_name"),
                    rs.getString("customer_phone_masked"),
                    rs.getInt("amount_kes"),
                    rs.getString("reason"),
                    rs.getTimestamp("requested_at").toInstant())));
  }

  @Transactional(readOnly = true)
  public PendingRiderPage pendingRiders(UUID actor) {
    requireOperator(actor);
    return new PendingRiderPage(
        jdbc.query(
            """
            SELECT u.id, u.display_name,
                   CASE WHEN u.phone IS NULL THEN NULL
                        ELSE '••••••' || RIGHT(u.phone, 4) END AS phone_masked,
                   u.onboarding_area AS area, u.created_at
              FROM rider_profiles rp JOIN users u ON u.id = rp.user_id
             WHERE rp.approval_status = 'PENDING' AND u.status = 'ACTIVE'
             ORDER BY u.created_at, u.id
             LIMIT 100
            """,
            (rs, row) ->
                new PendingRider(
                    rs.getObject("id", UUID.class),
                    rs.getString("display_name"),
                    rs.getString("phone_masked"),
                    rs.getString("area"),
                    rs.getTimestamp("created_at").toInstant())));
  }

  @Transactional(readOnly = true)
  public PendingWithdrawalPage pendingWithdrawals(UUID actor) {
    requireOperator(actor);
    return wallet.pendingWithdrawals();
  }

  @Transactional
  public void startWithdrawal(UUID actor, UUID requestId) {
    requireOperator(actor);
    wallet.startWithdrawal(requestId, actor);
    audit(actor, "WITHDRAWAL_PROCESSING", "MERCHANT_WITHDRAWAL", requestId,
        "Operator started manual payout processing.");
  }

  @Transactional
  public void confirmWithdrawal(UUID actor, UUID requestId, String providerReference) {
    requireOperator(actor);
    wallet.confirmWithdrawal(requestId, actor, providerReference);
    audit(actor, "WITHDRAWAL_PAID", "MERCHANT_WITHDRAWAL", requestId, providerReference.trim());
  }

  @Transactional
  public void rejectWithdrawal(
      UUID actor, UUID requestId, String note, boolean transferNotSent) {
    requireOperator(actor);
    wallet.rejectWithdrawal(requestId, actor, note, transferNotSent);
    audit(actor, "WITHDRAWAL_REJECTED", "MERCHANT_WITHDRAWAL", requestId, note.trim());
  }

  @Transactional
  public void confirmRefund(UUID actor, UUID requestId, String providerReference) {
    requireOperator(actor);
    if (providerReference == null || !providerReference.trim().matches("[A-Za-z0-9._-]{4,64}")) {
      throw invalid("Enter the M-Pesa refund reference (4 to 64 letters or numbers).");
    }
    RefundState request = lockRefund(requestId);
    if (!"PENDING".equals(request.status())) {
      throw conflict("This refund request has already been resolved.");
    }
    jdbc.update(
        """
        UPDATE merchant_refund_requests
           SET status = 'CONFIRMED', provider_reference = ?, resolved_at = now(),
               resolved_by = ?, resolution_note = 'Operator confirmed external M-Pesa refund.'
         WHERE id = ? AND status = 'PENDING'
        """,
        providerReference.trim(),
        actor,
        requestId);
    wallet.recordConfirmedRefund(requestId, request.amountKes());
    audit(actor, "REFUND_CONFIRMED", "MERCHANT_REFUND", requestId, providerReference.trim());
  }

  @Transactional
  public void markRefundFailed(UUID actor, UUID requestId, String note) {
    requireOperator(actor);
    if (note == null || note.isBlank() || note.trim().length() > 240) {
      throw invalid("Enter a reason of 1 to 240 characters.");
    }
    lockRefund(requestId);
    int changed =
        jdbc.update(
            """
            UPDATE merchant_refund_requests
               SET status = 'FAILED', resolved_at = now(), resolved_by = ?, resolution_note = ?
             WHERE id = ? AND status = 'PENDING'
            """,
            actor,
            note.trim(),
            requestId);
    if (changed != 1) throw conflict("This refund request has already been resolved.");
    audit(actor, "REFUND_FAILED", "MERCHANT_REFUND", requestId, note.trim());
  }

  @Transactional
  public void approveRider(UUID actor, UUID riderUserId) {
    requireOperator(actor);
    int updated =
        jdbc.update(
            """
            UPDATE rider_profiles SET approval_status = 'APPROVED', updated_at = now()
             WHERE user_id = ? AND approval_status = 'PENDING'
            """,
            riderUserId);
    if (updated != 1) throw conflict("This rider is not pending approval.");
    audit(actor, "RIDER_APPROVED", "RIDER", riderUserId, "Rider approved for delivery jobs.");
  }

  private RefundState lockRefund(UUID requestId) {
    return jdbc.query(
            "SELECT status, amount_kes FROM merchant_refund_requests WHERE id = ? FOR UPDATE",
            (rs, row) -> new RefundState(rs.getString("status"), rs.getInt("amount_kes")),
            requestId)
        .stream()
        .findFirst()
        .orElseThrow(
            () ->
                new OperationsException(
                    "refund_not_found", "This refund request was not found.", HttpStatus.NOT_FOUND));
  }

  private void requireOperator(UUID actor) {
    Boolean isAdmin =
        jdbc.queryForObject(
            """
            SELECT EXISTS (
                SELECT 1
                  FROM users u
                  JOIN admin_accounts a ON a.user_id = u.id
                 WHERE u.id = ? AND u.role = 'ADMIN'
                   AND u.status = 'ACTIVE' AND a.enabled = true
            )
            """,
            Boolean.class,
            actor);
    if (!Boolean.TRUE.equals(isAdmin)) {
      throw new OperationsException(
          "operations_forbidden",
          "This account is not allowed to perform Beez operations.",
          HttpStatus.FORBIDDEN);
    }
  }

  private void audit(UUID actor, String action, String type, UUID entity, String detail) {
    jdbc.update(
        """
        INSERT INTO operations_audit_events (actor_user_id, action, entity_type, entity_id, detail)
        VALUES (?, ?, ?, ?, ?)
        """,
        actor,
        action,
        type,
        entity,
        detail);
  }

  private static void requireReason(String value, String message) {
    if (value == null || value.isBlank() || value.trim().length() > 240) {
      throw invalid(message);
    }
  }

  private static String queryPattern(String query) {
    if (query == null || query.isBlank()) return null;
    String normalized = query.trim();
    if (normalized.length() > 100) {
      throw invalid("Search text must contain at most 100 characters.");
    }
    return "%"
        + normalized.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        + "%";
  }

  private static OperationsException invalid(String message) {
    return new OperationsException("operations_input_invalid", message, HttpStatus.BAD_REQUEST);
  }

  private static OperationsException conflict(String message) {
    return new OperationsException("operations_transition_invalid", message, HttpStatus.CONFLICT);
  }

  private record RefundState(String status, int amountKes) {}
}
