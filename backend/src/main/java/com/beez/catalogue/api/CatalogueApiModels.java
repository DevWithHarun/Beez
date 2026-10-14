package com.beez.catalogue.api;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class CatalogueApiModels {
  private CatalogueApiModels() {}

  public record ZoneView(UUID id, String name) {}

  public record ShopSummary(
      UUID id,
      String slug,
      String name,
      String category,
      UUID zoneId,
      String zoneName,
      String locationText,
      boolean isOpen) {}

  public record ProductView(
      UUID id, String name, String unit, int priceKes, boolean inStock) {}

  public record ShopPage(
      UUID id,
      String slug,
      String name,
      String category,
      UUID zoneId,
      String zoneName,
      String locationText,
      boolean isOpen,
      List<ProductView> products) {}

  public record CursorPage<T>(List<T> items, String nextCursor) {}

  public record ShopCreate(
      @NotBlank @Size(max = 120) String businessName,
      @NotBlank @Size(max = 40) String category,
      @NotNull UUID zoneId,
      @NotBlank @Size(max = 200) String locationText,
      @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") BigDecimal lat,
      @NotNull @DecimalMin("-180.0") @DecimalMax("180.0") BigDecimal lng,
      @Pattern(regexp = "^[+0-9\\s()-]{9,24}$") String payoutPhone) {}

  public record MerchantShop(
      UUID id,
      String slug,
      String businessName,
      String category,
      UUID zoneId,
      String zoneName,
      String locationText,
      String status,
      BigDecimal lat,
      BigDecimal lng,
      String payoutPhone,
      boolean isOpen,
      Map<String, BusinessHours> openingHours) {}

  public record BusinessHours(boolean open, LocalTime opensAt, LocalTime closesAt) {}

  public record AvailabilityUpdate(
      @NotNull Boolean isOpen, @Valid Map<String, BusinessHours> openingHours) {}

  public record ProductWrite(
      @NotBlank @Size(max = 120) String name,
      @Size(max = 40) String unit,
      @NotNull @Min(0) @Max(100000000) Integer priceKes,
      @NotNull Boolean inStock) {}

  public record ProductBatchWrite(@NotEmpty @Size(max = 30) List<@Valid ProductWrite> products) {}
}
