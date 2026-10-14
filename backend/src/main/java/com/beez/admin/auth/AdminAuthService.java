package com.beez.admin.auth;

import static com.beez.admin.auth.AdminAuthModels.*;

import com.beez.auth.service.OtpCryptography;
import com.beez.auth.service.RateLimitService;
import java.sql.Timestamp;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminAuthService {
  private static final Duration SESSION_LIFETIME = Duration.ofHours(8);
  private static final Duration LOCKOUT = Duration.ofMinutes(15);
  private static final List<String> PILOT_PERMISSIONS =
      List.of(
          "overview:view",
          "approval:view",
          "rider:approve",
          "refund:view",
          "refund:resolve",
          "order:view",
          "payment:view",
          "withdrawal:view",
          "ledger:view",
          "user:view",
          "user:suspend",
          "audit:view");

  private final JdbcTemplate jdbc;
  private final AdminAuthenticator authenticator;
  private final PasswordEncoder passwordEncoder;
  private final RateLimitService rateLimits;
  private final OtpCryptography cryptography;
  private final JwtEncoder jwtEncoder;
  private final String issuer;
  private final String audience;
  private final String dummyPasswordHash;

  public AdminAuthService(
      JdbcTemplate jdbc,
      AdminAuthenticator authenticator,
      PasswordEncoder passwordEncoder,
      RateLimitService rateLimits,
      OtpCryptography cryptography,
      JwtEncoder jwtEncoder,
      @Value("${beez.auth.jwt-issuer}") String issuer,
      @Value("${beez.auth.jwt-audience}") String audience) {
    this.jdbc = jdbc;
    this.authenticator = authenticator;
    this.passwordEncoder = passwordEncoder;
    this.rateLimits = rateLimits;
    this.cryptography = cryptography;
    this.jwtEncoder = jwtEncoder;
    this.issuer = issuer;
    this.audience = audience;
    this.dummyPasswordHash = passwordEncoder.encode(UUID.randomUUID().toString());
  }

  @Transactional(noRollbackFor = AdminAuthException.class)
  public AdminSession login(
      String emailInput, String password, String code, String remoteAddress, String userAgent) {
    String email = normalizeEmail(emailInput);
    rateLimits.enforce(
        "admin:login:ip:" + cryptography.hashForRateLimit(remoteAddress == null ? "unknown" : remoteAddress),
        30,
        Duration.ofMinutes(15));
    rateLimits.enforce(
        "admin:login:account:" + cryptography.hashForRateLimit(email), 10, Duration.ofMinutes(15));

    AdminAccount account =
        jdbc.query(
                """
                SELECT a.user_id, a.email, a.password_hash, a.totp_secret_encrypted,
                       a.failed_login_count, a.locked_until, a.last_totp_step,
                       u.display_name, u.status, u.token_version
                  FROM admin_accounts a
                  JOIN users u ON u.id = a.user_id
                 WHERE a.email = ? AND a.enabled = true
                 FOR UPDATE OF a, u
                """,
                (rs, row) ->
                    new AdminAccount(
                        rs.getObject("user_id", UUID.class),
                        rs.getString("email"),
                        rs.getString("password_hash"),
                        rs.getBytes("totp_secret_encrypted"),
                        rs.getInt("failed_login_count"),
                        rs.getTimestamp("locked_until") == null
                            ? null
                            : rs.getTimestamp("locked_until").toInstant(),
                        rs.getLong("last_totp_step"),
                        rs.getString("display_name"),
                        rs.getString("status"),
                        rs.getInt("token_version")),
                email)
            .stream()
            .findFirst()
            .orElse(null);

    String expectedPasswordHash = account == null ? dummyPasswordHash : account.passwordHash();
    boolean passwordMatches =
        password.getBytes(StandardCharsets.UTF_8).length <= 72
            && passwordEncoder.matches(password, expectedPasswordHash);
    Instant now = Instant.now();
    if (account == null
        || !"ACTIVE".equals(account.status())
        || (account.lockedUntil() != null && account.lockedUntil().isAfter(now))
        || !passwordMatches) {
      if (account != null) incrementFailedLogin(account);
      recordLogin(account == null ? null : account.userId(), email, false, remoteAddress, userAgent);
      throw invalidCredentials();
    }

    long totpStep =
        authenticator.verifyCode(
            account.encryptedTotpSecret(), code, now, account.lastTotpStep());
    if (totpStep < 0) {
      incrementFailedLogin(account);
      recordLogin(account.userId(), email, false, remoteAddress, userAgent);
      throw invalidCredentials();
    }

    jdbc.update(
        """
        UPDATE admin_accounts
           SET failed_login_count = 0, locked_until = NULL,
               last_totp_step = ?, last_login_at = ?
         WHERE user_id = ?
        """,
        totpStep,
        Timestamp.from(now),
        account.userId());
    recordLogin(account.userId(), email, true, remoteAddress, userAgent);
    return session(account, now, now.plus(SESSION_LIFETIME));
  }

  @Transactional(noRollbackFor = AdminAuthException.class)
  public AdminSession stepUp(
      UUID userId, String code, Instant sessionExpiresAt, String remoteAddress, String userAgent) {
    rateLimits.enforce("admin:stepup:" + userId, 5, Duration.ofMinutes(15));
    AdminAccount account =
        findActiveAccountForUpdate(userId)
            .orElseThrow(
                () ->
                    new AdminAuthException(
                        "admin_session_invalid",
                        "Please sign in to the admin console again.",
                        HttpStatus.UNAUTHORIZED));
    Instant now = Instant.now();
    long totpStep =
        authenticator.verifyCode(
            account.encryptedTotpSecret(), code, now, account.lastTotpStep());
    if (totpStep < 0) {
      recordLogin(userId, account.email(), false, remoteAddress, userAgent);
      throw new AdminAuthException(
          "mfa_invalid", "That authenticator code is invalid or has already been used.", HttpStatus.UNAUTHORIZED);
    }
    if (sessionExpiresAt == null || !sessionExpiresAt.isAfter(now)) {
      throw new AdminAuthException(
          "admin_session_invalid",
          "Please sign in to the admin console again.",
          HttpStatus.UNAUTHORIZED);
    }
    jdbc.update(
        "UPDATE admin_accounts SET last_totp_step = ? WHERE user_id = ?", totpStep, userId);
    return session(account, now, sessionExpiresAt);
  }

  @Transactional
  public void logout(UUID userId) {
    int updated =
        jdbc.update(
            """
            UPDATE users
               SET token_version = token_version + 1
             WHERE id = ? AND role = 'ADMIN'
               AND EXISTS (SELECT 1 FROM admin_accounts WHERE user_id = ? AND enabled = true)
            """,
            userId,
            userId);
    if (updated != 1) {
      throw new AdminAuthException(
          "admin_session_invalid",
          "Please sign in to the admin console again.",
          HttpStatus.UNAUTHORIZED);
    }
  }

  public AdminMe me(UUID userId, Instant mfaVerifiedAt, Instant sessionExpiresAt) {
    AdminAccount account =
        findActiveAccount(userId)
            .orElseThrow(
                () ->
                    new AdminAuthException(
                        "admin_session_invalid",
                        "Please sign in to the admin console again.",
                        HttpStatus.UNAUTHORIZED));
    return new AdminMe(identity(account), mfaVerifiedAt, sessionExpiresAt);
  }

  private java.util.Optional<AdminAccount> findActiveAccountForUpdate(UUID userId) {
    return queryAccount(
        """
        SELECT a.user_id, a.email, a.password_hash, a.totp_secret_encrypted,
               a.failed_login_count, a.locked_until, a.last_totp_step,
               u.display_name, u.status, u.token_version
          FROM admin_accounts a
          JOIN users u ON u.id = a.user_id
         WHERE a.user_id = ? AND a.enabled = true AND u.role = 'ADMIN' AND u.status = 'ACTIVE'
         FOR UPDATE OF a, u
        """,
        userId);
  }

  private java.util.Optional<AdminAccount> findActiveAccount(UUID userId) {
    return queryAccount(
        """
        SELECT a.user_id, a.email, a.password_hash, a.totp_secret_encrypted,
               a.failed_login_count, a.locked_until, a.last_totp_step,
               u.display_name, u.status, u.token_version
          FROM admin_accounts a
          JOIN users u ON u.id = a.user_id
         WHERE a.user_id = ? AND a.enabled = true AND u.role = 'ADMIN' AND u.status = 'ACTIVE'
        """,
        userId);
  }

  private java.util.Optional<AdminAccount> queryAccount(String sql, UUID userId) {
    return jdbc.query(
            sql,
            (rs, row) ->
                new AdminAccount(
                    rs.getObject("user_id", UUID.class),
                    rs.getString("email"),
                    rs.getString("password_hash"),
                    rs.getBytes("totp_secret_encrypted"),
                    rs.getInt("failed_login_count"),
                    rs.getTimestamp("locked_until") == null
                        ? null
                        : rs.getTimestamp("locked_until").toInstant(),
                    rs.getLong("last_totp_step"),
                    rs.getString("display_name"),
                    rs.getString("status"),
                    rs.getInt("token_version")),
            userId)
        .stream()
        .findFirst();
  }

  private void incrementFailedLogin(AdminAccount account) {
    jdbc.update(
        """
        UPDATE admin_accounts
           SET failed_login_count = failed_login_count + 1,
               locked_until = CASE WHEN failed_login_count >= 4 THEN ? ELSE locked_until END
         WHERE user_id = ?
        """,
        Timestamp.from(Instant.now().plus(LOCKOUT)),
        account.userId());
  }

  private void recordLogin(
      UUID adminUserId, String email, boolean succeeded, String remoteAddress, String userAgent) {
    jdbc.update(
        """
        INSERT INTO admin_auth_events
            (admin_user_id, attempted_email, succeeded, remote_address, user_agent)
        VALUES (?, ?, ?, ?, ?)
        """,
        adminUserId,
        email,
        succeeded,
        limit(remoteAddress, 45),
        limit(userAgent, 255));
  }

  private AdminSession session(AdminAccount account, Instant mfaAt, Instant expiresAt) {
    JwtClaimsSet claims =
        JwtClaimsSet.builder()
            .issuer(issuer)
            .audience(List.of(audience))
            .subject(account.userId().toString())
            .issuedAt(Instant.now())
            .expiresAt(expiresAt)
            .id(UUID.randomUUID().toString())
            .claim("role", "ADMIN")
            .claim("status", "ACTIVE")
            .claim("tokenVersion", account.tokenVersion())
            .claim("mfaAt", mfaAt.getEpochSecond())
            .claim("permissions", PILOT_PERMISSIONS)
            .build();
    String token =
        jwtEncoder
            .encode(
                JwtEncoderParameters.from(
                    JwsHeader.with(MacAlgorithm.HS256).build(), claims))
            .getTokenValue();
    return new AdminSession(token, "Bearer", expiresAt, mfaAt, identity(account));
  }

  private static AdminIdentity identity(AdminAccount account) {
    return new AdminIdentity(
        account.userId(),
        account.email(),
        account.displayName() == null ? account.email() : account.displayName(),
        PILOT_PERMISSIONS);
  }

  private static String normalizeEmail(String email) {
    return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
  }

  private static String limit(String value, int maxLength) {
    if (value == null || value.isBlank()) return null;
    return value.length() <= maxLength ? value : value.substring(0, maxLength);
  }

  private static AdminAuthException invalidCredentials() {
    return new AdminAuthException(
        "admin_credentials_invalid",
        "Email, password or authenticator code is invalid.",
        HttpStatus.UNAUTHORIZED);
  }

  private record AdminAccount(
      UUID userId,
      String email,
      String passwordHash,
      byte[] encryptedTotpSecret,
      int failedLoginCount,
      Instant lockedUntil,
      long lastTotpStep,
      String displayName,
      String status,
      int tokenVersion) {}
}
