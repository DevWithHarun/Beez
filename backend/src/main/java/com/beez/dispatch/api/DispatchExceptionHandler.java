package com.beez.dispatch.api;

import java.util.Map;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class DispatchExceptionHandler {
  @ExceptionHandler(DispatchException.class)
  public ResponseEntity<Map<String, Object>> dispatchError(DispatchException exception) {
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
