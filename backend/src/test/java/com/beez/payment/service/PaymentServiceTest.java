package com.beez.payment.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.beez.basket.api.BasketException;
import com.beez.dispatch.service.DeliveryCodeService;
import com.beez.payment.api.PaymentCallback;
import com.beez.payment.spi.PaymentProvider;
import com.beez.payment.spi.PaymentProvider.PaymentRequest;
import com.beez.payment.spi.PaymentProvider.PaymentVerification;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PaymentServiceTest {
  private static final String TOKEN = "0123456789abcdef0123456789abcdef";
  private static final String CALLBACK_URL =
      "https://payments.example.test/api/v1/payments/callback/" + TOKEN;
  private static final UUID PAYMENT_ID = UUID.randomUUID();
  private static final UUID BASKET_ID = UUID.randomUUID();
  private static final UUID CALLBACK_ID = UUID.randomUUID();
  private static final PaymentStore.PaymentAttempt ATTEMPT =
      new PaymentStore.PaymentAttempt(
          PAYMENT_ID,
          BASKET_ID,
          "BZ-001001",
          "+254712345678",
          245,
          "merchant-123",
          "ws_CO_123",
          "PENDING",
          Instant.now(),
          false);
  private final PaymentStore store = mock(PaymentStore.class);
  private final PaymentProvider provider = mock(PaymentProvider.class);
  private final PaymentService service =
      new PaymentService(
          store,
          provider,
          new ObjectMapper(),
          CALLBACK_URL,
          TOKEN,
          new DeliveryCodeService("0123456789abcdef0123456789abcdef"));

  @Test
  void startsPaymentAndReturnsProviderRequestState() {
    when(store.prepare(eq("tracking-capability"), any(byte[].class))).thenReturn(
        new PaymentStore.PaymentAttempt(
            PAYMENT_ID,
            BASKET_ID,
            "BZ-001001",
            "+254712345678",
            245,
            null,
            null,
            "INITIATED",
            Instant.now(),
            true));
    when(provider.initiate(any())).thenReturn(new PaymentRequest("merchant-123", "ws_CO_123"));

    var result = service.start("tracking-capability");

    assertThat(result.status()).isEqualTo("PENDING");
    assertThat(result.paymentId()).isEqualTo(PAYMENT_ID);
    assertThat(result.deliveryCode()).matches("[0-9]{6}");
    verify(store).markPending(PAYMENT_ID, "merchant-123", "ws_CO_123");
  }

  @Test
  void doesNotSendDuplicateProviderRequestWhenInitiationIsAlreadyInProgress() {
    when(store.prepare(eq("tracking-capability"), any(byte[].class)))
        .thenReturn(
            new PaymentStore.PaymentAttempt(
                PAYMENT_ID,
                BASKET_ID,
                "BZ-001001",
                "+254712345678",
                245,
                null,
                null,
                "INITIATED",
                Instant.now(),
                false));

    var result = service.start("tracking-capability");

    assertThat(result.status()).isEqualTo("INITIATED");
    assertThat(result.message()).contains("being processed");
    assertThat(result.deliveryCode()).matches("[0-9]{6}");
    verify(provider, never()).initiate(any());
  }

  @Test
  void returnsExistingFailedStateInsteadOfClaimingItIsProcessing() {
    when(store.prepare(eq("tracking-capability"), any(byte[].class)))
        .thenReturn(
            new PaymentStore.PaymentAttempt(
                PAYMENT_ID,
                BASKET_ID,
                "BZ-001001",
                "+254712345678",
                245,
                null,
                null,
                "FAILED",
                Instant.now(),
                false));

    var result = service.start("tracking-capability");

    assertThat(result.status()).isEqualTo("FAILED");
    assertThat(result.message()).contains("did not complete");
    verify(provider, never()).initiate(any());
  }

  @Test
  void onlySettlesAfterProviderVerificationAndMatchingCallbackMetadata() {
    when(store.pendingCallbacks())
        .thenReturn(
            List.of(
                new PaymentStore.CallbackEnvelope(
                    CALLBACK_ID,
                    "ws_CO_123",
                    successCallback(),
                    0)));
    when(store.findForCallback("ws_CO_123")).thenReturn(ATTEMPT);
    when(provider.verify("ws_CO_123"))
        .thenReturn(new PaymentVerification(0, "Verified by provider"));

    service.processCallbacks();

    verify(store)
        .settle(
            eq(CALLBACK_ID),
            eq(ATTEMPT),
            any(PaymentCallback.class),
            eq(true));
  }

  @Test
  void sendsMismatchedSuccessfulPaymentToReviewWithoutSettling() {
    when(store.pendingCallbacks())
        .thenReturn(
            List.of(
                new PaymentStore.CallbackEnvelope(
                    CALLBACK_ID,
                    "ws_CO_123",
                    successCallback().replace("\"Amount\",\"Value\":245", "\"Amount\",\"Value\":999"),
                    0)));
    when(store.findForCallback("ws_CO_123")).thenReturn(ATTEMPT);
    when(provider.verify("ws_CO_123"))
        .thenReturn(new PaymentVerification(0, "Verified by provider"));

    service.processCallbacks();

    verify(store).markReview(CALLBACK_ID, PAYMENT_ID);
    verify(store, never()).settle(eq(CALLBACK_ID), eq(ATTEMPT), any(), eq(true));
  }

  @Test
  void rejectsCallbackTokensThatDoNotMatch() {
    assertThat(service.isCallbackTokenValid(TOKEN)).isTrue();
    assertThat(service.isCallbackTokenValid("wrong-token")).isFalse();
  }

  @Test
  void refusesPaymentWhenCallbackIsNotConfiguredOverHttps() {
    var unconfigured =
        new PaymentService(
            store,
            provider,
            new ObjectMapper(),
            "http://localhost/callback",
            TOKEN,
            new DeliveryCodeService("0123456789abcdef0123456789abcdef"));
    when(store.prepare(eq("tracking-capability"), any(byte[].class))).thenReturn(
        new PaymentStore.PaymentAttempt(
            PAYMENT_ID,
            BASKET_ID,
            "BZ-001001",
            "+254712345678",
            245,
            null,
            null,
            "INITIATED",
            Instant.now(),
            true));

    assertThatThrownBy(() -> unconfigured.start("tracking-capability"))
        .isInstanceOf(BasketException.class)
        .hasMessageContaining("not configured");
    verify(store).markInitiationFailed(PAYMENT_ID);
    verify(provider, never()).initiate(any());
  }

  private static String successCallback() {
    return """
        {
          "Body": {
            "stkCallback": {
              "MerchantRequestID": "merchant-123",
              "CheckoutRequestID": "ws_CO_123",
              "ResultCode": 0,
              "ResultDesc": "Success",
              "CallbackMetadata": {
                "Item": [
                  {"Name":"Amount","Value":245},
                  {"Name":"MpesaReceiptNumber","Value":"QAB12CDEF3"},
                  {"Name":"PhoneNumber","Value":254712345678}
                ]
              }
            }
          }
        }
        """;
  }
}
