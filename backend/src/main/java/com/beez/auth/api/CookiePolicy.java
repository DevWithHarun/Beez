package com.beez.auth.api;

import com.beez.auth.service.AuthException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

@Component
public class CookiePolicy {
  public static final String REFRESH_COOKIE = "beez_refresh";
  private final boolean secure;
  private final Set<String> allowedOrigins;

  public CookiePolicy(
      @Value("${beez.auth.refresh-cookie-secure}") boolean secure,
      @Value("${beez.auth.allowed-origins}") String allowedOrigins) {
    this.secure = secure;
    this.allowedOrigins =
        Arrays.stream(allowedOrigins.split(","))
            .map(String::trim)
            .filter(origin -> !origin.isEmpty())
            .collect(Collectors.toUnmodifiableSet());
  }

  public void requirePwaOrigin(HttpServletRequest request) {
    String client = request.getHeader("X-Beez-Client");
    String origin = request.getHeader("Origin");
    if (!"pwa".equals(client) || origin == null || !allowedOrigins.contains(origin)) {
      throw new AuthException(
          "request_origin_invalid",
          "This sign-in request could not be verified.",
          HttpStatus.FORBIDDEN);
    }
  }

  public ResponseCookie refreshCookie(String token, long maxAgeSeconds) {
    return ResponseCookie.from(REFRESH_COOKIE, token)
        .httpOnly(true)
        .secure(secure)
        .sameSite("Lax")
        .path("/api/v1/auth")
        .maxAge(maxAgeSeconds)
        .build();
  }

  public ResponseCookie clearRefreshCookie() {
    return refreshCookie("", 0);
  }
}
