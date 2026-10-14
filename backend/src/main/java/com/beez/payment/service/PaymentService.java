package com.beez.payment.service;

import com.beez.basket.api.BasketApiModels.PaymentStart;
import com.beez.basket.api.BasketException;
import com.beez.common.KenyanMobile;
import com.beez.dispatch.service.DeliveryCodeService;
import com.beez.payment.api.PaymentCallback;
import com.beez.payment.spi.PaymentProvider;
import com.beez.payment.spi.PaymentProvider.PaymentCommand;
import com.beez.payment.spi.PaymentProvider.PaymentRequest;
import com.beez.payment.spi.PaymentProvider.PaymentVerification;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.net.URI;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class PaymentService {
  private final PaymentStore store;
  private final PaymentProvider provider;
  private final ObjectMapper objectMapper;
  private final String callbackUrl;
  private final String callbackToken;
  private final DeliveryCodeService deliveryCodes;

  @org.springframework.beans.factory.annotation.Autowired
  public PaymentService(
      PaymentStore store,
      PaymentProvider provider,
      ObjectMapper objectMapper,
      @Value("${beez.payment.daraja.callback-url:}") String callbackUrl,
      @Value("${beez.payment.daraja.callback-token:}") String callbackToken,
      DeliveryCodeService deliveryCodes) {
    this.store = store;
    this.provider = provider;
    this.objectMapper = objectMapper;
    this.callbackUrl = callbackUrl;
    this.callbackToken = callbackToken;
    this.deliveryCodes = deliveryCodes;
  }

  public PaymentStart start(String trackingToken) {
    String deliveryCode = deliveryCodes.generate(trackingToken);
    PaymentStore.PaymentAttempt attempt =
        store.prepare(trackingToken, deliveryCodes.hash(deliveryCode));
    if (!attempt.mayInitiate() || !"INITIATED".equals(attempt.status())) {
      String message =
          switch (attempt.status()) {
            case "REVIEW" ->
                "This payment needs verification before another attempt can be made.";
            case "PENDING" ->
                "A payment request is already active. Check the phone used at checkout.";
            case "SUCCEEDED" -> "This basket has already been paid.";
            case "FAILED", "TIMEOUT" ->
                "The previous payment attempt did not complete. Please wait before retrying.";
            default -> "A payment request is being processed. Check the phone used at checkout.";
          };
      return new PaymentStart(attempt.id(), attempt.status(), message, deliveryCode);
    }
    if (!validCallbackConfiguration()) {
      store.markInitiationFailed(attempt.id());
      throw new BasketException(
          "payment_unavailable",
          "M-Pesa checkout is not configured yet. Your basket has not been charged.",
          HttpStatus.SERVICE_UNAVAILABLE);
    }

    try {
      PaymentRequest request =
          provider.initiate(
              new PaymentCommand(
                  attempt.basketNo(),
                  java.math.BigDecimal.valueOf(attempt.amountKes()),
                  "KES",
                  attempt.phone(),
                  callbackUrl));
      store.markPending(attempt.id(), request.merchantRequestId(), request.checkoutRequestId());
      return new PaymentStart(
          attempt.id(),
          "PENDING",
          "Check your phone and enter your M-Pesa PIN to pay. Keep the delivery code for your rider.",
          deliveryCode);
    } catch (PaymentProviderException exception) {
      store.markInitiationUncertain(attempt.id());
      throw new BasketException(
          "payment_unavailable",
          exception.getMessage(),
          HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  public void receiveCallback(String callbackBody) {
    try {
      JsonNode root = objectMapper.readTree(callbackBody);
      PaymentCallback callback = parseCallback(root);
      store.receiveCallback(callback.checkoutRequestId(), callbackBody);
    } catch (JsonProcessingException | IllegalArgumentException exception) {
      throw new BasketException(
          "payment_callback_invalid",
          "M-Pesa sent an invalid payment notification.",
          HttpStatus.BAD_REQUEST);
    }
  }

  @Scheduled(fixedDelayString = "${beez.payment.callback-poll-interval-ms:2000}")
  public void processCallbacks() {
    for (PaymentStore.CallbackEnvelope envelope : store.pendingCallbacks()) {
      process(envelope);
    }
  }

  private void process(PaymentStore.CallbackEnvelope envelope) {
    PaymentStore.PaymentAttempt attempt = store.findForCallback(envelope.checkoutRequestId());
    if (attempt == null) {
      store.retryCallback(envelope.id(), envelope.attempts());
      return;
    }
    if ("SUCCEEDED".equals(attempt.status()) || "FAILED".equals(attempt.status())) {
      store.settle(envelope.id(), attempt, new PaymentCallback(
          attempt.merchantRequestId(), attempt.checkoutRequestId(), 0, "Already processed",
          null, null, null), "SUCCEEDED".equals(attempt.status()));
      return;
    }

    PaymentCallback callback;
    try {
      callback = parseCallback(objectMapper.readTree(envelope.payload()));
    } catch (JsonProcessingException | IllegalArgumentException exception) {
      store.markReview(envelope.id(), attempt.id());
      return;
    }
    if (!attempt.checkoutRequestId().equals(callback.checkoutRequestId())
        || !attempt.merchantRequestId().equals(callback.merchantRequestId())) {
      store.markReview(envelope.id(), attempt.id());
      return;
    }

    PaymentVerification verification;
    try {
      verification = provider.verify(attempt.checkoutRequestId());
    } catch (PaymentProviderException exception) {
      store.retryCallback(envelope.id(), envelope.attempts());
      return;
    }
    if (verification.resultCode() != callback.resultCode()) {
      store.markReview(envelope.id(), attempt.id());
      return;
    }
    if (!verification.succeeded()) {
      store.settle(envelope.id(), attempt, callback, false);
      return;
    }
    if (!validSuccessfulCallback(attempt, callback)) {
      store.markReview(envelope.id(), attempt.id());
      return;
    }
    store.settle(envelope.id(), attempt, callback, true);
  }

  private static boolean validSuccessfulCallback(
      PaymentStore.PaymentAttempt attempt, PaymentCallback callback) {
    if (callback.amount() == null
        || callback.amount() != attempt.amountKes()
        || callback.receipt() == null
        || !callback.receipt().matches("[A-Z0-9]{8,20}")
        || callback.phone() == null) return false;
    try {
      String normalized = KenyanMobile.normalize(callback.phone()).replace("+", "");
      return normalized.equals(attempt.phone().replace("+", ""));
    } catch (IllegalArgumentException exception) {
      return false;
    }
  }

  private static PaymentCallback parseCallback(JsonNode root) {
    JsonNode callback = root.path("Body").path("stkCallback");
    JsonNode resultCode = callback.get("ResultCode");
    String merchantRequestId = text(callback, "MerchantRequestID");
    String checkoutRequestId = text(callback, "CheckoutRequestID");
    if (!resultCodeIsValid(resultCode)
        || merchantRequestId == null
        || merchantRequestId.isBlank()
        || checkoutRequestId == null
        || !checkoutRequestId.matches("[A-Za-z0-9_-]{1,64}")) {
      throw new IllegalArgumentException("Invalid M-Pesa callback.");
    }

    Integer amount = null;
    String phone = null;
    String receipt = null;
    JsonNode items = callback.path("CallbackMetadata").path("Item");
    if (items.isArray()) {
      for (JsonNode item : items) {
        String name = text(item, "Name");
        JsonNode value = item.get("Value");
        if (name == null || value == null || value.isNull()) continue;
        switch (name) {
          case "Amount" -> {
            if (value.isNumber() && value.canConvertToInt()) amount = value.intValue();
          }
          case "PhoneNumber" -> phone = value.asText();
          case "MpesaReceiptNumber" -> receipt = value.asText();
          default -> {}
        }
      }
    }
    String description = text(callback, "ResultDesc");
    if (description != null && description.length() > 200) {
      description = description.substring(0, 200);
    }
    return new PaymentCallback(
        merchantRequestId,
        checkoutRequestId,
        resultCode.intValue(),
        description,
        amount,
        phone,
        receipt);
  }

  private static boolean resultCodeIsValid(JsonNode node) {
    return node != null && node.isIntegralNumber() && node.canConvertToInt();
  }

  private static String text(JsonNode node, String field) {
    JsonNode value = node.get(field);
    return value == null || value.isNull() ? null : value.asText();
  }

  public boolean isCallbackTokenValid(String receivedToken) {
    if (callbackToken.length() < 32 || receivedToken == null) return false;
    return java.security.MessageDigest.isEqual(
        callbackToken.getBytes(StandardCharsets.UTF_8),
        receivedToken.getBytes(StandardCharsets.UTF_8));
  }

  private boolean validCallbackConfiguration() {
    if (callbackToken.length() < 32 || callbackUrl.isBlank()) return false;
    try {
      URI uri = URI.create(callbackUrl);
      return "https".equalsIgnoreCase(uri.getScheme())
          && uri.getHost() != null
          && uri.getUserInfo() == null
          && uri.getQuery() == null
          && uri.getFragment() == null
          && uri.getPath() != null
          && uri.getPath().endsWith("/api/v1/payments/callback/" + callbackToken);
    } catch (IllegalArgumentException exception) {
      return false;
    }
  }
}
