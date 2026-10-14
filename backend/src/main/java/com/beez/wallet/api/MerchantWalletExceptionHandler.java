package com.beez.wallet.api;

import java.util.Map;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class MerchantWalletExceptionHandler {
  @ExceptionHandler(MerchantWalletException.class)
  public ResponseEntity<Map<String, Object>> walletError(MerchantWalletException exception) {
    return ResponseEntity.status(exception.status())
        .cacheControl(CacheControl.noStore())
        .body(
            Map.of(
                "error", exception.code(),
                "message", exception.getMessage(),
                "details", Map.of(),
                "requestId", UUID.randomUUID().toString()));
  }
}
