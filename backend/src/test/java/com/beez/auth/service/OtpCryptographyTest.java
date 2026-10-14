package com.beez.auth.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;
import org.junit.jupiter.api.Test;

class OtpCryptographyTest {
  private final OtpCryptography cryptography =
      new OtpCryptography("unit-test-secret-that-is-long-enough");

  @Test
  void bindsTheCodeToItsChallenge() {
    UUID challengeId = UUID.randomUUID();
    byte[] digest = cryptography.codeHmac(challengeId, "002741");

    assertTrue(cryptography.matches(challengeId, "002741", digest));
    assertFalse(cryptography.matches(challengeId, "002742", digest));
    assertFalse(cryptography.matches(UUID.randomUUID(), "002741", digest));
  }
}
