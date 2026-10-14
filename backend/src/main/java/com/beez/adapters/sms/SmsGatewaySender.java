package com.beez.adapters.sms;

import com.beez.auth.service.AuthException;
import com.beez.auth.spi.SmsSender;
import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Component
@Profile({"prod", "sandbox"})
public class SmsGatewaySender implements SmsSender {
  private static final Logger LOGGER = LoggerFactory.getLogger(SmsGatewaySender.class);
  private static final String PRIMARY_PATH = "/api/sms/v1/sendsms";
  private static final String FALLBACK_PATH = "/v3/BulkSMS/api/create";

  private final RestClient client;
  private final String primaryUrl;
  private final String fallbackUrl;
  private final String apiKey;
  private final String senderId;
  private final String callbackUrl;

  public SmsGatewaySender(
      RestClient.Builder restClientBuilder,
      @Value("${beez.sms.gateway.primary-url}") String primaryUrl,
      @Value("${beez.sms.gateway.fallback-url}") String fallbackUrl,
      @Value("${beez.sms.gateway.api-key}") String apiKey,
      @Value("${beez.sms.gateway.sender-id}") String senderId,
      @Value("${beez.sms.gateway.callback-url:}") String callbackUrl) {
    if (apiKey == null || apiKey.isBlank() || senderId == null || senderId.isBlank()) {
      throw new IllegalStateException("SMS gateway API key and sender ID must be configured.");
    }
    validateApiUrl(primaryUrl, "sms.blessedtexts.com", PRIMARY_PATH);
    validateApiUrl(fallbackUrl, "api.vaspro.co.ke", FALLBACK_PATH);
    this.client = restClientBuilder.build();
    this.primaryUrl = primaryUrl;
    this.fallbackUrl = fallbackUrl;
    this.apiKey = apiKey;
    this.senderId = senderId;
    this.callbackUrl = callbackUrl;
  }

  @Override
  public void send(String phoneNumber, String message) {
    if (phoneNumber == null || !phoneNumber.matches("\\+254[17][0-9]{8}")) {
      throw new IllegalArgumentException("SMS recipient must be a normalized Kenyan mobile number.");
    }
    if (message == null || message.isBlank()) {
      throw new IllegalArgumentException("SMS message must not be blank.");
    }

    String recipient = phoneNumber.substring(1);
    if (sendPrimary(recipient, message)) {
      return;
    }
    if (sendFallback(recipient, message)) {
      return;
    }
    throw smsUnavailable();
  }

  private boolean sendPrimary(String recipient, String message) {
    Map<String, String> payload =
        Map.of(
            "api_key", apiKey,
            "sender_id", senderId,
            "phone", recipient,
            "message", message);
    try {
      JsonNode response =
          client
              .post()
              .uri(primaryUrl)
              .contentType(MediaType.APPLICATION_JSON)
              .body(payload)
              .retrieve()
              .body(JsonNode.class);
      JsonNode result = response == null ? null : response.isArray() ? response.path(0) : response;
      if (result == null) {
        LOGGER.warn("SMS provider BlessedTexts returned an empty response");
        return false;
      }
      String statusCode = result.path("status_code").asText();
      if (!"1000".equals(statusCode)) {
        String safeStatusCode = statusCode.matches("[0-9]{1,10}") ? statusCode : "unrecognized";
        LOGGER.warn("SMS provider BlessedTexts rejected the message with status code {}", safeStatusCode);
        return false;
      }
      return true;
    } catch (RestClientException exception) {
      logRequestFailure("BlessedTexts", exception);
      return false;
    }
  }

  private boolean sendFallback(String recipient, String message) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("apiKey", apiKey);
    payload.put("shortCode", senderId);
    payload.put("recipient", recipient);
    payload.put("message", message);
    payload.put("callbackURL", callbackUrl);
    payload.put("enqueue", 0);
    try {
      client
          .post()
          .uri(fallbackUrl)
          .contentType(MediaType.APPLICATION_JSON)
          .body(payload)
          .retrieve()
          .toBodilessEntity();
      return true;
    } catch (RestClientException exception) {
      logRequestFailure("VasPro", exception);
      return false;
    }
  }

  private static void logRequestFailure(String provider, RestClientException exception) {
    if (exception instanceof RestClientResponseException responseException) {
      LOGGER.warn(
          "SMS provider {} returned HTTP status {}",
          provider,
          responseException.getStatusCode().value());
    } else {
      LOGGER.warn(
          "SMS provider {} request failed with {}",
          provider,
          exception.getClass().getSimpleName());
    }
  }

  private static void validateApiUrl(String value, String allowedHost, String expectedPath) {
    try {
      URI uri = URI.create(value);
      if (!"https".equalsIgnoreCase(uri.getScheme())
          || !allowedHost.equalsIgnoreCase(uri.getHost())
          || uri.getUserInfo() != null
          || uri.getPort() != -1
          || !expectedPath.equals(uri.getPath())
          || uri.getQuery() != null
          || uri.getFragment() != null) {
        throw new IllegalStateException("SMS gateway URL must use its configured HTTPS endpoint.");
      }
    } catch (IllegalArgumentException exception) {
      throw new IllegalStateException("SMS gateway URL is invalid.", exception);
    }
  }

  private static AuthException smsUnavailable() {
    return new AuthException(
        "sms_unavailable",
        "We couldn't send a code right now. Please try again later.",
        HttpStatus.SERVICE_UNAVAILABLE);
  }
}
