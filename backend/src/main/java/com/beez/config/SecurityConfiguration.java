package com.beez.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableWebSecurity
public class SecurityConfiguration {
  @Bean
  java.security.SecureRandom secureRandom() {
    return new java.security.SecureRandom();
  }

  @Bean
  SecurityFilterChain securityFilterChain(HttpSecurity http, ObjectMapper objectMapper)
      throws Exception {
    JwtAuthenticationConverter jwtAuthenticationConverter = new JwtAuthenticationConverter();
    jwtAuthenticationConverter.setJwtGrantedAuthoritiesConverter(
        jwt -> {
          String role = jwt.getClaimAsString("role");
          return role == null
              ? List.of()
              : List.of(new SimpleGrantedAuthority("ROLE_" + role));
        });

    http.csrf(csrf -> csrf.disable())
        .cors(Customizer.withDefaults())
        .sessionManagement(
            sessions -> sessions.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(
            requests ->
                requests
                    .requestMatchers("/actuator/health", "/actuator/health/**")
                    .permitAll()
                    .requestMatchers(
                        HttpMethod.POST,
                        "/api/v1/admin/auth/login")
                    .permitAll()
                    .requestMatchers("/api/v1/admin/auth/step-up")
                    .hasRole("ADMIN")
                    .requestMatchers("/api/v1/admin/**", "/api/v1/operations/**")
                    .hasRole("ADMIN")
                    .requestMatchers(
                        HttpMethod.POST,
                        "/api/v1/auth/otp/request",
                        "/api/v1/auth/otp/login/request",
                        "/api/v1/auth/otp/verify",
                        "/api/v1/auth/refresh",
                        "/api/v1/auth/logout")
                    .permitAll()
                    .requestMatchers(
                        HttpMethod.GET,
                        "/api/v1/public/zones",
                        "/api/v1/public/shops",
                        "/api/v1/public/m/*")
                    .permitAll()
                    .requestMatchers(HttpMethod.POST, "/api/v1/public/baskets")
                    .permitAll()
                    .requestMatchers(HttpMethod.GET, "/api/v1/public/baskets/*")
                    .permitAll()
                    .requestMatchers(HttpMethod.POST, "/api/v1/public/baskets/*/pay")
                    .permitAll()
                    .requestMatchers(HttpMethod.POST, "/api/v1/payments/callback/**")
                    .permitAll()
                    .requestMatchers("/api/v1/merchants/**")
                    .hasRole("MERCHANT")
                    .requestMatchers("/api/v1/riders/**")
                    .hasRole("RIDER")
                    .requestMatchers(HttpMethod.OPTIONS, "/**")
                    .permitAll()
                    .requestMatchers("/api/**")
                    .authenticated()
                    .anyRequest()
                    .denyAll())
        .oauth2ResourceServer(
            resourceServer ->
                resourceServer.jwt(
                    jwt ->
                        jwt.jwtAuthenticationConverter(jwtAuthenticationConverter)))
        .exceptionHandling(
            exceptions ->
                exceptions.authenticationEntryPoint(
                    (request, response, authException) ->
                        writeAuthError(
                            response,
                            objectMapper,
                            HttpServletResponse.SC_UNAUTHORIZED,
                            "session_invalid",
                            "Please sign in again.")));
    return http.build();
  }

  @Bean
  CorsConfigurationSource corsConfigurationSource(
      @Value("${beez.auth.allowed-origins}") String configuredOrigins) {
    CorsConfiguration configuration = new CorsConfiguration();
    configuration.setAllowedOrigins(
        Arrays.stream(configuredOrigins.split(","))
            .map(String::trim)
            .filter(origin -> !origin.isEmpty())
            .toList());
    configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
    configuration.setAllowedHeaders(
        List.of("Authorization", "Content-Type", "X-Beez-Client", "Idempotency-Key"));
    configuration.setExposedHeaders(List.of("X-Request-Id"));
    configuration.setAllowCredentials(true);
    configuration.setMaxAge(3600L);

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", configuration);
    return source;
  }

  private static void writeAuthError(
      HttpServletResponse response,
      ObjectMapper objectMapper,
      int status,
      String code,
      String message)
      throws IOException {
    response.setStatus(status);
    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Pragma", "no-cache");
    objectMapper.writeValue(
        response.getOutputStream(),
        new AuthErrorResponse(
            code, message, Map.of(), java.util.UUID.randomUUID().toString()));
  }

  public record AuthErrorResponse(
      String error, String message, Map<String, Object> details, String requestId) {}
}
