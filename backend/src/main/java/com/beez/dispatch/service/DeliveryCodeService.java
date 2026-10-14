package com.beez.dispatch.service;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class DeliveryCodeService {
  private final byte[] secret;

  public DeliveryCodeService(
      @Value("${beez.auth.otp-hmac-key}") String configuredSecret) {
    if (configuredSecret == null || configuredSecret.length() < 32) {
      throw new IllegalStateException("Delivery code signing key must be configured.");
    }
    this.secret = configuredSecret.getBytes(StandardCharsets.UTF_8);
  }

  public String generate(String trackingToken) {
    if (trackingToken == null || trackingToken.isBlank()) {
      throw new IllegalArgumentException("A basket tracking capability is required.");
    }
    byte[] digest = sign("delivery-code-v1:" + trackingToken);
    long value = Integer.toUnsignedLong(ByteBuffer.wrap(digest).getInt());
    return "%06d".formatted(value % 1_000_000);
  }

  public byte[] hash(String code) {
    return sign(code);
  }

  private byte[] sign(String value) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(secret, "HmacSHA256"));
      return mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
    } catch (java.security.GeneralSecurityException exception) {
      throw new IllegalStateException("Delivery code signing is unavailable.", exception);
    }
  }

  public boolean matches(String code, byte[] expectedHash) {
    return code != null
        && code.matches("[0-9]{6}")
        && expectedHash != null
        && MessageDigest.isEqual(hash(code), expectedHash);
  }
}
