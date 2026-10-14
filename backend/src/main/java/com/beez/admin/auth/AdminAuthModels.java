package com.beez.admin.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class AdminAuthModels {
  private AdminAuthModels() {}

  public record LoginRequest(
      @NotBlank @Email @Size(max = 254) String email,
      @NotBlank @Size(max = 128) String password,
      @NotBlank @Pattern(regexp = "[0-9]{6}") String authenticatorCode) {}

  public record StepUpRequest(@NotBlank @Pattern(regexp = "[0-9]{6}") String authenticatorCode) {}

  public record AdminSession(
      String accessToken,
      String tokenType,
      Instant expiresAt,
      Instant mfaVerifiedAt,
      AdminIdentity admin) {}

  public record AdminIdentity(UUID id, String email, String displayName, List<String> permissions) {}

  public record AdminMe(AdminIdentity admin, Instant mfaVerifiedAt, Instant sessionExpiresAt) {}
}
