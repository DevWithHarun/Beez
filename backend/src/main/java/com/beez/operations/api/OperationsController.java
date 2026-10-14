package com.beez.operations.api;

import static com.beez.operations.api.OperationsModels.*;
import static com.beez.wallet.api.WithdrawalModels.*;

import com.beez.admin.auth.AdminMfaPolicy;
import com.beez.operations.service.OperationsService;
import jakarta.validation.Valid;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/operations")
public class OperationsController {
  private final OperationsService operations;
  private final AdminMfaPolicy mfaPolicy;

  public OperationsController(OperationsService operations, AdminMfaPolicy mfaPolicy) {
    this.operations = operations;
    this.mfaPolicy = mfaPolicy;
  }

  @GetMapping("/dashboard")
  public ResponseEntity<OperationsSummary> dashboard(@AuthenticationPrincipal Jwt principal) {
    return noStore(operations.operationsSummary(userId(principal)));
  }

  @GetMapping("/merchants/pending")
  public ResponseEntity<MerchantApplicantPage> pendingMerchants(
      @AuthenticationPrincipal Jwt principal) {
    return noStore(operations.pendingMerchants(userId(principal)));
  }

  @PostMapping("/merchants/{merchantId}/approve")
  public ResponseEntity<Void> approveMerchant(
      @AuthenticationPrincipal Jwt principal,
      @PathVariable UUID merchantId,
      @Valid @RequestBody MerchantDecision input) {
    mfaPolicy.requireFreshStepUp(principal);
    operations.decideMerchant(userId(principal), merchantId, true, input.reason());
    return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
  }

  @PostMapping("/merchants/{merchantId}/reject")
  public ResponseEntity<Void> rejectMerchant(
      @AuthenticationPrincipal Jwt principal,
      @PathVariable UUID merchantId,
      @Valid @RequestBody MerchantDecision input) {
    mfaPolicy.requireFreshStepUp(principal);
    operations.decideMerchant(userId(principal), merchantId, false, input.reason());
    return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
  }

  @GetMapping("/orders")
  public ResponseEntity<AdminOrderPage> orders(@AuthenticationPrincipal Jwt principal) {
    return noStore(operations.orders(userId(principal)));
  }

  @GetMapping("/orders/{orderId}/timeline")
  public ResponseEntity<OrderTimeline> orderTimeline(
      @AuthenticationPrincipal Jwt principal, @PathVariable UUID orderId) {
    return noStore(operations.orderTimeline(userId(principal), orderId));
  }

  @GetMapping("/payments")
  public ResponseEntity<AdminPaymentPage> payments(@AuthenticationPrincipal Jwt principal) {
    return noStore(operations.payments(userId(principal)));
  }

  @GetMapping("/exceptions")
  public ResponseEntity<AdminExceptionPage> exceptions(@AuthenticationPrincipal Jwt principal) {
    return noStore(operations.exceptions(userId(principal)));
  }

  @GetMapping("/ledger")
  public ResponseEntity<AdminLedgerPage> ledger(@AuthenticationPrincipal Jwt principal) {
    return noStore(operations.ledger(userId(principal)));
  }

  @GetMapping("/users")
  public ResponseEntity<AdminUserPage> users(
      @AuthenticationPrincipal Jwt principal,
      @RequestParam(required = false) String query) {
    return noStore(operations.users(userId(principal), query));
  }

  @PostMapping("/users/{userId}/suspend")
  public ResponseEntity<Void> suspendUser(
      @AuthenticationPrincipal Jwt principal,
      @PathVariable UUID userId,
      @Valid @RequestBody UserStatusChange input) {
    mfaPolicy.requireFreshStepUp(principal);
    operations.suspendUser(userId(principal), userId, input.reason());
    return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
  }

  @PostMapping("/users/{userId}/restore")
  public ResponseEntity<Void> restoreUser(
      @AuthenticationPrincipal Jwt principal,
      @PathVariable UUID userId,
      @Valid @RequestBody UserStatusChange input) {
    mfaPolicy.requireFreshStepUp(principal);
    operations.restoreUser(userId(principal), userId, input.reason());
    return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
  }

