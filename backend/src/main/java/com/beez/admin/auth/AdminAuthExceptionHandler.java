package com.beez.admin.auth;

import java.util.Map;
import java.util.UUID;
import com.beez.auth.service.AuthException;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(basePackages = "com.beez.admin.auth")
public class AdminAuthExceptionHandler {
  @ExceptionHandler(AdminAuthException.class)
  public ResponseEntity<Map<String, Object>> adminAuthError(AdminAuthException exception) {
    return ResponseEntity.status(exception.status())
        .cacheControl(CacheControl.noStore())
        .body(
            Map.of(
                "error", exception.code(),
                "message", exception.getMessage(),
                "details", Map.of(),
                "requestId", UUID.randomUUID().toString()));
  }

  @ExceptionHandler(AuthException.class)
  public ResponseEntity<Map<String, Object>> authInfrastructureError(AuthException exception) {
    return error(exception.getStatus(), exception.getCode(), exception.getMessage());
  }

  @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class})
  public ResponseEntity<Map<String, Object>> invalidRequest(Exception exception) {
    return error(HttpStatus.BAD_REQUEST, "request_invalid", "Check the entered information.");
  }

  private static ResponseEntity<Map<String, Object>> error(
      HttpStatus status, String code, String message) {
    return ResponseEntity.status(status)
        .cacheControl(CacheControl.noStore())
        .body(
            Map.of(
                "error", code,
                "message", message,
                "details", Map.of(),
                "requestId", UUID.randomUUID().toString()));
  }
}
