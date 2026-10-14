package com.beez.wallet.service;

import static com.beez.wallet.api.MerchantEarningsModels.*;
import static com.beez.wallet.api.RiderEarningsModels.*;
import static com.beez.wallet.api.WithdrawalModels.*;

import com.beez.wallet.api.MerchantWalletException;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MerchantWalletService {
  private static final int COMMISSION_PERCENT = 5;
  private static final int RIDER_COMMISSION_PERCENT = 5;
  private static final String PLATFORM_REVENUE = "PLATFORM_REVENUE";
  private static final String CUSTOMER_FUNDS = "CUSTOMER_FUNDS";
  private static final String PAYMENT_CLEARING = "PAYMENT_CLEARING";
  private final JdbcTemplate jdbc;

  public MerchantWalletService(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Transactional
  public void recordPayment(UUID paymentId, int amountKes) {
    if (amountKes <= 0) throw new IllegalArgumentException("Payment ledger amount must be positive.");
    UUID transactionId = createTransaction("PAYMENT", paymentId, "Verified customer payment");
    if (transactionId == null) return;
    UUID clearing = systemAccount(PAYMENT_CLEARING);
    UUID customerFunds = systemAccount(CUSTOMER_FUNDS);
    entry(transactionId, clearing, -amountKes);
    entry(transactionId, customerFunds, amountKes);
  }

  @Transactional
  public void recordDeliveredOrder(UUID orderId, UUID merchantUserId, int merchandiseKes) {
    if (merchandiseKes <= 0) return;
    UUID transactionId =
        createTransaction("DELIVERY", orderId, "Merchant earnings after verified delivery");
    if (transactionId == null) return;
    int commissionKes = (merchandiseKes * COMMISSION_PERCENT + 50) / 100;
    int merchantNetKes = merchandiseKes - commissionKes;
    UUID customerFunds = systemAccount(CUSTOMER_FUNDS);
    UUID platformRevenue = systemAccount(PLATFORM_REVENUE);
    UUID merchantAccount = merchantAccount(merchantUserId);
    entry(transactionId, customerFunds, -merchandiseKes);
    if (merchantNetKes > 0) entry(transactionId, merchantAccount, merchantNetKes);
    if (commissionKes > 0) entry(transactionId, platformRevenue, commissionKes);
  }

  @Transactional
  public void recordRiderDelivery(UUID deliveryId, UUID riderUserId, int deliveryFeeKes) {
    if (deliveryFeeKes <= 0) return;
    UUID transactionId =
        createTransaction("RIDER_DELIVERY", deliveryId, "Rider earnings after verified delivery");
    if (transactionId == null) return;
    long commissionKes = ((long) deliveryFeeKes * RIDER_COMMISSION_PERCENT + 50) / 100;
    long riderNetKes = deliveryFeeKes - commissionKes;
    UUID customerFunds = systemAccount(CUSTOMER_FUNDS);
    UUID platformRevenue = systemAccount(PLATFORM_REVENUE);
    UUID riderAccount = riderAccount(riderUserId);
    entry(transactionId, customerFunds, -deliveryFeeKes);
    if (riderNetKes > 0) entry(transactionId, riderAccount, riderNetKes);
    if (commissionKes > 0) entry(transactionId, platformRevenue, commissionKes);
  }

  @Transactional(readOnly = true)
  public RiderEarningsSummary riderSummary(UUID riderUserId) {
    return jdbc.queryForObject(
        """
        SELECT COALESCE((
                   SELECT SUM(le.amount_kes)
                     FROM wallet_accounts wa
                     LEFT JOIN ledger_entries le ON le.account_id = wa.id
                    WHERE wa.owner_user_id = ? AND wa.account_type = 'RIDER_AVAILABLE'
               ), 0) AS balance_kes,
               (SELECT count(*)
                  FROM deliveries
                 WHERE rider_user_id = ? AND status = 'DELIVERED') AS completed_deliveries
        """,
        (rs, row) ->
            new RiderEarningsSummary(
                rs.getLong("balance_kes"),
                rs.getLong("completed_deliveries"),
                RIDER_COMMISSION_PERCENT),
        riderUserId,
        riderUserId);
  }

  @Transactional(readOnly = true)
  public RiderLedgerPage riderHistory(UUID riderUserId) {
    List<RiderLedgerEntry> items =
        jdbc.query(
            """
            SELECT lt.description, ABS(le.amount_kes) AS amount_kes, le.created_at, b.basket_no,
                   CASE WHEN le.amount_kes >= 0 THEN 'CREDIT' ELSE 'DEBIT' END AS entry_type
              FROM wallet_accounts wa
              JOIN ledger_entries le ON le.account_id = wa.id
              JOIN ledger_transactions lt ON lt.id = le.transaction_id
              LEFT JOIN deliveries d
                ON lt.reference_type = 'RIDER_DELIVERY' AND d.id = lt.reference_id
              LEFT JOIN baskets b ON b.id = d.basket_id
             WHERE wa.owner_user_id = ? AND wa.account_type = 'RIDER_AVAILABLE'
             ORDER BY le.created_at DESC, le.id DESC
             LIMIT 50
            """,
            (rs, row) ->
                new RiderLedgerEntry(
                    rs.getString("entry_type"),
                    rs.getString("description"),
                    rs.getLong("amount_kes"),
                    rs.getTimestamp("created_at").toInstant(),
                    rs.getString("basket_no")),
            riderUserId);
    return new RiderLedgerPage(items);
  }

  @Transactional
  public void recordConfirmedRefund(UUID requestId, int amountKes) {
    if (amountKes == 0) return;
    UUID transactionId = createTransaction("REFUND", requestId, "Confirmed merchant order refund");
    if (transactionId == null) return;
    entry(transactionId, systemAccount(CUSTOMER_FUNDS), -amountKes);
    entry(transactionId, systemAccount(PAYMENT_CLEARING), amountKes);
  }

  @Transactional(readOnly = true)
  public EarningsSummary summary(UUID merchantUserId) {
    return jdbc.queryForObject(
        """
        SELECT GREATEST(
                   0,
                   COALESCE(SUM(le.amount_kes), 0)
                   - COALESCE((
                       SELECT SUM(wr.amount_kes)
                         FROM merchant_withdrawal_requests wr
                        WHERE wr.merchant_user_id = wa.owner_user_id
                          AND wr.status IN ('REQUESTED', 'PROCESSING')
                   ), 0)
               ) AS available_kes,
               count(DISTINCT lt.reference_id) AS delivered_orders
          FROM wallet_accounts wa
          LEFT JOIN ledger_entries le ON le.account_id = wa.id
          LEFT JOIN ledger_transactions lt ON lt.id = le.transaction_id
             AND lt.reference_type = 'DELIVERY'
         WHERE wa.owner_user_id = ? AND wa.account_type = 'MERCHANT_AVAILABLE'
        """,
        (rs, row) ->
            new EarningsSummary(
                rs.getLong("available_kes"), rs.getLong("delivered_orders"), COMMISSION_PERCENT),
        merchantUserId);
  }

  @Transactional(readOnly = true)
  public LedgerPage history(UUID merchantUserId) {
    List<LedgerEntry> items =
        jdbc.query(
            """
            SELECT lt.description, le.amount_kes, le.created_at, b.basket_no,
                   CASE WHEN le.amount_kes >= 0 THEN 'CREDIT' ELSE 'DEBIT' END AS entry_type
              FROM wallet_accounts wa
              JOIN ledger_entries le ON le.account_id = wa.id
              JOIN ledger_transactions lt ON lt.id = le.transaction_id
              LEFT JOIN vendor_orders vo
                ON lt.reference_type = 'DELIVERY' AND vo.id = lt.reference_id
              LEFT JOIN baskets b ON b.id = vo.basket_id
             WHERE wa.owner_user_id = ? AND wa.account_type = 'MERCHANT_AVAILABLE'
             ORDER BY le.created_at DESC, le.id DESC
             LIMIT 50
            """,
            (rs, row) ->
                new LedgerEntry(
                    rs.getString("entry_type"),
                    rs.getString("description"),
                    rs.getLong("amount_kes"),
                    rs.getTimestamp("created_at").toInstant(),
                    rs.getString("basket_no")),
            merchantUserId);
    return new LedgerPage(items);
  }

  @Transactional
  public Withdrawal requestWithdrawal(UUID merchantUserId, long amountKes) {
    if (amountKes <= 0) {
      throw invalidWithdrawal("Enter a withdrawal amount greater than zero.");
    }

    MerchantDestination destination =
        jdbc.query(
                """
                SELECT m.payout_phone
                  FROM users u
                  JOIN merchants m ON m.user_id = u.id
                 WHERE u.id = ? AND u.role = 'MERCHANT'
                   AND u.status = 'ACTIVE' AND m.status = 'ACTIVE'
                 FOR UPDATE OF u, m
                """,
                (rs, row) ->
                    new MerchantDestination(rs.getString("payout_phone")),
                merchantUserId)
            .stream()
            .findFirst()
            .orElseThrow(
                () ->
                    new MerchantWalletException(
                        "withdrawal_unavailable",
                        "Withdrawals are available to active merchant shops only.",
                        HttpStatus.CONFLICT));

    if (destination.payoutPhone() == null || destination.payoutPhone().isBlank()) {
      throw invalidWithdrawal("Add a registered M-Pesa payout number to your shop first.");
    }

    long balance =
        jdbc.queryForObject(
            """
            SELECT COALESCE(SUM(le.amount_kes), 0)
              FROM wallet_accounts wa
              LEFT JOIN ledger_entries le ON le.account_id = wa.id
             WHERE wa.owner_user_id = ? AND wa.account_type = 'MERCHANT_AVAILABLE'
            """,
            Long.class,
            merchantUserId);
    long reserved =
        jdbc.queryForObject(
            """
            SELECT COALESCE(SUM(amount_kes), 0)
              FROM merchant_withdrawal_requests
             WHERE merchant_user_id = ? AND status IN ('REQUESTED', 'PROCESSING')
            """,
            Long.class,
            merchantUserId);
    long availableKes = Math.max(0, balance - reserved);
    if (amountKes > availableKes) {
      throw new MerchantWalletException(
          "withdrawal_amount_exceeds_available",
          "The requested amount exceeds your currently available balance.",
          HttpStatus.CONFLICT);
    }

    UUID requestId = UUID.randomUUID();
    jdbc.update(
        """
        INSERT INTO merchant_withdrawal_requests
            (id, merchant_user_id, amount_kes, payout_phone)
        VALUES (?, ?, ?, ?)
        """,
        requestId,
        merchantUserId,
        amountKes,
        destination.payoutPhone());
    jdbc.update(
        """
        INSERT INTO operations_audit_events (actor_user_id, action, entity_type, entity_id, detail)
        VALUES (?, 'WITHDRAWAL_REQUESTED', 'MERCHANT_WITHDRAWAL', ?, ?)
        """,
        merchantUserId,
        requestId,
        "Merchant requested KES " + amountKes + " to the registered payout destination.");
    return withdrawal(merchantUserId, requestId);
  }

  @Transactional(readOnly = true)
  public WithdrawalPage withdrawals(UUID merchantUserId) {
    return new WithdrawalPage(
        jdbc.query(
            """
            SELECT id, amount_kes, status,
                   '••••••' || RIGHT(payout_phone, 4) AS payout_phone,
                   requested_at, resolved_at, provider_reference, resolution_note
              FROM merchant_withdrawal_requests
             WHERE merchant_user_id = ?
             ORDER BY requested_at DESC, id DESC
             LIMIT 100
            """,
            (rs, row) ->
                new Withdrawal(
                    rs.getObject("id", UUID.class),
                    rs.getLong("amount_kes"),
                    rs.getString("status"),
                    rs.getString("payout_phone"),
                    rs.getTimestamp("requested_at").toInstant(),
                    rs.getTimestamp("resolved_at") == null
                        ? null
                        : rs.getTimestamp("resolved_at").toInstant(),
                    rs.getString("provider_reference"),
                    rs.getString("resolution_note")),
            merchantUserId));
  }

  @Transactional(readOnly = true)
  public PendingWithdrawalPage pendingWithdrawals() {
    return new PendingWithdrawalPage(
        jdbc.query(
            """
            SELECT wr.id, wr.merchant_user_id, u.display_name, m.business_name,
                   wr.payout_phone, wr.amount_kes, wr.status, wr.requested_at,
                   wr.processing_at, processor.display_name AS processing_by,
                   wr.provider_reference
              FROM merchant_withdrawal_requests wr
              JOIN users u ON u.id = wr.merchant_user_id
              JOIN merchants m ON m.user_id = u.id
              LEFT JOIN users processor ON processor.id = wr.processing_by
             WHERE wr.status IN ('REQUESTED', 'PROCESSING')
             ORDER BY wr.requested_at, wr.id
             LIMIT 100
            """,
            (rs, row) ->
                new PendingWithdrawal(
                    rs.getObject("id", UUID.class),
                    rs.getObject("merchant_user_id", UUID.class),
                    rs.getString("display_name"),
                    rs.getString("business_name"),
                    rs.getString("payout_phone"),
                    rs.getLong("amount_kes"),
                    rs.getString("status"),
                    rs.getTimestamp("requested_at").toInstant(),
                    rs.getTimestamp("processing_at") == null
                        ? null
                        : rs.getTimestamp("processing_at").toInstant(),
                    rs.getString("processing_by"),
                    rs.getString("provider_reference"))));
  }

  @Transactional
  public void startWithdrawal(UUID requestId, UUID actor) {
    WithdrawalState request = lockWithdrawal(requestId);
    if (!"REQUESTED".equals(request.status())) {
      throw withdrawalConflict("This withdrawal request is no longer awaiting review.");
    }
    int changed =
        jdbc.update(
            """
            UPDATE merchant_withdrawal_requests
               SET status = 'PROCESSING', processing_at = now(), processing_by = ?
             WHERE id = ? AND status = 'REQUESTED'
            """,
            actor,
            requestId);
    if (changed != 1) throw withdrawalConflict("This withdrawal request has already changed.");
  }

  @Transactional
  public void confirmWithdrawal(UUID requestId, UUID actor, String providerReference) {
    if (providerReference == null || !providerReference.trim().matches("[A-Za-z0-9._-]{4,64}")) {
      throw invalidWithdrawal("Enter the M-Pesa payout reference (4 to 64 letters or numbers).");
    }
    WithdrawalState request = lockWithdrawal(requestId);
    if (!"PROCESSING".equals(request.status())) {
      throw withdrawalConflict("Only a withdrawal in progress can be marked as paid.");
    }

    UUID transactionId =
        createTransaction(
            "WITHDRAWAL", requestId, "Merchant payout " + providerReference.trim());
    if (transactionId == null) {
      throw withdrawalConflict("This withdrawal already has a ledger payment.");
    }
    UUID merchantAccount = merchantAccount(request.merchantUserId());
    UUID payoutClearing = systemAccount("PAYOUT_CLEARING");
    entry(transactionId, merchantAccount, -request.amountKes());
    entry(transactionId, payoutClearing, request.amountKes());
    int changed =
        jdbc.update(
            """
            UPDATE merchant_withdrawal_requests
               SET status = 'PAID', provider_reference = ?, resolved_at = now(),
                   resolved_by = ?, resolution_note = 'Operator recorded external M-Pesa payout.'
             WHERE id = ? AND status = 'PROCESSING'
            """,
            providerReference.trim(),
            actor,
            requestId);
    if (changed != 1) throw withdrawalConflict("This withdrawal request has already changed.");
  }

  @Transactional
  public void rejectWithdrawal(
      UUID requestId, UUID actor, String note, boolean transferNotSent) {
    if (note == null || note.isBlank() || note.trim().length() > 240) {
      throw invalidWithdrawal("Enter a reason of 1 to 240 characters.");
    }
    WithdrawalState request = lockWithdrawal(requestId);
    if ("PROCESSING".equals(request.status()) && !transferNotSent) {
      throw invalidWithdrawal(
          "Confirm that no M-Pesa transfer was sent before releasing a processing request.");
    }
    if (!List.of("REQUESTED", "PROCESSING").contains(request.status())) {
      throw withdrawalConflict("This withdrawal request can no longer be rejected.");
    }
    int changed =
        jdbc.update(
            """
            UPDATE merchant_withdrawal_requests
               SET status = 'REJECTED', resolved_at = now(), resolved_by = ?,
                   resolution_note = ?
             WHERE id = ? AND status IN ('REQUESTED', 'PROCESSING')
            """,
            actor,
            note.trim(),
            requestId);
    if (changed != 1) throw withdrawalConflict("This withdrawal request has already changed.");
  }

  private Withdrawal withdrawal(UUID merchantUserId, UUID requestId) {
    return jdbc.queryForObject(
        """
        SELECT id, amount_kes, status, '••••••' || RIGHT(payout_phone, 4) AS payout_phone,
               requested_at, resolved_at, provider_reference, resolution_note
          FROM merchant_withdrawal_requests
         WHERE id = ? AND merchant_user_id = ?
        """,
        (rs, row) ->
            new Withdrawal(
                rs.getObject("id", UUID.class),
                rs.getLong("amount_kes"),
                rs.getString("status"),
                rs.getString("payout_phone"),
                rs.getTimestamp("requested_at").toInstant(),
                null,
                rs.getString("provider_reference"),
                rs.getString("resolution_note")),
        requestId,
        merchantUserId);
  }

  private WithdrawalState lockWithdrawal(UUID requestId) {
    return jdbc.query(
            """
            SELECT merchant_user_id, amount_kes, status
              FROM merchant_withdrawal_requests WHERE id = ? FOR UPDATE
            """,
            (rs, row) ->
                new WithdrawalState(
                    rs.getObject("merchant_user_id", UUID.class),
                    rs.getLong("amount_kes"),
                    rs.getString("status")),
            requestId)
        .stream()
        .findFirst()
        .orElseThrow(
            () ->
                new MerchantWalletException(
                    "withdrawal_not_found",
                    "This withdrawal request was not found.",
                    HttpStatus.NOT_FOUND));
  }

  private static MerchantWalletException invalidWithdrawal(String message) {
    return new MerchantWalletException("withdrawal_input_invalid", message, HttpStatus.BAD_REQUEST);
  }

  private static MerchantWalletException withdrawalConflict(String message) {
    return new MerchantWalletException(
        "withdrawal_transition_invalid", message, HttpStatus.CONFLICT);
  }

  private UUID createTransaction(String referenceType, UUID referenceId, String description) {
    UUID id = UUID.randomUUID();
    int inserted =
        jdbc.update(
        """
        INSERT INTO ledger_transactions (id, reference_type, reference_id, description)
        VALUES (?, ?, ?, ?)
        ON CONFLICT (reference_type, reference_id) DO NOTHING
        """,
        id,
        referenceType,
        referenceId,
        description);
    return inserted == 1 ? id : null;
  }

  private UUID merchantAccount(UUID userId) {
    jdbc.update(
        """
        INSERT INTO wallet_accounts (owner_user_id, account_type)
        VALUES (?, 'MERCHANT_AVAILABLE')
        ON CONFLICT (owner_user_id) DO NOTHING
        """,
        userId);
    return jdbc.queryForObject(
        "SELECT id FROM wallet_accounts WHERE owner_user_id = ?",
        UUID.class,
        userId);
  }

  private UUID riderAccount(UUID userId) {
    jdbc.update(
        """
        INSERT INTO wallet_accounts (owner_user_id, account_type)
        VALUES (?, 'RIDER_AVAILABLE')
        ON CONFLICT (owner_user_id) DO NOTHING
        """,
        userId);
    return jdbc.queryForObject(
        "SELECT id FROM wallet_accounts WHERE owner_user_id = ? AND account_type = 'RIDER_AVAILABLE'",
        UUID.class,
        userId);
  }

  private UUID systemAccount(String accountType) {
    jdbc.update(
        """
        INSERT INTO wallet_accounts (owner_user_id, account_type) VALUES (NULL, ?)
        ON CONFLICT DO NOTHING
        """,
        accountType);
    return jdbc.queryForObject(
        "SELECT id FROM wallet_accounts WHERE account_type = ? AND owner_user_id IS NULL",
        UUID.class,
        accountType);
  }

  private void entry(UUID transactionId, UUID accountId, long amountKes) {
    if (amountKes != 0) {
      jdbc.update(
          "INSERT INTO ledger_entries (transaction_id, account_id, amount_kes) VALUES (?, ?, ?)",
          transactionId,
          accountId,
          amountKes);
    }
  }

  private record MerchantDestination(String payoutPhone) {}

  private record WithdrawalState(UUID merchantUserId, long amountKes, String status) {}
}
