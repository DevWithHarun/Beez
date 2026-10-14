package com.beez.orders.api;

import java.util.Map;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(basePackages = "com.beez.orders.api")
public class MerchantOrderExceptionHandler {
  @ExceptionHandler(MerchantOrderException.class)
  ResponseEntity<ApiError> handle(MerchantOrderException exception) {
    String requestId = UUID.randomUUID().toString();
    return ResponseEntity.status(exception.status())
        .header("X-Request-Id", requestId)
        .cacheControl(CacheControl.noStore())
        .body(new ApiError(exception.code(), exception.getMessage(), Map.of(), requestId));
  }

  public record ApiError(
      String error, String message, Map<String, Object> details, String requestId) {}
}
