package com.beez.admin.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import org.junit.jupiter.api.Test;

class AdminAuthenticatorTest {
  private static final String RFC_TOTP_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

  @Test
  void encryptsTotpSecretAndAcceptsCodeOnlyOncePerTimeStep() {
    AdminAuthenticator authenticator = authenticator();
    byte[] encrypted = authenticator.encryptSecret(RFC_TOTP_SECRET);
    Instant time = Instant.ofEpochSecond(59);

    long verifiedStep = authenticator.verifyCode(encrypted, "287082", time, -1);

    assertThat(verifiedStep).isEqualTo(1);
    assertThat(authenticator.verifyCode(encrypted, "287082", time, verifiedStep)).isEqualTo(-1);
  }

  @Test
  void rejectsMalformedAuthenticatorCodes() {
    AdminAuthenticator authenticator = authenticator();
    byte[] encrypted = authenticator.encryptSecret(RFC_TOTP_SECRET);

    assertThat(authenticator.verifyCode(encrypted, "12345", Instant.ofEpochSecond(59), -1))
        .isEqualTo(-1);
    assertThat(authenticator.verifyCode(encrypted, "abcdef", Instant.ofEpochSecond(59), -1))
        .isEqualTo(-1);
  }

  private static AdminAuthenticator authenticator() {
    String key =
        Base64.getEncoder()
            .encodeToString("test-admin-mfa-encryption-key-32".getBytes(StandardCharsets.UTF_8));
    return new AdminAuthenticator(key, new SecureRandom());
  }
}
