package com.beez.basket.api;

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

@RestControllerAdvice(basePackages = "com.beez.basket.api")
public class BasketExceptionHandler {
  @ExceptionHandler(BasketException.class)
  ResponseEntity<ApiError> handleBasketException(BasketException exception) {
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
        "basket_conflict",
        "This basket request has already been processed. Refresh your basket and try again.");
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
