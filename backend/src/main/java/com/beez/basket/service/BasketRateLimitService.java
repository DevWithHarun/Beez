package com.beez.basket.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BasketRateLimitService {
  private final JdbcTemplate jdbc;
  private final String secret;

  public BasketRateLimitService(
      JdbcTemplate jdbc, @Value("${beez.basket.rate-limit-secret}") String secret) {
    this.jdbc = jdbc;
    this.secret = secret;
  }

  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public int registerCheckoutAttempt(String clientAddress) {
    return jdbc.queryForObject(
        """
        INSERT INTO public_rate_limits (key_hash, window_started_at, request_count)
        VALUES (?, date_trunc('hour', now()), 1)
        ON CONFLICT (key_hash) DO UPDATE
           SET request_count =
                 CASE WHEN public_rate_limits.window_started_at < date_trunc('hour', now())
                      THEN 1 ELSE public_rate_limits.request_count + 1 END,
               window_started_at =
                 CASE WHEN public_rate_limits.window_started_at < date_trunc('hour', now())
                      THEN date_trunc('hour', now())
                      ELSE public_rate_limits.window_started_at END
        RETURNING request_count
        """,
        Integer.class,
        BasketDigests.sha256(secret + "|basket-create-ip|" + clientAddress));
  }
}
