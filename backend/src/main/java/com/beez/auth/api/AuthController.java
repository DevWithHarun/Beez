package com.beez.auth.api;

import static com.beez.auth.api.AuthApiModels.*;

import com.beez.auth.domain.UserAccount;
import com.beez.auth.service.AuthService;
import com.beez.auth.service.AuthException;
import com.beez.auth.service.SessionTokenService;
import com.beez.auth.service.SessionTokens;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.WebUtils;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
  private final AuthService authService;
  private final CookiePolicy cookiePolicy;

  public AuthController(AuthService authService, CookiePolicy cookiePolicy) {
    this.authService = authService;
    this.cookiePolicy = cookiePolicy;
  }

  @PostMapping("/otp/request")
  public ResponseEntity<OtpRequested> requestOtp(
      @Valid @RequestBody OtpRequest input, HttpServletRequest request) {
    AuthService.OtpRequested requested =
        authService.requestOtp(input.role(), input.phone(), request.getRemoteAddr());
    return otpResponse(requested);
  }

  @PostMapping("/otp/login/request")
  public ResponseEntity<OtpRequested> requestLoginOtp(
      @Valid @RequestBody LoginOtpRequest input, HttpServletRequest request) {
    AuthService.OtpRequested requested =
        authService.requestLoginOtp(input.phone(), request.getRemoteAddr());
    return otpResponse(requested);
  }

  private ResponseEntity<OtpRequested> otpResponse(AuthService.OtpRequested requested) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(
            new OtpRequested(
                requested.challengeId(),
                requested.expiresInSeconds(),
                requested.retryAfterSeconds(),
                "If this number can sign in, a code will be sent shortly."));
  }

  @PostMapping("/otp/verify")
  public ResponseEntity<Session> verifyOtp(
      @Valid @RequestBody OtpVerify input, HttpServletRequest request) {
    cookiePolicy.requirePwaOrigin(request);
    SessionTokens tokens =
        authService.verifyOtp(
            input.challengeId(),
            input.code(),
            input.role(),
            request.getHeader("User-Agent"),
            request.getRemoteAddr());
    return sessionResponse(tokens);
  }

  @PostMapping("/refresh")
  public ResponseEntity<?> refresh(HttpServletRequest request) {
    cookiePolicy.requirePwaOrigin(request);
    String token = cookieValue(request, CookiePolicy.REFRESH_COOKIE);
    try {
      return sessionResponse(authService.refresh(token, request.getHeader("User-Agent")));
    } catch (AuthException exception) {
      String requestId = UUID.randomUUID().toString();
      return ResponseEntity.status(exception.getStatus())
          .header(HttpHeaders.SET_COOKIE, cookiePolicy.clearRefreshCookie().toString())
          .header("X-Request-Id", requestId)
          .cacheControl(CacheControl.noStore())
          .body(
              new SessionError(
                  exception.getCode(), exception.getMessage(), Map.of(), requestId));
    }
  }

  @PostMapping("/logout")
  public ResponseEntity<Void> logout(HttpServletRequest request) {
    cookiePolicy.requirePwaOrigin(request);
    authService.logout(cookieValue(request, CookiePolicy.REFRESH_COOKIE));
    return ResponseEntity.noContent()
        .header(HttpHeaders.SET_COOKIE, cookiePolicy.clearRefreshCookie().toString())
        .cacheControl(CacheControl.noStore())
        .build();
  }

  @PostMapping("/logout-all")
  public ResponseEntity<Void> logoutAll(@AuthenticationPrincipal Jwt principal) {
    UUID userId = UUID.fromString(principal.getSubject());
    authService.logoutAll(userId);
    return ResponseEntity.noContent()
        .header(HttpHeaders.SET_COOKIE, cookiePolicy.clearRefreshCookie().toString())
        .cacheControl(CacheControl.noStore())
        .build();
  }

  @GetMapping("/me")
  public ResponseEntity<UserView> currentUser(@AuthenticationPrincipal Jwt principal) {
    UserAccount user = authService.currentUser(UUID.fromString(principal.getSubject()));
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(UserView.from(user));
  }

  @PatchMapping("/me")
  public ResponseEntity<UserView> updateCurrentUser(
      @AuthenticationPrincipal Jwt principal, @Valid @RequestBody ProfileUpdate input) {
    UserAccount user =
        authService.updateProfile(
            UUID.fromString(principal.getSubject()),
            input.displayName(),
            input.shopName(),
            input.area(),
            input.language());
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(UserView.from(user));
  }

  private ResponseEntity<Session> sessionResponse(SessionTokens tokens) {
    return ResponseEntity.ok()
        .header(
            HttpHeaders.SET_COOKIE,
            cookiePolicy
                .refreshCookie(
                    tokens.refreshToken(),
                    SessionTokenService.refreshMaxAgeSeconds(tokens.refreshExpiresAt()))
                .toString())
        .cacheControl(CacheControl.noStore())
        .body(
            Session.from(
                tokens.accessToken(), tokens.refreshExpiresAt(), tokens.user()));
  }

  private static String cookieValue(HttpServletRequest request, String name) {
    var cookie = WebUtils.getCookie(request, name);
    return cookie == null ? null : cookie.getValue();
  }

  private record SessionError(
      String error, String message, Map<String, Object> details, String requestId) {}
}
