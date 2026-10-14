package com.beez.adapters.mpesa;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.beez.payment.service.PaymentProviderException;
import com.beez.payment.spi.PaymentProvider.PaymentCommand;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class DarajaPaymentProviderTest {
  private static final String BASE_URL = "https://sandbox.safaricom.co.ke";

  @Test
  void initiatesAndVerifiesPaymentUsingCachedOAuthToken() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    server
        .expect(requestTo(BASE_URL + "/oauth/v1/generate?grant_type=client_credentials"))
        .andExpect(method(HttpMethod.GET))
        .andExpect(header(HttpHeaders.AUTHORIZATION, org.hamcrest.Matchers.startsWith("Basic ")))
        .andRespond(withSuccess(
            """
            {"access_token":"test-access-token","expires_in":"3599"}
            """,
            MediaType.APPLICATION_JSON));
    server
        .expect(requestTo(BASE_URL + "/mpesa/stkpush/v1/processrequest"))
        .andExpect(method(HttpMethod.POST))
        .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer test-access-token"))
        .andExpect(content().string(org.hamcrest.Matchers.containsString("\"Amount\":245")))
        .andExpect(content().string(org.hamcrest.Matchers.containsString("\"AccountReference\":\"BZ-001001\"")))
        .andRespond(withSuccess(
            """
            {
              "ResponseCode":"0",
              "MerchantRequestID":"merchant-123",
              "CheckoutRequestID":"ws_CO_123"
            }
            """,
            MediaType.APPLICATION_JSON));
    server
        .expect(requestTo(BASE_URL + "/mpesa/stkpushquery/v1/query"))
        .andExpect(method(HttpMethod.POST))
        .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer test-access-token"))
        .andExpect(content().string(org.hamcrest.Matchers.containsString("\"CheckoutRequestID\":\"ws_CO_123\"")))
        .andRespond(withSuccess(
            """
            {"ResultCode":"0","ResultDesc":"The service request is processed successfully."}
            """,
            MediaType.APPLICATION_JSON));
    var provider =
        new DarajaPaymentProvider(
            builder, BASE_URL, "consumer-key", "consumer-secret", "174379", "test-passkey", false);

    var request =
        provider.initiate(
            new PaymentCommand(
                "BZ-001001",
                BigDecimal.valueOf(245),
                "KES",
                "+254712345678",
                "https://example.test/callback"));
    var verification = provider.verify(request.checkoutRequestId());

    assertThat(request.merchantRequestId()).isEqualTo("merchant-123");
    assertThat(request.checkoutRequestId()).isEqualTo("ws_CO_123");
    assertThat(verification.succeeded()).isTrue();
    server.verify();
  }

  @Test
  void rejectsCheckoutWhenCredentialsAreNotConfigured() {
    var provider =
        new DarajaPaymentProvider(RestClient.builder(), BASE_URL, "", "", "", "", false);

    assertThatThrownBy(
            () ->
                provider.initiate(
                    new PaymentCommand(
                        "BZ-001001",
                        BigDecimal.TEN,
                        "KES",
                        "+254712345678",
                        "https://example.test/callback")))
        .isInstanceOf(PaymentProviderException.class)
        .hasMessage("M-Pesa checkout is not configured.");
  }

  @Test
  void rejectsOAuthResponsesWithoutAValidExpiry() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    server
        .expect(requestTo(BASE_URL + "/oauth/v1/generate?grant_type=client_credentials"))
        .andRespond(
            withSuccess(
                """
                {"access_token":"test-access-token","expires_in":"unknown"}
                """,
                MediaType.APPLICATION_JSON));
    var provider =
        new DarajaPaymentProvider(
            builder, BASE_URL, "consumer-key", "consumer-secret", "174379", "test-passkey", false);

    assertThatThrownBy(
            () ->
                provider.initiate(
                    new PaymentCommand(
                        "BZ-001001",
                        BigDecimal.TEN,
                        "KES",
                        "+254712345678",
                        "https://example.test/callback")))
        .isInstanceOf(PaymentProviderException.class)
        .hasMessage("M-Pesa returned an invalid authentication expiry.");
    server.verify();
  }
}
