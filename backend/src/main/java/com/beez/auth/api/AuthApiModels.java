package com.beez.auth.api;

import com.beez.auth.domain.UserAccount;
import com.beez.auth.domain.UserRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

public final class AuthApiModels {
  private AuthApiModels() {}

  public record OtpRequest(
      @NotBlank String phone,
      @NotNull UserRole role) {}

  public record LoginOtpRequest(@NotBlank String phone) {}

  public record OtpVerify(
      @NotNull UUID challengeId,
      @NotNull @Pattern(regexp = "[0-9]{6}") String code,
      UserRole role) {}

  public record ProfileUpdate(
      @Size(max = 120) String displayName,
      @Size(max = 120) String shopName,
      @Size(max = 120) String area,
      String language) {}

  public record OtpRequested(
      UUID challengeId,
      int expiresInSeconds,
      int retryAfterSeconds,
      String message) {}

  public record UserView(
      UUID id,
      String role,
      String status,
      String onboardingStatus,
      boolean onboardingRequired,
      String displayName,
      String shopName,
      String area,
      String phone,
      String language) {
    public static UserView from(UserAccount user) {
      boolean onboardingRequired = user.isOnboardingRequired();
      String onboardingStatus =
          user.getRole() == UserRole.RIDER
              ? "PENDING_APPROVAL"
              : onboardingRequired ? "ONBOARDING" : "COMPLETE";
      return new UserView(
          user.getId(),
          user.getRole().name(),
          user.getStatus().name(),
          onboardingStatus,
          onboardingRequired,
          user.getDisplayName(),
          user.getShopName(),
          user.getArea(),
          user.getPhone(),
          user.getLanguage());
    }
  }

  public record Session(
      String accessToken,
      String tokenType,
      int expiresIn,
      UserView user,
      Instant refreshExpiresAt) {
    public static Session from(String accessToken, Instant refreshExpiresAt, UserAccount user) {
      return new Session(accessToken, "Bearer", 900, UserView.from(user), refreshExpiresAt);
    }
  }
}
