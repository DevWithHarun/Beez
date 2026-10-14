package com.beez.admin.auth;

import java.time.Duration;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

@Component
public class AdminMfaPolicy {
  private static final Duration STEP_UP_WINDOW = Duration.ofMinutes(10);

  public void requireFreshStepUp(Jwt principal) {
    Number mfaAt = principal.getClaim("mfaAt");
    Instant verifiedAt = mfaAt == null ? null : Instant.ofEpochSecond(mfaAt.longValue());
    Instant now = Instant.now();
    if (verifiedAt == null
        || verifiedAt.isAfter(now)
        || !verifiedAt.plus(STEP_UP_WINDOW).isAfter(now)) {
      throw new AdminAuthException(
          "mfa_required",
          "Verify your authenticator code before continuing.",
          HttpStatus.UNAUTHORIZED);
    }
  }
}
