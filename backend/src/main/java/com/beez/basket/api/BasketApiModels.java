package com.beez.basket.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class BasketApiModels {
  private BasketApiModels() {}

  public record BasketLine(
      @NotNull UUID productId,
      @Min(1) @Max(1000) int qty) {}

  public record Customer(
      @NotBlank @Size(max = 120) String name,
      @NotBlank @Pattern(regexp = "^[+0-9\\s()-]{9,24}$") String phone) {}

  public record Delivery(
      @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") BigDecimal lat,
      @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") BigDecimal lng,
      @NotBlank @Size(max = 200) String landmark) {}

  public record BasketCreate(
      @NotNull UUID zoneId,
      @NotEmpty @Size(max = 100) List<@Valid BasketLine> lines,
      @NotNull @Valid Customer customer,
      @NotNull @Valid Delivery delivery) {}

  public record QuotedLine(
      UUID productId,
      String name,
      int qty,
      int unitPriceKes,
      int lineTotalKes,
      UUID merchantId,
      String shopName,
      String shopSlug) {}

  public record VendorSummary(
      UUID merchantId,
      String name,
      String slug,
      int subtotalKes,
      String status,
      String refundStatus) {
    public VendorSummary(UUID merchantId, String name, String slug, int subtotalKes) {
      this(merchantId, name, slug, subtotalKes, "AWAITING_PAYMENT", null);
    }
  }

  public record BasketView(
      String basketNo,
      String trackingToken,
      int itemsTotalKes,
      int deliveryFeeKes,
      int totalKes,
      String status,
      Instant expiresAt,
      List<VendorSummary> vendors,
      List<QuotedLine> lines) {}

  public record PaymentStart(UUID paymentId, String status, String message, String deliveryCode) {}
}
