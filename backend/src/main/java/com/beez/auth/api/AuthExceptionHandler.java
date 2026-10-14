package com.beez.auth.api;

import com.beez.auth.service.AuthException;
import com.fasterxml.jackson.databind.exc.InvalidFormatException;
import java.util.Map;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(basePackages = "com.beez.auth.api")
public class AuthExceptionHandler {
  @ExceptionHandler(AuthException.class)
  ResponseEntity<ApiError> handleAuthException(AuthException exception) {
    return error(exception.getStatus(), exception.getCode(), exception.getMessage());
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException exception) {
    return error(HttpStatus.BAD_REQUEST, "request_invalid", "Check the entered information.");
  }

  @ExceptionHandler(HttpMessageNotReadableException.class)
  ResponseEntity<ApiError> handleUnreadable(HttpMessageNotReadableException exception) {
    String message =
        exception.getCause() instanceof InvalidFormatException
            ? "Check the entered information."
            : "The request body is invalid.";
    return error(HttpStatus.BAD_REQUEST, "request_invalid", message);
  }

  @ExceptionHandler(DataIntegrityViolationException.class)
  ResponseEntity<ApiError> handleConflict(DataIntegrityViolationException exception) {
    return error(
        HttpStatus.CONFLICT,
        "account_conflict",
        "This sign-in could not be completed. Please request a new code.");
  }

  private static ResponseEntity<ApiError> error(
      HttpStatus status, String code, String message) {
    String requestId = UUID.randomUUID().toString();
    return ResponseEntity.status(status)
        .header("X-Request-Id", requestId)
        .cacheControl(CacheControl.noStore())
        .body(new ApiError(code, message, Map.of(), requestId));
  }

  public record ApiError(
      String error, String message, Map<String, Object> details, String requestId) {}
}
