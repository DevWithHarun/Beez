package com.beez.operations.api;

import java.util.Map;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class OperationsExceptionHandler {
  @ExceptionHandler(OperationsException.class)
  public ResponseEntity<Map<String, Object>> operationsError(OperationsException exception) {
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
