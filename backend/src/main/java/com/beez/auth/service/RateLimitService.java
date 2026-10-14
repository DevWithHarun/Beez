package com.beez.auth.service;

import java.time.Duration;
import java.util.List;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class RateLimitService {
  private static final DefaultRedisScript<Long> INCREMENT_WITH_EXPIRY =
      new DefaultRedisScript<>(
          "local count = redis.call('INCR', KEYS[1]) "
              + "if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end "
              + "return count",
          Long.class);

  private final StringRedisTemplate redis;

  public RateLimitService(StringRedisTemplate redis) {
    this.redis = redis;
  }

  public void enforce(String key, long maximum, Duration window) {
    Long count;
    try {
      count =
          redis.execute(
              INCREMENT_WITH_EXPIRY,
              List.of(key),
              Long.toString(window.toSeconds()));
    } catch (DataAccessException exception) {
      throw unavailable();
    }

    if (count == null) {
      throw unavailable();
    }
    if (count > maximum) {
      throw new AuthException(
          "rate_limited",
          "Too many attempts. Please wait before trying again.",
          HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  public void acquireCooldown(String key, Duration cooldown) {
    Boolean acquired;
    try {
      acquired = redis.opsForValue().setIfAbsent(key, "1", cooldown);
    } catch (DataAccessException exception) {
      throw unavailable();
    }

    if (!Boolean.TRUE.equals(acquired)) {
      throw new AuthException(
          "rate_limited",
          "Please wait before requesting another code.",
          HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private static AuthException unavailable() {
    return new AuthException(
        "rate_limit_unavailable",
        "Sign-in is temporarily unavailable. Please try again shortly.",
        HttpStatus.SERVICE_UNAVAILABLE);
  }
}
