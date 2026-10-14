package com.beez.wallet.api;

import java.time.Instant;
import java.util.List;

public final class RiderEarningsModels {
  private RiderEarningsModels() {}

  public record RiderEarningsSummary(long balanceKes, long completedDeliveries, int commissionPercent) {}

  public record RiderLedgerPage(List<RiderLedgerEntry> items) {}

  public record RiderLedgerEntry(
      String type, String description, long amountKes, Instant createdAt, String basketNumber) {}
}
