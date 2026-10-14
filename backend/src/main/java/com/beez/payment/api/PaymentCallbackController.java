package com.beez.payment.api;

import com.beez.payment.service.PaymentService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class PaymentCallbackController {
  private final PaymentService payments;
  private final ObjectMapper objectMapper;

  public PaymentCallbackController(
      PaymentService payments,
      ObjectMapper objectMapper) {
    this.payments = payments;
    this.objectMapper = objectMapper;
  }

  @PostMapping("/api/v1/payments/callback/{token}")
  public ResponseEntity<Map<String, Object>> callback(
      @PathVariable String token, @RequestBody JsonNode body) {
    if (!payments.isCallbackTokenValid(token)) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    }
    try {
      payments.receiveCallback(objectMapper.writeValueAsString(body));
    } catch (JsonProcessingException exception) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid payment notification.");
    }
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(Map.of("ResultCode", 0, "ResultDesc", "Accepted"));
  }
}
