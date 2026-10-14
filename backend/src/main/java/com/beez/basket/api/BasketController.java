package com.beez.basket.api;

import static com.beez.basket.api.BasketApiModels.*;

import com.beez.basket.service.BasketService;
import com.beez.payment.service.PaymentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public/baskets")
public class BasketController {
  private final BasketService baskets;
  private final PaymentService payments;

  public BasketController(BasketService baskets, PaymentService payments) {
    this.baskets = baskets;
    this.payments = payments;
  }

  @PostMapping
  public ResponseEntity<BasketView> create(
      @Valid @RequestBody BasketCreate input,
      @RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey,
      HttpServletRequest request) {
    return noStore(
        baskets.create(input, idempotencyKey, request.getRemoteAddr()));
  }

  @GetMapping("/{trackingToken}")
  public ResponseEntity<BasketView> track(@PathVariable String trackingToken) {
    return noStore(baskets.track(trackingToken));
  }

  @PostMapping("/{trackingToken}/pay")
  public ResponseEntity<PaymentStart> startPayment(@PathVariable String trackingToken) {
    return noStore(payments.start(trackingToken));
  }

  private static <T> ResponseEntity<T> noStore(T body) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
  }
}
