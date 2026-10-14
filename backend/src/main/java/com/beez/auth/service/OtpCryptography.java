package com.beez.auth.service;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class OtpCryptography {
  private final SecretKey key;

  public OtpCryptography(@Value("${beez.auth.otp-hmac-key}") String configuredKey) {
    byte[] secret = configuredKey.getBytes(StandardCharsets.UTF_8);
    if (secret.length < 32) {
      throw new IllegalStateException("OTP_HMAC_KEY must contain at least 32 characters.");
    }
    this.key = new SecretKeySpec(secret, "HmacSHA256");
  }

  public byte[] codeHmac(UUID challengeId, String code) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(key);
      return mac.doFinal((challengeId + ":" + code).getBytes(StandardCharsets.UTF_8));
    } catch (GeneralSecurityException exception) {
      throw new IllegalStateException("HMAC-SHA256 is unavailable.", exception);
    }
  }

  public boolean matches(UUID challengeId, String code, byte[] expectedHmac) {
    return MessageDigest.isEqual(codeHmac(challengeId, code), expectedHmac);
  }

  public String hashPhoneForRateLimit(String phone) {
    return hashForRateLimit(phone);
  }

  public String hashForRateLimit(String value) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(key);
      byte[] digest =
          mac.doFinal(("rate-limit:" + value).getBytes(StandardCharsets.UTF_8));
      return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
    } catch (GeneralSecurityException exception) {
      throw new IllegalStateException("HMAC-SHA256 is unavailable.", exception);
    }
  }
}
