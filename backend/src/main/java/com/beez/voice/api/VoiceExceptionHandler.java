package com.beez.voice.api;

import java.util.Map;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(basePackages = "com.beez.voice.api")
public class VoiceExceptionHandler {
  @ExceptionHandler(VoiceException.class)
  ResponseEntity<ApiError> handleVoiceException(VoiceException exception) {
    String requestId = UUID.randomUUID().toString();
    return ResponseEntity.status(exception.getStatus())
        .header("X-Request-Id", requestId)
        .cacheControl(CacheControl.noStore())
        .body(new ApiError(exception.getCode(), exception.getMessage(), Map.of(), requestId));
  }

  public record ApiError(
      String error, String message, Map<String, Object> details, String requestId) {}
}
