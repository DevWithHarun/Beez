package com.beez.operations.api;

import java.time.Instant;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.time.Instant;
import java.util.UUID;

public final class OperationsModels {
  private OperationsModels() {}

  public record PendingRefund(
      UUID id,
      UUID orderId,
      String basketNo,
      String merchantName,
      String customerPhoneMasked,
      int amountKes,
      String reason,
      Instant requestedAt) {}

  public record PendingRider(
      UUID userId, String displayName, String phoneMasked, String area, Instant createdAt) {}

  public record OperationsSummary(
      long ordersToday,
      long paidTodayKes,
      long activeMerchants,
      long activeRiders,
      Long averageDeliveryMinutes,
      long openDeliveries,
      long failedDeliveries,
      long pendingMerchantApprovals,
      long pendingRiderApprovals,
      long paymentIssues,
      long pendingWithdrawals,
      long pendingRefunds,
      long attentionItems,
      Instant asOf) {}

  public record MerchantApplicant(
      UUID merchantId,
      UUID userId,
      String businessName,
      String category,
      String zoneName,
      String locationText,
      String ownerName,
      String ownerPhoneMasked,
      Instant createdAt) {}

  public record AdminOrder(
      UUID id,
      String basketNo,
      String merchantName,
      String customerPhoneMasked,
      String status,
      String deliveryStatus,
      int subtotalKes,
      Instant createdAt,
      Instant paidAt) {}

  public record OrderEvent(String type, String fromStatus, String toStatus, String detail, Instant createdAt) {}

  public record OrderTimeline(List<OrderEvent> items) {}

  public record AdminPayment(
      UUID id,
      String basketNo,
      String phoneMasked,
      int amountKes,
      String provider,
      String status,
      String receipt,
      String callbackStatus,
      Instant createdAt,
      Instant completedAt,
      String resultDescription) {}

  public record AdminException(
      UUID id, String type, String basketNo, String status, String detail, Instant occurredAt) {}

  public record AdminLedgerEntry(
      UUID id,
      String accountType,
      String accountOwner,
      String referenceType,
      String description,
      long amountKes,
      Instant createdAt,
      String basketNo) {}

  public record AdminUser(
      UUID id,
      String role,
      String name,
      String phoneMasked,
      String status,
      String merchantStatus,
      String riderStatus,
      Instant createdAt,
      Instant lastLoginAt) {}

  public record AuditEvent(
      UUID id,
      String actorEmail,
      String action,
      String entityType,
      UUID entityId,
      String detail,
      Instant createdAt) {}

  public record PendingRefundPage(List<PendingRefund> items) {}

  public record PendingRiderPage(List<PendingRider> items) {}

  public record OperationsSummaryResponse(OperationsSummary summary) {}

  public record MerchantApplicantPage(List<MerchantApplicant> items) {}

  public record AdminOrderPage(List<AdminOrder> items) {}

  public record AdminPaymentPage(List<AdminPayment> items) {}

  public record AdminExceptionPage(List<AdminException> items) {}

  public record AdminLedgerPage(List<AdminLedgerEntry> items) {}

  public record AdminUserPage(List<AdminUser> items) {}

  public record AuditEventPage(List<AuditEvent> items) {}

  public record MerchantDecision(@NotBlank @Size(max = 240) String reason) {}

  public record UserStatusChange(@NotBlank @Size(max = 240) String reason) {}
}
