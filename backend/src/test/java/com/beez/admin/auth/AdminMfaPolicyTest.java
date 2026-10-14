package com.beez.admin.auth;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

class AdminMfaPolicyTest {
  private final AdminMfaPolicy policy = new AdminMfaPolicy();

  @Test
  void rejectsMissingOrExpiredStepUp() {
    Jwt withoutMfa = mock(Jwt.class);
    when(withoutMfa.getClaim("mfaAt")).thenReturn(null);
    assertThatThrownBy(() -> policy.requireFreshStepUp(withoutMfa))
        .isInstanceOf(AdminAuthException.class)
        .hasMessageContaining("authenticator");

    Jwt expired = mock(Jwt.class);
    when(expired.getClaim("mfaAt")).thenReturn(Instant.now().minusSeconds(601).getEpochSecond());
    assertThatThrownBy(() -> policy.requireFreshStepUp(expired))
        .isInstanceOf(AdminAuthException.class);
  }

  @Test
  void acceptsRecentStepUp() {
    Jwt fresh = mock(Jwt.class);
    when(fresh.getClaim("mfaAt")).thenReturn(Instant.now().minusSeconds(30).getEpochSecond());

    policy.requireFreshStepUp(fresh);
  }
}
