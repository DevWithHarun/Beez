package com.beez.dispatch.api;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class DispatchModels {
  private DispatchModels() {}

  public record AvailabilityUpdate(boolean available) {}
  public record RiderState(boolean approved, boolean available) {}
  public record DeliveryCodeInput(String code) {}

  public record AvailableDelivery(
      UUID id, int shopCount, String zoneName, String deliveryLandmark, Instant createdAt) {}

  public record DeliveryStop(
      UUID orderId, int stopNumber, String shopName, String shopPhone, String shopLocation,
      String status) {}

  public record ActiveDelivery(
      UUID id,
      String status,
      String customerName,
      String customerPhone,
      String deliveryLandmark,
      double deliveryLat,
      double deliveryLng,
      List<DeliveryStop> stops) {}

  public record DeliveryCodeResult(String status, String message) {}
}