  @PostMapping("/users/{userId}/logout-all")
  public ResponseEntity<Void> logoutUserSessions(
      @AuthenticationPrincipal Jwt principal,
      @PathVariable UUID userId,
      @Valid @RequestBody UserStatusChange input) {
    mfaPolicy.requireFreshStepUp(principal);
    operations.logoutUserSessions(userId(principal), userId, input.reason());
    return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
  }

  @GetMapping("/audit")
  public ResponseEntity<AuditEventPage> audit(
      @AuthenticationPrincipal Jwt principal,
      @RequestParam(required = false) String query) {
    return noStore(operations.audit(userId(principal), query));
  }

  @GetMapping("/refunds/pending")
  public ResponseEntity<PendingRefundPage> pendingRefunds(@AuthenticationPrincipal Jwt principal) {
    return noStore(operations.pendingRefunds(userId(principal)));
  }

  @PostMapping("/refunds/{requestId}/confirm")
  public ResponseEntity<Void> confirmRefund(
      @AuthenticationPrincipal Jwt principal,
      @PathVariable UUID requestId,
      @RequestBody RefundConfirmation input) {
    mfaPolicy.requireFreshStepUp(principal);
    operations.confirmRefund(userId(principal), requestId, input.providerReference());
    return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
  }

  @PostMapping("/refunds/{requestId}/fail")
  public ResponseEntity<Void> failRefund(
      @AuthenticationPrincipal Jwt principal,
      @PathVariable UUID requestId,
      @RequestBody RefundFailure input) {
    mfaPolicy.requireFreshStepUp(principal);
    operations.markRefundFailed(userId(principal), requestId, input.note());
    return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
  }

  @GetMapping("/riders/pending")
  public ResponseEntity<PendingRiderPage> pendingRiders(@AuthenticationPrincipal Jwt principal) {
    return noStore(operations.pendingRiders(userId(principal)));
  }

  @GetMapping("/withdrawals/pending")
  public ResponseEntity<PendingWithdrawalPage> pendingWithdrawals(
      @AuthenticationPrincipal Jwt principal) {
    return noStore(operations.pendingWithdrawals(userId(principal)));
  }

  @PostMapping("/withdrawals/{requestId}/start")
  public ResponseEntity<Void> startWithdrawal(
      @AuthenticationPrincipal Jwt principal, @PathVariable UUID requestId) {
    mfaPolicy.requireFreshStepUp(principal);
    operations.startWithdrawal(userId(principal), requestId);
    return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
  }

  @PostMapping("/withdrawals/{requestId}/confirm")
  public ResponseEntity<Void> confirmWithdrawal(
      @AuthenticationPrincipal Jwt principal,
      @PathVariable UUID requestId,
      @Valid @RequestBody WithdrawalResolution input) {
    mfaPolicy.requireFreshStepUp(principal);
    operations.confirmWithdrawal(userId(principal), requestId, input.providerReference());
    return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
  }

  @PostMapping("/withdrawals/{requestId}/fail")
  public ResponseEntity<Void> rejectWithdrawal(
      @AuthenticationPrincipal Jwt principal,
      @PathVariable UUID requestId,
      @Valid @RequestBody WithdrawalRejection input) {
    mfaPolicy.requireFreshStepUp(principal);
    operations.rejectWithdrawal(
        userId(principal), requestId, input.note(), input.transferNotSent());
    return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
  }

  @PatchMapping("/riders/{riderUserId}/approve")
  public ResponseEntity<Void> approveRider(
      @AuthenticationPrincipal Jwt principal, @PathVariable UUID riderUserId) {
    mfaPolicy.requireFreshStepUp(principal);
    operations.approveRider(userId(principal), riderUserId);
    return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
  }

  private static UUID userId(Jwt principal) {
    return UUID.fromString(principal.getSubject());
  }

  private static <T> ResponseEntity<T> noStore(T body) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
  }

  public record RefundConfirmation(String providerReference) {}
  public record RefundFailure(String note) {}
}
