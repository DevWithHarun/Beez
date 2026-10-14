package com.beez.admin.auth;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class AdminBootstrapRunner implements ApplicationRunner {
  private static final Logger LOGGER = LoggerFactory.getLogger(AdminBootstrapRunner.class);
  private final JdbcTemplate jdbc;
  private final AdminAuthenticator authenticator;
  private final PasswordEncoder passwordEncoder;
  private final String emailInput;
  private final String password;
  private final String totpSecret;

  public AdminBootstrapRunner(
      JdbcTemplate jdbc,
      AdminAuthenticator authenticator,
      PasswordEncoder passwordEncoder,
      @Value("${beez.admin.bootstrap.email:}") String email,
      @Value("${beez.admin.bootstrap.password:}") String password,
      @Value("${beez.admin.bootstrap.totp-secret:}") String totpSecret) {
    this.jdbc = jdbc;
    this.authenticator = authenticator;
    this.passwordEncoder = passwordEncoder;
    this.emailInput = email;
    this.password = password;
    this.totpSecret = totpSecret;
  }

  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    jdbc.queryForObject("SELECT id FROM admin_bootstrap_lock WHERE id = 1 FOR UPDATE", Integer.class);
    long adminCount = jdbc.queryForObject("SELECT count(*) FROM admin_accounts", Long.class);
    if (adminCount > 0) return;

    boolean emailPresent = emailInput != null && !emailInput.isBlank();
    boolean passwordPresent = password != null && !password.isBlank();
    boolean secretPresent = totpSecret != null && !totpSecret.isBlank();
    if (!emailPresent && !passwordPresent && !secretPresent) {
      LOGGER.warn(
          "Admin sign-in is disabled: no admin account exists and bootstrap credentials are not configured.");
      return;
    }
    if (!(emailPresent && passwordPresent && secretPresent)) {
      throw new IllegalStateException(
          "Configure ADMIN_BOOTSTRAP_EMAIL, ADMIN_BOOTSTRAP_PASSWORD, and ADMIN_BOOTSTRAP_TOTP_SECRET together.");
    }
    String email = emailInput.trim().toLowerCase(Locale.ROOT);
    if (email.length() > 254 || !email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
      throw new IllegalStateException("ADMIN_BOOTSTRAP_EMAIL must be a valid email address.");
    }
    if (password.length() < 12 || password.getBytes(StandardCharsets.UTF_8).length > 72) {
      throw new IllegalStateException(
          "ADMIN_BOOTSTRAP_PASSWORD must contain at least 12 characters and no more than 72 UTF-8 bytes.");
    }
    byte[] encryptedTotpSecret;
    try {
      encryptedTotpSecret = authenticator.encryptSecret(totpSecret);
    } catch (IllegalArgumentException exception) {
      throw new IllegalStateException(
          "ADMIN_BOOTSTRAP_TOTP_SECRET must be a valid Base32 secret with at least 128 bits.",
          exception);
    }

    UUID userId = UUID.randomUUID();
    jdbc.update(
        """
        INSERT INTO users
            (id, role, phone, display_name, language, status, token_version, created_at)
        VALUES (?, 'ADMIN', NULL, ?, 'en', 'ACTIVE', 0, now())
        """,
        userId,
        email);
    jdbc.update(
        """
        INSERT INTO admin_accounts (user_id, email, password_hash, totp_secret_encrypted)
        VALUES (?, ?, ?, ?)
        """,
        userId,
        email,
        passwordEncoder.encode(password),
        encryptedTotpSecret);
    LOGGER.info("Provisioned the initial admin account; subsequent bootstrap credentials are ignored.");
  }
}
