package com.beez.wallet.api;

import java.time.Instant;
import java.util.List;

public final class MerchantEarningsModels {
  private MerchantEarningsModels() {}

  public record EarningsSummary(long availableKes, long deliveredOrders, int commissionPercent) {}

  public record LedgerPage(List<LedgerEntry> items) {}

  public record LedgerEntry(
      String type, String description, long amountKes, Instant createdAt, String orderNumber) {}
}
