package com.beez.auth.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

import com.beez.auth.domain.OtpChallenge;
import com.beez.auth.domain.RefreshToken;
import com.beez.auth.domain.UserAccount;
import com.beez.auth.domain.UserRole;
import com.beez.auth.repo.OtpChallengeRepository;
import com.beez.auth.repo.RefreshTokenRepository;
import com.beez.auth.repo.UserAccountRepository;
import com.beez.auth.spi.SmsSender;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {
  private static final String OTP_SECRET = "unit-test-secret-that-is-long-enough";

  @Mock private OtpChallengeRepository challenges;
  @Mock private OtpChallengeManager challengeManager;
  @Mock private UserAccountRepository users;
  @Mock private RefreshTokenRepository refreshTokens;
  @Mock private RateLimitService rateLimits;
  @Mock private SessionTokenService sessions;
  @Mock private SmsSender smsSender;

  private OtpCryptography cryptography;
  private AuthService authService;

  @BeforeEach
  void setUp() {
    cryptography = new OtpCryptography(OTP_SECRET);
    authService =
        new AuthService(
            challenges,
            challengeManager,
            users,
            refreshTokens,
            rateLimits,
            cryptography,
            sessions,
            smsSender);
  }

  @Test
  void requestsAnOtpWithoutReturningTheCodeAndStoresOnlyItsChallengeHmac() {
    AuthService.OtpRequested result =
        authService.requestOtp(UserRole.MERCHANT, "0712 345 678", "127.0.0.1");

    ArgumentCaptor<UUID> id = ArgumentCaptor.forClass(UUID.class);
    ArgumentCaptor<String> phone = ArgumentCaptor.forClass(String.class);
    ArgumentCaptor<UserRole> role = ArgumentCaptor.forClass(UserRole.class);
    ArgumentCaptor<byte[]> digest = ArgumentCaptor.forClass(byte[].class);
    verify(challengeManager).create(id.capture(), phone.capture(), role.capture(), digest.capture(), any());
    ArgumentCaptor<String> sms = ArgumentCaptor.forClass(String.class);
    verify(smsSender).send(eq("+254712345678"), sms.capture());

    String code = java.util.regex.Pattern.compile("[0-9]{6}").matcher(sms.getValue()).results()
        .map(java.util.regex.MatchResult::group)
        .findFirst()
        .orElseThrow();
    assertEquals(result.challengeId(), id.getValue());
    assertEquals("+254712345678", phone.getValue());
    assertEquals(UserRole.MERCHANT, role.getValue());
    assertTrueHmacMatches(id.getValue(), code, digest.getValue());
    assertEquals(300, result.expiresInSeconds());
  }

  @Test
  void loginOtpUsesTheRoleOfTheExistingAccount() {
    UserAccount rider = new UserAccount("+254712345678", UserRole.RIDER, Instant.now());
    when(users.findByPhone("+254712345678")).thenReturn(Optional.of(rider));

    AuthService.OtpRequested result =
        authService.requestLoginOtp("0712 345 678", "127.0.0.1");

    ArgumentCaptor<UserRole> role = ArgumentCaptor.forClass(UserRole.class);
    verify(challengeManager)
        .create(eq(result.challengeId()), eq("+254712345678"), role.capture(), any(), any());
    verify(smsSender).send(eq("+254712345678"), any());
    assertEquals(UserRole.RIDER, role.getValue());
  }

  @Test
  void loginOtpDoesNotRevealOrSendSmsForUnknownAccounts() {
    when(users.findByPhone("+254712345678")).thenReturn(Optional.empty());

    AuthService.OtpRequested result =
        authService.requestLoginOtp("0712 345 678", "127.0.0.1");

    assertNotNull(result.challengeId());
    assertEquals(300, result.expiresInSeconds());
    assertEquals(60, result.retryAfterSeconds());
    verify(challengeManager, never()).create(any(), any(), any(), any(), any());
    verify(smsSender, never()).send(any(), any());
  }

  @Test
  void doesNotAllowAdminAccountsToUsePublicOtpSignIn() {
    AuthException exception =
        assertThrows(
            AuthException.class,
            () -> authService.requestOtp(UserRole.ADMIN, "0712 345 678", "127.0.0.1"));

    assertEquals("admin_auth_required", exception.getCode());
    verify(rateLimits, never()).acquireCooldown(any(), any());
    verify(smsSender, never()).send(any(), any());
  }

  @Test
  void failedOtpAttemptsAreCountedAndTheCodeIsConsumedAfterFiveGuesses() {
    UUID id = UUID.randomUUID();
    Instant now = Instant.now();
    String correctCode = "482106";
    OtpChallenge challenge =
        new OtpChallenge(
            id,
            "+254712345678",
            UserRole.RIDER,
            cryptography.codeHmac(id, correctCode),
            now.plusSeconds(300),
            now);
    when(challenges.findByIdForUpdate(id)).thenReturn(Optional.of(challenge));

    for (int attempt = 0; attempt < 5; attempt++) {
      assertThrows(
          OtpRejectedException.class,
          () -> authService.verifyOtp(id, "000000", UserRole.RIDER, "test", "127.0.0.1"));
    }

    assertEquals(5, challenge.getAttempts());
    assertNotNull(challenge.getConsumedAt());
  }

  @Test
  void refreshRotatesTheTokenWithinItsExistingFamily() {
    Instant now = Instant.now();
    UUID userId = UUID.randomUUID();
    UUID familyId = UUID.randomUUID();
    String rawToken = "old-refresh-token";
    RefreshToken oldToken =
        new RefreshToken(
            userId,
            familyId,
            SessionTokenService.hashRefreshToken(rawToken),
            now.plusSeconds(1000),
            now.plusSeconds(2000),
            now.minusSeconds(60),
            "test");
    UserAccount user = new UserAccount("+254712345678", UserRole.MERCHANT, now);
    when(refreshTokens.findByTokenHashForUpdate(
            org.mockito.ArgumentMatchers.argThat(
                hash -> java.util.Arrays.equals(hash, SessionTokenService.hashRefreshToken(rawToken)))))
        .thenReturn(Optional.of(oldToken));
    when(users.findById(userId)).thenReturn(Optional.of(user));
    when(sessions.rotate(eq(user), eq(familyId), eq(oldToken.getFamilyExpiresAt()), eq("new-agent")))
        .thenReturn(
            new SessionTokens(
                "new-access",
                "new-refresh",
                now.plusSeconds(900),
                user));

    SessionTokens result = authService.refresh(rawToken, "new-agent");

    assertEquals("new-access", result.accessToken());
    assertNotNull(oldToken.getRotatedAt());
    verify(sessions).rotate(eq(user), eq(familyId), eq(oldToken.getFamilyExpiresAt()), eq("new-agent"));
    verify(refreshTokens, never()).revokeFamily(eq(familyId), any());
  }

  @Test
  void replayedRefreshTokenRevokesItsWholeFamily() {
    Instant now = Instant.now();
    UUID familyId = UUID.randomUUID();
    String rawToken = "replayed-refresh-token";
    RefreshToken oldToken =
        new RefreshToken(
            UUID.randomUUID(),
            familyId,
            SessionTokenService.hashRefreshToken(rawToken),
            now.plusSeconds(1000),
            now.plusSeconds(2000),
            now.minusSeconds(120),
            "test");
    oldToken.rotate(now.minusSeconds(60));
    when(refreshTokens.findByTokenHashForUpdate(any())).thenReturn(Optional.of(oldToken));

    assertThrows(RefreshReplayException.class, () -> authService.refresh(rawToken, "test"));

    verify(refreshTokens).revokeFamily(eq(familyId), any());
    verify(sessions, never()).rotate(any(), any(), any(), any());
  }

  @Test
  void aValidOtpCreatesTheRoleBoundAccountAndSession() {
    UUID id = UUID.randomUUID();
    Instant now = Instant.now();
    OtpChallenge challenge =
        new OtpChallenge(
            id,
            "+254712345678",
            UserRole.MERCHANT,
            cryptography.codeHmac(id, "482106"),
            now.plusSeconds(300),
            now);
    when(challenges.findByIdForUpdate(id)).thenReturn(Optional.of(challenge));
    when(users.findByPhone("+254712345678")).thenReturn(Optional.empty());
    when(users.save(any(UserAccount.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));
    when(sessions.create(any(UserAccount.class), eq("test")))
        .thenAnswer(
            invocation ->
                new SessionTokens(
                    "access-token",
                    "refresh-token",
                    now.plusSeconds(3600),
                    invocation.getArgument(0)));

    SessionTokens session =
        authService.verifyOtp(id, "482106", UserRole.MERCHANT, "test", "127.0.0.1");

    assertEquals(UserRole.MERCHANT, session.user().getRole());
    assertEquals("+254712345678", session.user().getPhone());
    assertEquals("access-token", session.accessToken());
    assertTrue(session.user().isOnboardingRequired());
    assertNotNull(challenge.getConsumedAt());
  }

  @Test
  void verifiesLoginOtpUsingTheStoredChallengeRoleWhenNoRoleWasSubmitted() {
    UUID id = UUID.randomUUID();
    Instant now = Instant.now();
    OtpChallenge challenge =
        new OtpChallenge(
            id,
            "+254712345678",
            UserRole.RIDER,
            cryptography.codeHmac(id, "482106"),
            now.plusSeconds(300),
            now);
    UserAccount rider = new UserAccount("+254712345678", UserRole.RIDER, now);
    when(challenges.findByIdForUpdate(id)).thenReturn(Optional.of(challenge));
    when(users.findByPhone("+254712345678")).thenReturn(Optional.of(rider));
    when(sessions.create(eq(rider), eq("test")))
        .thenReturn(
            new SessionTokens("access-token", "refresh-token", now.plusSeconds(3600), rider));

    SessionTokens session =
        authService.verifyOtp(id, "482106", null, "test", "127.0.0.1");

    assertEquals(UserRole.RIDER, session.user().getRole());
    verify(users, never()).save(any());
  }

  @Test
  void updatingMerchantProfileStoresShopDetailsAndClearsOnboarding() {
    UUID userId = UUID.randomUUID();
    Instant now = Instant.now();
    UserAccount user = new UserAccount("+254712345678", UserRole.MERCHANT, now);
    when(users.findById(userId)).thenReturn(Optional.of(user));
    when(users.save(user)).thenReturn(user);

    UserAccount updated =
        authService.updateProfile(userId, "  Kibet  ", "  Kibet Shop  ", "  Kongowea  ", "SW");

    assertEquals("Kibet", updated.getDisplayName());
    assertEquals("Kibet Shop", updated.getShopName());
    assertEquals("Kongowea", updated.getArea());
    assertEquals("sw", updated.getLanguage());
    assertFalse(updated.isOnboardingRequired());
    verify(users).save(user);
  }

  @Test
  void updatingRiderProfileRequiresAnAreaAndKeepsShopDetailsEmpty() {
    UUID userId = UUID.randomUUID();
    Instant now = Instant.now();
    UserAccount user = new UserAccount("+254712345678", UserRole.RIDER, now);
    when(users.findById(userId)).thenReturn(Optional.of(user));
    when(users.save(user)).thenReturn(user);

    UserAccount updated = authService.updateProfile(userId, "Kibet", null, "Mombasa", "en");

    assertEquals("Mombasa", updated.getArea());
    assertEquals(null, updated.getShopName());
    assertFalse(updated.isOnboardingRequired());
  }

  @Test
  void profileSetupRejectsMissingRoleSpecificDetails() {
    UUID userId = UUID.randomUUID();
    UserAccount user =
        new UserAccount("+254712345678", UserRole.MERCHANT, Instant.now());
    when(users.findById(userId)).thenReturn(Optional.of(user));

    assertThrows(
        AuthException.class,
        () -> authService.updateProfile(userId, "Kibet", null, "Kongowea", "en"));

    verify(users, never()).save(any());
  }

  private void assertTrueHmacMatches(UUID id, String code, byte[] digest) {
    org.junit.jupiter.api.Assertions.assertTrue(cryptography.matches(id, code, digest));
  }
}
