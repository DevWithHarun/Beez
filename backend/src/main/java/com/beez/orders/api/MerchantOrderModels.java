package com.beez.orders.api;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class MerchantOrderModels {
  private MerchantOrderModels() {}

  public record OrderItem(
      UUID productId, String name, int qty, int unitPriceKes, int lineTotalKes) {}

  public record MerchantOrder(
      UUID id,
      String basketNo,
      String status,
      int subtotalKes,
      Instant paidAt,
      Instant readyAt,
      String customerName,
      String customerPhone,
      String deliveryLandmark,
      String refundStatus,
      String riderName,
      String riderPhone,
      List<OrderItem> items) {}

  public record OrderPage(List<MerchantOrder> items, String nextCursor) {}

  public record OrderSummary(
      int preparingCount,
      int readyCount,
      int paidOrdersThisMonth,
      long paidMerchandiseKesThisMonth) {}

  public record TodaySummary(int paidOrdersToday, long paidMerchandiseKesToday) {}
}
