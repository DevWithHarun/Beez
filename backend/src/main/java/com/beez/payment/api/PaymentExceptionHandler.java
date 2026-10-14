package com.beez.payment.api;

import com.beez.basket.api.BasketException;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(basePackages = "com.beez.payment.api")
public class PaymentExceptionHandler {
  @ExceptionHandler(BasketException.class)
  ResponseEntity<ApiError> handleBasketException(BasketException exception) {
    String requestId = UUID.randomUUID().toString();
    return ResponseEntity.status(exception.getStatus())
        .header("X-Request-Id", requestId)
        .cacheControl(CacheControl.noStore())
        .body(new ApiError(exception.getCode(), exception.getMessage(), Map.of(), requestId));
  }

  public record ApiError(
      String error, String message, Map<String, Object> details, String requestId) {}
}
