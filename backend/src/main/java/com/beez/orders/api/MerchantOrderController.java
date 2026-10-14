package com.beez.orders.api;

import static com.beez.orders.api.MerchantOrderModels.*;

import com.beez.orders.service.MerchantOrderService;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/merchants/me/orders")
public class MerchantOrderController {
  private final MerchantOrderService orders;

  public MerchantOrderController(MerchantOrderService orders) {
    this.orders = orders;
  }

  @GetMapping("/summary")
  public ResponseEntity<OrderSummary> summary(@AuthenticationPrincipal Jwt principal) {
    return noStore(orders.summary(userId(principal)));
  }

  @GetMapping
  public ResponseEntity<OrderPage> list(
      @AuthenticationPrincipal Jwt principal,
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String cursor) {
    return noStore(orders.list(userId(principal), status, cursor));
  }

  @GetMapping("/{orderId}")
  public ResponseEntity<MerchantOrder> get(
      @AuthenticationPrincipal Jwt principal, @PathVariable UUID orderId) {
    return noStore(orders.get(userId(principal), orderId));
  }

  @PatchMapping("/{orderId}/ready")
  public ResponseEntity<MerchantOrder> markReady(
      @AuthenticationPrincipal Jwt principal, @PathVariable UUID orderId) {
    return noStore(orders.markReady(userId(principal), orderId));
  }

  @PostMapping("/{orderId}/reject")
  public ResponseEntity<MerchantOrder> reject(
      @AuthenticationPrincipal Jwt principal,
      @PathVariable UUID orderId,
      @org.springframework.web.bind.annotation.RequestBody RejectOrderInput input) {
    return noStore(orders.rejectPaidOrder(userId(principal), orderId, input.reason()));
  }

  private static UUID userId(Jwt principal) {
    return UUID.fromString(principal.getSubject());
  }

  private static <T> ResponseEntity<T> noStore(T body) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
  }

  public record RejectOrderInput(String reason) {}
}
