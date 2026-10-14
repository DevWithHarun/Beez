package com.beez.auth.service;

import com.beez.auth.domain.OtpChallenge;
import com.beez.auth.domain.UserRole;
import com.beez.auth.repo.OtpChallengeRepository;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OtpChallengeManager {
  private final OtpChallengeRepository challenges;

  public OtpChallengeManager(OtpChallengeRepository challenges) {
    this.challenges = challenges;
  }

  @Transactional
  public void create(UUID id, String phone, UserRole role, byte[] codeHmac, Instant now) {
    challenges.consumeOutstanding(phone, now);
    challenges.save(
        new OtpChallenge(id, phone, role, codeHmac, now.plusSeconds(300), now));
  }

  @Transactional
  public void consume(UUID id, Instant now) {
    challenges
        .findByIdForUpdate(id)
        .ifPresent(
            challenge -> {
              if (challenge.getConsumedAt() == null) {
                challenge.consume(now);
                challenges.save(challenge);
              }
            });
  }
}
