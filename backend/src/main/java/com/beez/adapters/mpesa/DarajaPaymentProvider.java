package com.beez.adapters.mpesa;

import com.beez.payment.service.PaymentProviderException;
import com.beez.payment.spi.PaymentProvider;
import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class DarajaPaymentProvider implements PaymentProvider {
  private static final DateTimeFormatter DARAJA_TIMESTAMP =
      DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

  private final RestClient http;
  private final String baseUrl;
  private final String consumerKey;
  private final String consumerSecret;
  private final String businessShortCode;
  private final String passkey;
  private volatile String accessToken;
  private volatile Instant tokenExpiresAt = Instant.EPOCH;

  @Autowired
  public DarajaPaymentProvider(
      RestClient.Builder restClientBuilder,
      @Value("${beez.payment.daraja.base-url}") String baseUrl,
      @Value("${beez.payment.daraja.consumer-key:}") String consumerKey,
      @Value("${beez.payment.daraja.consumer-secret:}") String consumerSecret,
      @Value("${beez.payment.daraja.business-short-code:}") String businessShortCode,
      @Value("${beez.payment.daraja.passkey:}") String passkey) {
    this(
        restClientBuilder,
        baseUrl,
        consumerKey,
        consumerSecret,
        businessShortCode,
        passkey,
        true);
  }

  DarajaPaymentProvider(
      RestClient.Builder restClientBuilder,
      String baseUrl,
      String consumerKey,
      String consumerSecret,
      String businessShortCode,
      String passkey,
      boolean useTimeouts) {
    if (useTimeouts) {
      JdkClientHttpRequestFactory requestFactory =
          new JdkClientHttpRequestFactory(
              HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
      requestFactory.setReadTimeout(Duration.ofSeconds(15));
      restClientBuilder.requestFactory(requestFactory);
    }
    this.http = restClientBuilder.build();
    this.baseUrl = baseUrl.replaceAll("/+$", "");
    this.consumerKey = consumerKey;
    this.consumerSecret = consumerSecret;
    this.businessShortCode = businessShortCode;
    this.passkey = passkey;
  }

  @Override
  public PaymentRequest initiate(PaymentCommand command) {
    requireConfigured();
    String timestamp =
        LocalDateTime.now(ZoneId.of("Africa/Nairobi")).format(DARAJA_TIMESTAMP);
    String password = encodePassword(timestamp);
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("BusinessShortCode", businessShortCode);
    payload.put("Password", password);
    payload.put("Timestamp", timestamp);
    payload.put("TransactionType", "CustomerPayBillOnline");
    payload.put("Amount", command.amount().intValueExact());
    payload.put("PartyA", command.phoneNumber());
    payload.put("PartyB", businessShortCode);
    payload.put("PhoneNumber", command.phoneNumber());
    payload.put("CallBackURL", command.callbackUrl());
    payload.put("AccountReference", command.reference());
    payload.put("TransactionDesc", "Beez order");
    JsonNode response =
        post("/mpesa/stkpush/v1/processrequest", payload);
    String responseCode = text(response, "ResponseCode");
    String checkoutRequestId = text(response, "CheckoutRequestID");
    String merchantRequestId = text(response, "MerchantRequestID");
    if (!"0".equals(responseCode) || checkoutRequestId == null || merchantRequestId == null) {
      throw new PaymentProviderException("M-Pesa did not accept the payment request.");
    }
    return new PaymentRequest(merchantRequestId, checkoutRequestId);
  }

  @Override
  public PaymentVerification verify(String checkoutRequestId) {
    requireConfigured();
    String timestamp = LocalDateTime.now(ZoneId.of("Africa/Nairobi")).format(DARAJA_TIMESTAMP);
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("BusinessShortCode", businessShortCode);
    payload.put("Password", encodePassword(timestamp));
    payload.put("Timestamp", timestamp);
    payload.put("CheckoutRequestID", checkoutRequestId);
    JsonNode response = post("/mpesa/stkpushquery/v1/query", payload);
    String resultCode = text(response, "ResultCode");
    String resultDescription = text(response, "ResultDesc");
    if (resultCode == null) {
      throw new PaymentProviderException("M-Pesa returned an incomplete payment verification.");
    }
    try {
      return new PaymentVerification(Integer.parseInt(resultCode), safeDescription(resultDescription));
    } catch (NumberFormatException exception) {
      throw new PaymentProviderException("M-Pesa returned an invalid payment verification.");
    }
  }

  private JsonNode post(String path, Map<String, Object> body) {
    try {
      JsonNode response =
          http.post()
              .uri(baseUrl + path)
              .header(HttpHeaders.AUTHORIZATION, "Bearer " + bearerToken())
              .contentType(MediaType.APPLICATION_JSON)
              .body(body)
              .retrieve()
              .body(JsonNode.class);
      if (response == null || !response.isObject()) {
        throw new PaymentProviderException("M-Pesa returned an invalid response.");
      }
      return response;
    } catch (RestClientException exception) {
      throw new PaymentProviderException("M-Pesa is temporarily unavailable. Please try again.", exception);
    }
  }

  private String bearerToken() {
    if (accessToken != null && tokenExpiresAt.isAfter(Instant.now().plusSeconds(30))) {
      return accessToken;
    }
    synchronized (this) {
      if (accessToken != null && tokenExpiresAt.isAfter(Instant.now().plusSeconds(30))) {
        return accessToken;
      }
      String credentials =
          Base64.getEncoder()
              .encodeToString((consumerKey + ":" + consumerSecret).getBytes(StandardCharsets.UTF_8));
      try {
        JsonNode response =
            http.get()
                .uri(
                    baseUrl
                        + "/oauth/v1/generate?grant_type=client_credentials")
                .header(HttpHeaders.AUTHORIZATION, "Basic " + credentials)
                .retrieve()
                .body(JsonNode.class);
        if (response == null || !response.isObject()) {
          throw new PaymentProviderException("M-Pesa authentication returned an invalid response.");
        }
        String token = text(response, "access_token");
        if (token == null) throw new PaymentProviderException("M-Pesa authentication failed.");
        long expires = parseExpiresIn(text(response, "expires_in"));
        accessToken = token;
        tokenExpiresAt = Instant.now().plusSeconds(expires);
        return token;
      } catch (RestClientException exception) {
        throw new PaymentProviderException("M-Pesa authentication is temporarily unavailable.", exception);
      }
    }
  }

  private String encodePassword(String timestamp) {
    try {
      byte[] input =
          (businessShortCode + passkey + timestamp).getBytes(StandardCharsets.UTF_8);
      return Base64.getEncoder().encodeToString(input);
    } catch (RuntimeException exception) {
      throw new PaymentProviderException("M-Pesa payment configuration is invalid.", exception);
    }
  }

  private void requireConfigured() {
    if (consumerKey.isBlank()
        || consumerSecret.isBlank()
        || businessShortCode.isBlank()
        || passkey.isBlank()) {
      throw new PaymentProviderException("M-Pesa checkout is not configured.");
    }
  }

  private static long parseExpiresIn(String value) {
    if (value == null) {
      throw new PaymentProviderException("M-Pesa returned an invalid authentication expiry.");
    }
    try {
      long expires = Long.parseLong(value);
      if (expires < 1 || expires > 86400) {
        throw new PaymentProviderException("M-Pesa returned an invalid authentication expiry.");
      }
      return expires;
    } catch (NumberFormatException exception) {
      throw new PaymentProviderException("M-Pesa returned an invalid authentication expiry.");
    }
  }

  private static String text(JsonNode response, String field) {
    JsonNode value = response == null ? null : response.get(field);
    return value == null || value.isNull() ? null : value.asText();
  }

  private static String safeDescription(String description) {
    if (description == null) return "Payment verification completed.";
    return description.length() > 200 ? description.substring(0, 200) : description;
  }

}
