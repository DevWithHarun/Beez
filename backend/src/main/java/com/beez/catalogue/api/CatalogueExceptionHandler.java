package com.beez.catalogue.api;

import jakarta.validation.ConstraintViolationException;
import java.util.Map;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(basePackages = "com.beez.catalogue.api")
public class CatalogueExceptionHandler {
  @ExceptionHandler(CatalogueException.class)
  ResponseEntity<ApiError> handleCatalogueException(CatalogueException exception) {
    return error(exception.getStatus(), exception.getCode(), exception.getMessage());
  }

  @ExceptionHandler({MethodArgumentNotValidException.class, ConstraintViolationException.class})
  ResponseEntity<ApiError> handleValidation(Exception exception) {
    return error(HttpStatus.BAD_REQUEST, "request_invalid", "Check the entered information.");
  }

  @ExceptionHandler(DataIntegrityViolationException.class)
  ResponseEntity<ApiError> handleConflict(DataIntegrityViolationException exception) {
    return error(
        HttpStatus.CONFLICT,
        "resource_conflict",
        "This change conflicts with existing information. Refresh and try again.");
  }

  private static ResponseEntity<ApiError> error(HttpStatus status, String code, String message) {
    String requestId = UUID.randomUUID().toString();
    return ResponseEntity.status(status)
        .header("X-Request-Id", requestId)
        .cacheControl(CacheControl.noStore())
        .body(new ApiError(code, message, Map.of(), requestId));
  }

  public record ApiError(
      String error, String message, Map<String, Object> details, String requestId) {}
}
