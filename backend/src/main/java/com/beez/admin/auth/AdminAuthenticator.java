package com.beez.admin.auth;

import java.nio.ByteBuffer;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Arrays;
import java.util.Base64;
import java.util.Locale;
import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class AdminAuthenticator {
  private static final String BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  private static final int TOTP_PERIOD_SECONDS = 30;
  private final byte[] encryptionKey;
  private final SecureRandom secureRandom;

  public AdminAuthenticator(
      @Value("${beez.admin.mfa-encryption-key:}") String configuredKey,
      SecureRandom secureRandom) {
    this.secureRandom = secureRandom;
    if (configuredKey == null || configuredKey.isBlank()) {
      this.encryptionKey = null;
      return;
    }
    try {
      this.encryptionKey = Base64.getDecoder().decode(configuredKey);
    } catch (IllegalArgumentException exception) {
      throw new IllegalStateException(
          "ADMIN_MFA_ENCRYPTION_KEY must be a base64-encoded 32-byte key.", exception);
    }
    if (encryptionKey.length != 32) {
      throw new IllegalStateException("ADMIN_MFA_ENCRYPTION_KEY must decode to exactly 32 bytes.");
    }
  }

  public byte[] encryptSecret(String secret) {
    byte[] plainText = decodeBase32(secret);
    byte[] nonce = new byte[12];
    secureRandom.nextBytes(nonce);
    try {
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(
          Cipher.ENCRYPT_MODE,
          new SecretKeySpec(requireEncryptionKey(), "AES"),
          new GCMParameterSpec(128, nonce));
      byte[] encrypted = cipher.doFinal(plainText);
      return ByteBuffer.allocate(nonce.length + encrypted.length).put(nonce).put(encrypted).array();
    } catch (GeneralSecurityException exception) {
      throw new IllegalStateException("Admin authenticator secret encryption failed.", exception);
    } finally {
      Arrays.fill(plainText, (byte) 0);
    }
  }

  public long verifyCode(byte[] encryptedSecret, String inputCode, Instant now, long lastUsedStep) {
    if (inputCode == null || !inputCode.matches("[0-9]{6}")) {
      return -1;
    }
    byte[] secret = decryptSecret(encryptedSecret);
    try {
      long currentStep = now.getEpochSecond() / TOTP_PERIOD_SECONDS;
      for (long step = currentStep + 1; step >= currentStep - 1; step--) {
        if (step <= lastUsedStep) continue;
        byte[] expected = totp(secret, step);
        byte[] supplied = inputCode.getBytes(java.nio.charset.StandardCharsets.US_ASCII);
        if (MessageDigest.isEqual(expected, supplied)) return step;
      }
      return -1;
    } finally {
      Arrays.fill(secret, (byte) 0);
    }
  }

  private byte[] decryptSecret(byte[] encryptedSecret) {
    if (encryptedSecret == null || encryptedSecret.length < 29) {
      throw new IllegalStateException("The stored admin authenticator secret is invalid.");
    }
    byte[] nonce = Arrays.copyOfRange(encryptedSecret, 0, 12);
    byte[] cipherText = Arrays.copyOfRange(encryptedSecret, 12, encryptedSecret.length);
    try {
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(
          Cipher.DECRYPT_MODE,
          new SecretKeySpec(requireEncryptionKey(), "AES"),
          new GCMParameterSpec(128, nonce));
      return cipher.doFinal(cipherText);
    } catch (GeneralSecurityException exception) {
      throw new IllegalStateException(
          "Could not decrypt the admin authenticator secret; check ADMIN_MFA_ENCRYPTION_KEY.",
          exception);
    }
  }

  private static byte[] totp(byte[] secret, long step) {
    try {
      Mac hmac = Mac.getInstance("HmacSHA1");
      hmac.init(new SecretKeySpec(secret, "HmacSHA1"));
      byte[] digest = hmac.doFinal(ByteBuffer.allocate(Long.BYTES).putLong(step).array());
      int offset = digest[digest.length - 1] & 0x0f;
      int binary =
          ((digest[offset] & 0x7f) << 24)
              | ((digest[offset + 1] & 0xff) << 16)
              | ((digest[offset + 2] & 0xff) << 8)
              | (digest[offset + 3] & 0xff);
      String code = String.format(Locale.ROOT, "%06d", binary % 1_000_000);
      return code.getBytes(java.nio.charset.StandardCharsets.US_ASCII);
    } catch (GeneralSecurityException exception) {
      throw new IllegalStateException("TOTP verification is unavailable.", exception);
    }
  }

  private static byte[] decodeBase32(String value) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException("Enter a Base32 authenticator secret.");
    }
    String normalized = value.replace(" ", "").replace("=", "").toUpperCase(Locale.ROOT);
    int bitCount = 0;
    int buffer = 0;
    byte[] result = new byte[normalized.length() * 5 / 8];
    int resultIndex = 0;
    for (int index = 0; index < normalized.length(); index++) {
      int digit = BASE32_ALPHABET.indexOf(normalized.charAt(index));
      if (digit < 0) throw new IllegalArgumentException("Authenticator secret must use Base32.");
      buffer = (buffer << 5) | digit;
      bitCount += 5;
      if (bitCount >= 8) {
        result[resultIndex++] = (byte) (buffer >> (bitCount - 8));
        bitCount -= 8;
      }
    }
    byte[] decoded = Arrays.copyOf(result, resultIndex);
    Arrays.fill(result, (byte) 0);
    if (decoded.length < 16) {
      Arrays.fill(decoded, (byte) 0);
      throw new IllegalArgumentException("Authenticator secret must be at least 128 bits.");
    }
    return decoded;
  }

  private byte[] requireEncryptionKey() {
    if (encryptionKey == null) {
      throw new IllegalStateException(
          "Set ADMIN_MFA_ENCRYPTION_KEY before provisioning or signing in to an admin account.");
    }
    return encryptionKey;
  }
}
