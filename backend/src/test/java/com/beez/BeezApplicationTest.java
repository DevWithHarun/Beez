package com.beez;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
class BeezApplicationTest {
  @Container
  static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16-alpine");

  @DynamicPropertySource
  static void configureProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
    registry.add(
        "beez.auth.jwt-signing-key",
        () ->
            java.util.Base64.getEncoder()
                .encodeToString("integration-test-jwt-signing-key-32-bytes".getBytes()));
    registry.add("beez.auth.otp-hmac-key", () -> "integration-test-otp-hmac-key-32-bytes");
    registry.add("spring.data.redis.url", () -> "redis://localhost:6379");
  }

  @Test
  void applicationContextLoads() {}
}
