package com.beez.dispatch.api;

import static com.beez.dispatch.api.DispatchModels.*;

import com.beez.dispatch.service.DispatchService;
import java.util.List;
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
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/riders/me")
public class DispatchController {
  private final DispatchService dispatch;

  public DispatchController(DispatchService dispatch) {
    this.dispatch = dispatch;
  }

  @GetMapping("/status")
  public ResponseEntity<RiderState> status(@AuthenticationPrincipal Jwt principal) {
    return noStore(dispatch.state(userId(principal)));
  }

  @PatchMapping("/availability")
  public ResponseEntity<Void> availability(
      @AuthenticationPrincipal Jwt principal, @RequestBody AvailabilityUpdate input) {
    dispatch.setAvailability(userId(principal), input.available());
    return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
  }

  @GetMapping("/deliveries/available")
  public ResponseEntity<List<AvailableDelivery>> available(
      @AuthenticationPrincipal Jwt principal) {
    return noStore(dispatch.availableDeliveries(userId(principal)));
  }

  @GetMapping("/deliveries/active")
  public ResponseEntity<ActiveDelivery> active(@AuthenticationPrincipal Jwt principal) {
    return noStore(dispatch.active(userId(principal)));
  }

  @PostMapping("/deliveries/{deliveryId}/claim")
  public ResponseEntity<ActiveDelivery> claim(
      @AuthenticationPrincipal Jwt principal, @PathVariable UUID deliveryId) {
    return noStore(dispatch.claim(userId(principal), deliveryId));
  }

  @PostMapping("/deliveries/{deliveryId}/stops/{orderId}/pickup")
  public ResponseEntity<ActiveDelivery> confirmPickup(
      @AuthenticationPrincipal Jwt principal,
      @PathVariable UUID deliveryId,
      @PathVariable UUID orderId) {
    return noStore(dispatch.confirmPickup(userId(principal), deliveryId, orderId));
  }

  @PostMapping("/deliveries/{deliveryId}/confirm")
  public ResponseEntity<DeliveryCodeResult> confirmDelivery(
      @AuthenticationPrincipal Jwt principal,
      @PathVariable UUID deliveryId,
      @RequestBody DeliveryCodeInput input) {
    return noStore(dispatch.confirmDelivery(userId(principal), deliveryId, input.code()));
  }

  private static UUID userId(Jwt principal) {
    return UUID.fromString(principal.getSubject());
  }

  private static <T> ResponseEntity<T> noStore(T body) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
  }
}
