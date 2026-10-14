package com.beez.wallet.api;

import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class WithdrawalModels {
  private WithdrawalModels() {}

  public record WithdrawalRequest(@Positive long amountKes) {}

  public record Withdrawal(
      UUID id,
      long amountKes,
      String status,
      String payoutPhone,
      Instant requestedAt,
      Instant resolvedAt,
      String providerReference,
      String resolutionNote) {}

  public record WithdrawalPage(List<Withdrawal> items) {}

  public record PendingWithdrawal(
      UUID id,
      UUID merchantUserId,
      String merchantName,
      String businessName,
      String payoutPhone,
      long amountKes,
      String status,
      Instant requestedAt,
      Instant processingAt,
      String processingBy,
      String providerReference) {}

  public record PendingWithdrawalPage(List<PendingWithdrawal> items) {}

  public record WithdrawalResolution(
      @NotBlank @Pattern(regexp = "[A-Za-z0-9._-]{4,64}") String providerReference) {}

  public record WithdrawalRejection(
      @NotBlank @Size(max = 240) String note, boolean transferNotSent) {}
}
