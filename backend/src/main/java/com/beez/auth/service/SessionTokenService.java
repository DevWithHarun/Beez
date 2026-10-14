package com.beez.auth.service;

import com.beez.auth.domain.RefreshToken;
import com.beez.auth.domain.UserAccount;
import com.beez.auth.repo.RefreshTokenRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SessionTokenService {
  private static final Duration ACCESS_LIFETIME = Duration.ofMinutes(15);
  private static final Duration REFRESH_LIFETIME = Duration.ofDays(60);
  private static final Duration FAMILY_LIFETIME = Duration.ofDays(180);

  private final JwtEncoder jwtEncoder;
  private final RefreshTokenRepository refreshTokens;
  private final SecureRandom secureRandom;
  private final String issuer;
  private final String audience;

  public SessionTokenService(
      JwtEncoder jwtEncoder,
      RefreshTokenRepository refreshTokens,
      SecureRandom secureRandom,
      @Value("${beez.auth.jwt-issuer}") String issuer,
      @Value("${beez.auth.jwt-audience}") String audience) {
    this.jwtEncoder = jwtEncoder;
    this.refreshTokens = refreshTokens;
    this.secureRandom = secureRandom;
    this.issuer = issuer;
    this.audience = audience;
  }

  @Transactional
  public SessionTokens create(UserAccount user, String userAgent) {
    Instant now = Instant.now();
    UUID familyId = UUID.randomUUID();
    return issue(user, familyId, now.plus(FAMILY_LIFETIME), now, userAgent);
  }

  @Transactional
  public SessionTokens rotate(
      UserAccount user, UUID familyId, Instant familyExpiresAt, String userAgent) {
    Instant now = Instant.now();
    return issue(user, familyId, familyExpiresAt, now, userAgent);
  }

  private SessionTokens issue(
      UserAccount user, UUID familyId, Instant familyExpiresAt, Instant now, String userAgent) {
    String refreshToken = randomToken();
    Instant refreshExpiresAt = min(now.plus(REFRESH_LIFETIME), familyExpiresAt);
    refreshTokens.save(
        new RefreshToken(
            user.getId(),
            familyId,
            sha256(refreshToken),
            refreshExpiresAt,
            familyExpiresAt,
            now,
            limitUserAgent(userAgent)));
    return new SessionTokens(
        createAccessToken(user, now), refreshToken, refreshExpiresAt, user);
  }

  private String createAccessToken(UserAccount user, Instant now) {
    Instant expiresAt = now.plus(ACCESS_LIFETIME);
    JwtClaimsSet claims =
        JwtClaimsSet.builder()
            .issuer(issuer)
            .audience(List.of(audience))
            .subject(user.getId().toString())
            .issuedAt(now)
            .expiresAt(expiresAt)
            .id(UUID.randomUUID().toString())
            .claim("role", user.getRole().name())
            .claim("status", user.getStatus().name())
            .claim("tokenVersion", user.getTokenVersion())
            .build();
    return jwtEncoder
        .encode(
            JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(), claims))
        .getTokenValue();
  }

  public static byte[] hashRefreshToken(String token) {
    return sha256(token);
  }

  public static long refreshMaxAgeSeconds(Instant expiresAt) {
    return Math.max(0, Duration.between(Instant.now(), expiresAt).toSeconds());
  }

  private String randomToken() {
    byte[] value = new byte[32];
    secureRandom.nextBytes(value);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(value);
  }

  private static byte[] sha256(String token) {
    try {
      return MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
    } catch (java.security.NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is unavailable.", exception);
    }
  }

  private static Instant min(Instant first, Instant second) {
    return first.isBefore(second) ? first : second;
  }

  private static String limitUserAgent(String userAgent) {
    if (userAgent == null) {
      return null;
    }
    return userAgent.length() <= 255 ? userAgent : userAgent.substring(0, 255);
  }
}
