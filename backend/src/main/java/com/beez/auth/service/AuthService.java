package com.beez.auth.service;

import com.beez.auth.domain.OtpChallenge;
import com.beez.auth.domain.RefreshToken;
import com.beez.auth.domain.UserAccount;
import com.beez.auth.domain.UserRole;
import com.beez.auth.domain.UserStatus;
import com.beez.auth.repo.OtpChallengeRepository;
import com.beez.auth.repo.RefreshTokenRepository;
import com.beez.auth.repo.UserAccountRepository;
import com.beez.auth.spi.SmsSender;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
  private static final Logger LOGGER = LoggerFactory.getLogger(AuthService.class);
  private static final Duration OTP_LIFETIME = Duration.ofMinutes(5);
  private static final SecureRandom SECURE_RANDOM = new SecureRandom();

  private final OtpChallengeRepository challenges;
  private final OtpChallengeManager challengeManager;
  private final UserAccountRepository users;
  private final RefreshTokenRepository refreshTokens;
  private final RateLimitService rateLimits;
  private final OtpCryptography otpCryptography;
  private final SessionTokenService sessionTokenService;
  private final SmsSender smsSender;

  public AuthService(
      OtpChallengeRepository challenges,
      OtpChallengeManager challengeManager,
      UserAccountRepository users,
      RefreshTokenRepository refreshTokens,
      RateLimitService rateLimits,
      OtpCryptography otpCryptography,
      SessionTokenService sessionTokenService,
      SmsSender smsSender) {
    this.challenges = challenges;
    this.challengeManager = challengeManager;
    this.users = users;
    this.refreshTokens = refreshTokens;
    this.rateLimits = rateLimits;
    this.otpCryptography = otpCryptography;
    this.sessionTokenService = sessionTokenService;
    this.smsSender = smsSender;
  }

  public OtpRequested requestOtp(UserRole role, String inputPhone, String clientIp) {
    if (role == UserRole.ADMIN) {
      throw new AuthException(
          "admin_auth_required",
          "Admin accounts must use the separate admin sign-in.",
          HttpStatus.FORBIDDEN);
    }
    String phone = PhoneNumbers.normalizeKenyanMobile(inputPhone);
    enforceOtpRequestLimits(phone, clientIp);

    return issueOtp(phone, role);
  }

  public OtpRequested requestLoginOtp(String inputPhone, String clientIp) {
    String phone = PhoneNumbers.normalizeKenyanMobile(inputPhone);
    enforceOtpRequestLimits(phone, clientIp);

    UserAccount user =
        users
            .findByPhone(phone)
            .filter(account -> account.getStatus() == UserStatus.ACTIVE)
            .filter(
                account ->
                    account.getRole() == UserRole.MERCHANT || account.getRole() == UserRole.RIDER)
            .orElse(null);
    if (user == null) {
      return new OtpRequested(UUID.randomUUID(), (int) OTP_LIFETIME.toSeconds(), 60);
    }

    return issueOtp(phone, user.getRole());
  }

  private void enforceOtpRequestLimits(String phone, String clientIp) {
    String phoneKey = otpCryptography.hashPhoneForRateLimit(phone);
    rateLimits.acquireCooldown("auth:otp:phone:cooldown:" + phoneKey, Duration.ofSeconds(60));
    rateLimits.enforce("auth:otp:phone:hour:" + phoneKey, 5, Duration.ofHours(1));
    rateLimits.enforce("auth:otp:phone:day:" + phoneKey, 10, Duration.ofDays(1));
    rateLimits.enforce(
        "auth:otp:ip:hour:" + otpCryptography.hashForRateLimit(clientIp), 20, Duration.ofHours(1));
  }

  private OtpRequested issueOtp(String phone, UserRole role) {
    String code = String.format(Locale.ROOT, "%06d", SECURE_RANDOM.nextInt(1_000_000));
    UUID challengeId = UUID.randomUUID();
    Instant now = Instant.now();
    challengeManager.create(
        challengeId, phone, role, otpCryptography.codeHmac(challengeId, code), now);

    try {
      smsSender.send(phone, "Your Beez sign-in code is " + code + ". It expires in 5 minutes.");
    } catch (AuthException exception) {
      challengeManager.consume(challengeId, Instant.now());
      LOGGER.warn("OTP delivery failed for challenge {}", challengeId);
      throw new AuthException(
          "sms_unavailable",
          "We couldn't send a code right now. Please try again later.",
          HttpStatus.SERVICE_UNAVAILABLE);
    }

    return new OtpRequested(challengeId, (int) OTP_LIFETIME.toSeconds(), 60);
  }

  @Transactional(noRollbackFor = AuthException.class)
  public SessionTokens verifyOtp(
      UUID challengeId, String code, UserRole requestedRole, String userAgent, String clientIp) {
    if (requestedRole == UserRole.ADMIN) {
      throw new OtpRejectedException(
          "otp_invalid", "That code is invalid or has expired.");
    }
    rateLimits.enforce(
        "auth:otp:guess:ip:" + otpCryptography.hashForRateLimit(clientIp),
        100,
        Duration.ofHours(1));
    OtpChallenge challenge =
        challenges
            .findByIdForUpdate(challengeId)
            .orElseThrow(
                () ->
                    new OtpRejectedException(
                        "otp_invalid", "That code is invalid or has expired."));
    String phoneKey = otpCryptography.hashPhoneForRateLimit(challenge.getPhone());
    rateLimits.enforce("auth:otp:guess:phone:" + phoneKey, 15, Duration.ofHours(1));
    Instant now = Instant.now();
    if (!challenge.isUsableAt(now)) {
      if (challenge.getConsumedAt() == null) {
        challenge.consume(now);
      }
      throw new OtpRejectedException("otp_expired", "That code is invalid or has expired.");
    }

    challenge.recordAttempt();
    boolean matches =
        otpCryptography.matches(challenge.getId(), code, challenge.getCodeHmac());
    if (!matches) {
      if (challenge.getAttempts() >= challenge.getMaxAttempts()) {
        challenge.consume(now);
      }
      throw new OtpRejectedException("otp_invalid", "That code is invalid or has expired.");
    }

    challenge.consume(now);
    UserRole effectiveRole = requestedRole == null ? challenge.getRole() : requestedRole;
    if (effectiveRole == UserRole.ADMIN || challenge.getRole() != effectiveRole) {
      throw new OtpRejectedException("otp_invalid", "That code is invalid or has expired.");
    }

    UserAccount user =
        users
            .findByPhone(challenge.getPhone())
            .map(
                existing -> {
                  if (existing.getRole() != effectiveRole) {
                    throw new RoleConflictException();
                  }
                  if (existing.getStatus() != UserStatus.ACTIVE) {
                    throw new AuthException(
                        "account_unavailable",
                        "This account cannot sign in. Contact Beez support.",
                        HttpStatus.FORBIDDEN);
                  }
                  existing.setLastLoginAt(now);
                  return existing;
                })
            .orElseGet(() -> users.save(new UserAccount(challenge.getPhone(), effectiveRole, now)));

    return sessionTokenService.create(user, userAgent);
  }

  @Transactional(noRollbackFor = RefreshReplayException.class)
  public SessionTokens refresh(String rawRefreshToken, String userAgent) {
    if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
      throw invalidRefresh();
    }

    RefreshToken token =
        refreshTokens
            .findByTokenHashForUpdate(SessionTokenService.hashRefreshToken(rawRefreshToken))
            .orElseThrow(this::invalidRefresh);
    Instant now = Instant.now();

    if (token.getRotatedAt() != null) {
      refreshTokens.revokeFamily(token.getFamilyId(), now);
      LOGGER.warn("Refresh token reuse detected for family {}", token.getFamilyId());
      throw new RefreshReplayException();
    }
    if (token.getRevokedAt() != null
        || !token.getExpiresAt().isAfter(now)
        || !token.getFamilyExpiresAt().isAfter(now)) {
      throw invalidRefresh();
    }

    UserAccount user =
        users
            .findById(token.getUserId())
            .filter(account -> account.getStatus() == UserStatus.ACTIVE)
            .orElseThrow(this::invalidRefresh);

    token.rotate(now);
    return sessionTokenService.rotate(user, token.getFamilyId(), token.getFamilyExpiresAt(), userAgent);
  }

  @Transactional
  public void logout(String rawRefreshToken) {
    if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
      return;
    }
    refreshTokens
        .findByTokenHashForUpdate(SessionTokenService.hashRefreshToken(rawRefreshToken))
        .ifPresent(token -> refreshTokens.revokeFamily(token.getFamilyId(), Instant.now()));
  }

  @Transactional
  public UserAccount logoutAll(UUID userId) {
    UserAccount user =
        users
            .findById(userId)
            .orElseThrow(
                () ->
                    new AuthException(
                        "session_invalid", "Please sign in again.", HttpStatus.UNAUTHORIZED));
    Instant now = Instant.now();
    refreshTokens.revokeAllForUser(userId, now);
    user.incrementTokenVersion();
    return users.save(user);
  }

  @Transactional
  public UserAccount suspendAccount(UUID userId) {
    UserAccount user = findAdministrableUser(userId);
    if (user.getStatus() != UserStatus.ACTIVE) {
      throw new AuthException(
          "account_status_invalid",
          "Only active merchant or rider accounts can be suspended.",
          HttpStatus.CONFLICT);
    }
    user.setStatus(UserStatus.SUSPENDED);
    Instant now = Instant.now();
    refreshTokens.revokeAllForUser(userId, now);
    user.incrementTokenVersion();
    return users.save(user);
  }

  @Transactional
  public UserAccount restoreAccount(UUID userId) {
    UserAccount user = findAdministrableUser(userId);
    if (user.getStatus() != UserStatus.SUSPENDED) {
      throw new AuthException(
          "account_status_invalid",
          "Only suspended merchant or rider accounts can be restored.",
          HttpStatus.CONFLICT);
    }
    user.setStatus(UserStatus.ACTIVE);
    user.incrementTokenVersion();
    return users.save(user);
  }

  private UserAccount findAdministrableUser(UUID userId) {
    UserAccount user =
        users
            .findById(userId)
            .orElseThrow(
                () ->
                    new AuthException(
                        "account_not_found",
                        "This account was not found.",
                        HttpStatus.NOT_FOUND));
    if (user.getRole() == UserRole.ADMIN || user.getStatus() == UserStatus.DELETED) {
      throw new AuthException(
          "account_admin_protected",
          "Admin and deleted accounts cannot be changed from user administration.",
          HttpStatus.CONFLICT);
    }
    return user;
  }

  @Transactional
  public UserAccount updateProfile(
      UUID userId, String displayName, String shopName, String area, String language) {
    UserAccount user =
        users
            .findById(userId)
            .filter(account -> account.getStatus() == UserStatus.ACTIVE)
            .orElseThrow(
                () ->
                    new AuthException(
                        "session_invalid", "Please sign in again.", HttpStatus.UNAUTHORIZED));

    boolean completingOnboarding = user.isOnboardingRequired();
    if (completingOnboarding && (displayName == null || displayName.isBlank())) {
      throw new AuthException(
          "profile_invalid", "Please enter your name.", HttpStatus.BAD_REQUEST);
    }
    if (completingOnboarding && (area == null || area.isBlank())) {
      throw new AuthException(
          "profile_invalid", "Please enter your market or delivery area.", HttpStatus.BAD_REQUEST);
    }
    if (completingOnboarding
        && user.getRole() == UserRole.MERCHANT
        && (shopName == null || shopName.isBlank())) {
      throw new AuthException(
          "profile_invalid", "Please enter your shop name.", HttpStatus.BAD_REQUEST);
    }
    if (user.getRole() == UserRole.RIDER && shopName != null) {
      throw new AuthException(
          "profile_invalid",
          "Shop details are only used for merchant accounts.",
          HttpStatus.BAD_REQUEST);
    }

    if (displayName != null) {
      if (displayName.isBlank()) {
        throw new AuthException(
            "profile_invalid", "Please enter your name.", HttpStatus.BAD_REQUEST);
      }
      user.setDisplayName(displayName);
    }
    if (shopName != null) {
      if (shopName.isBlank()) {
        throw new AuthException(
            "profile_invalid", "Please enter your shop name.", HttpStatus.BAD_REQUEST);
      }
      user.setShopName(user.getRole() == UserRole.MERCHANT ? shopName : null);
    }
    if (area != null) {
      if (area.isBlank()) {
        throw new AuthException(
            "profile_invalid",
            "Please enter your market or delivery area.",
            HttpStatus.BAD_REQUEST);
      }
      user.setArea(area);
    }

    if (language != null) {
      String normalizedLanguage = language.trim().toLowerCase(Locale.ROOT);
      if (!("en".equals(normalizedLanguage) || "sw".equals(normalizedLanguage))) {
        throw new AuthException(
            "profile_invalid", "Language must be either en or sw.", HttpStatus.BAD_REQUEST);
      }
      user.setLanguage(normalizedLanguage);
    }

    return users.save(user);
  }

  @Transactional(readOnly = true)
  public UserAccount currentUser(UUID userId) {
    return users
        .findById(userId)
        .filter(user -> user.getStatus() == UserStatus.ACTIVE)
        .orElseThrow(
            () ->
                new AuthException(
                    "session_invalid", "Please sign in again.", HttpStatus.UNAUTHORIZED));
  }

  private AuthException invalidRefresh() {
    return new AuthException(
        "session_invalid", "Please sign in again.", HttpStatus.UNAUTHORIZED);
  }

  public record OtpRequested(UUID challengeId, int expiresInSeconds, int retryAfterSeconds) {}
}
