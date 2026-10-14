package com.beez.admin.auth;

import static com.beez.admin.auth.AdminAuthModels.*;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.Instant;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/auth")
public class AdminAuthController {
  private final AdminAuthService adminAuth;

  public AdminAuthController(AdminAuthService adminAuth) {
    this.adminAuth = adminAuth;
  }

  @PostMapping("/login")
  public ResponseEntity<AdminSession> login(
      @Valid @RequestBody LoginRequest input, HttpServletRequest request) {
    return noStore(
        adminAuth.login(
            input.email(),
            input.password(),
            input.authenticatorCode(),
            request.getRemoteAddr(),
            request.getHeader("User-Agent")));
  }

  @PostMapping("/step-up")
  public ResponseEntity<AdminSession> stepUp(
      @AuthenticationPrincipal Jwt principal,
      @Valid @RequestBody StepUpRequest input,
      HttpServletRequest request) {
    return noStore(
        adminAuth.stepUp(
            UUID.fromString(principal.getSubject()),
            input.authenticatorCode(),
            principal.getExpiresAt(),
            request.getRemoteAddr(),
            request.getHeader("User-Agent")));
  }

  @GetMapping("/me")
  public ResponseEntity<AdminMe> me(@AuthenticationPrincipal Jwt principal) {
    return noStore(
        adminAuth.me(
            UUID.fromString(principal.getSubject()),
            mfaVerifiedAt(principal),
            principal.getExpiresAt()));
  }

  @PostMapping("/logout")
  public ResponseEntity<Void> logout(@AuthenticationPrincipal Jwt principal) {
    adminAuth.logout(UUID.fromString(principal.getSubject()));
    return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
  }

  private static Instant mfaVerifiedAt(Jwt principal) {
    Number value = principal.getClaim("mfaAt");
    return value == null ? null : Instant.ofEpochSecond(value.longValue());
  }

  private static <T> ResponseEntity<T> noStore(T body) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
  }
}
