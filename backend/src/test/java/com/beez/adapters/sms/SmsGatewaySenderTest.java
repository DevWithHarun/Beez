package com.beez.adapters.sms;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.beez.auth.service.AuthException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class SmsGatewaySenderTest {
  private static final String PRIMARY_URL =
      "https://sms.blessedtexts.com/api/sms/v1/sendsms";
  private static final String FALLBACK_URL =
      "https://api.vaspro.co.ke/v3/BulkSMS/api/create";

  @Test
  void sendsPrimaryPayloadAndNormalizesRecipient() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    server
        .expect(requestTo(PRIMARY_URL))
        .andExpect(method(HttpMethod.POST))
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
        .andExpect(
            content()
                .json(
                    """
                    {
                      "api_key": "test-api-key",
                      "sender_id": "XpressKard",
                      "phone": "254712345678",
                      "message": "Your Beez sign-in code is 123456."
                    }
                    """))
        .andRespond(
            withSuccess(
                """
                [{"status_code":"1000","message_id":"test-message"}]
                """,
                MediaType.APPLICATION_JSON));

    sender(builder).send("+254712345678", "Your Beez sign-in code is 123456.");

    server.verify();
  }

  @Test
  void fallsBackToVasProWhenPrimaryRejectsTheMessage() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    server
        .expect(requestTo(PRIMARY_URL))
        .andRespond(
            withSuccess(
                """
                {"status_code":"1001","status_desc":"Rejected"}
                """,
                MediaType.APPLICATION_JSON));
    server
        .expect(requestTo(FALLBACK_URL))
        .andExpect(method(HttpMethod.POST))
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
        .andExpect(
            content()
                .json(
                    """
                    {
                      "apiKey": "test-api-key",
                      "shortCode": "XpressKard",
                      "recipient": "254712345678",
                      "message": "Sign-in code.",
                      "callbackURL": "",
                      "enqueue": 0
                    }
                    """))
        .andRespond(withSuccess("", MediaType.APPLICATION_JSON));

    sender(builder).send("+254712345678", "Sign-in code.");

    server.verify();
  }

  @Test
  void reportsUnavailableWhenBothProvidersFail() {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    server.expect(requestTo(PRIMARY_URL)).andRespond(withServerError());
    server.expect(requestTo(FALLBACK_URL)).andRespond(withServerError());

    AuthException exception =
        assertThrows(AuthException.class, () -> sender(builder).send("+254712345678", "code"));

    assertEquals("sms_unavailable", exception.getCode());
    server.verify();
  }

  @Test
  void rejectsUntrustedEndpointsAndInvalidRecipients() {
    assertThrows(
        IllegalStateException.class,
        () ->
            new SmsGatewaySender(
                RestClient.builder(),
                "https://attacker.example/api/sms/v1/sendsms",
                FALLBACK_URL,
                "test-api-key",
                "XpressKard",
                ""));
    assertThrows(
        IllegalStateException.class,
        () ->
            new SmsGatewaySender(
                RestClient.builder(),
                PRIMARY_URL,
                "http://api.vaspro.co.ke/v3/BulkSMS/api/create",
                "test-api-key",
                "XpressKard",
                ""));

    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class,
            () -> sender(RestClient.builder()).send("0712345678", "code"));
    org.junit.jupiter.api.Assertions.assertTrue(exception.getMessage().contains("normalized"));
  }

  private static SmsGatewaySender sender(RestClient.Builder builder) {
    return new SmsGatewaySender(
        builder, PRIMARY_URL, FALLBACK_URL, "test-api-key", "XpressKard", "");
  }
}
