package com.beez.config;

import com.beez.auth.domain.UserAccount;
import com.beez.auth.domain.UserStatus;
import com.beez.auth.repo.UserAccountRepository;
import java.util.Base64;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import com.nimbusds.jose.jwk.source.ImmutableSecret;

@Configuration
public class JwtConfiguration {
  @Bean
  SecretKey jwtSecretKey(@Value("${beez.auth.jwt-signing-key}") String configuredKey) {
    try {
      byte[] decoded = Base64.getDecoder().decode(configuredKey);
      if (decoded.length < 32) {
        throw new IllegalStateException("JWT_SIGNING_KEY must decode to at least 32 bytes.");
      }
      return new SecretKeySpec(decoded, "HmacSHA256");
    } catch (IllegalArgumentException exception) {
      throw new IllegalStateException("JWT_SIGNING_KEY must be a base64-encoded secret.", exception);
    }
  }

  @Bean
  JwtEncoder jwtEncoder(SecretKey jwtSecretKey) {
    return new NimbusJwtEncoder(new ImmutableSecret<>(jwtSecretKey));
  }

  @Bean
  JwtDecoder jwtDecoder(
      SecretKey jwtSecretKey,
      UserAccountRepository users,
      @Value("${beez.auth.jwt-issuer}") String issuer,
      @Value("${beez.auth.jwt-audience}") String audience) {
    NimbusJwtDecoder decoder =
        NimbusJwtDecoder.withSecretKey(jwtSecretKey)
            .macAlgorithm(MacAlgorithm.HS256)
            .build();

    OAuth2TokenValidator<Jwt> audienceValidator =
        jwt ->
            jwt.getAudience().contains(audience)
                ? OAuth2TokenValidatorResult.success()
                : invalidToken("Invalid token audience.");
    OAuth2TokenValidator<Jwt> accountValidator =
        jwt -> {
          try {
            UserAccount user = users.findById(java.util.UUID.fromString(jwt.getSubject())).orElse(null);
            Number tokenVersion = jwt.getClaim("tokenVersion");
            String status = jwt.getClaimAsString("status");
            if (user != null
                && user.getStatus() == UserStatus.ACTIVE
                && user.getRole().name().equals(jwt.getClaimAsString("role"))
                && tokenVersion != null
                && tokenVersion.intValue() == user.getTokenVersion()
                && status != null
                && status.equals(user.getStatus().name())) {
              return OAuth2TokenValidatorResult.success();
            }
          } catch (IllegalArgumentException ignored) {
            return invalidToken("Invalid token subject.");
          }
          return invalidToken("Session is no longer valid.");
        };

    decoder.setJwtValidator(
        new org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator<>(
            JwtValidators.createDefaultWithIssuer(issuer), audienceValidator, accountValidator));
    return decoder;
  }

  private static OAuth2TokenValidatorResult invalidToken(String description) {
    return OAuth2TokenValidatorResult.failure(
        new OAuth2Error("invalid_token", description, null));
  }
}
