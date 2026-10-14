package com.beez.auth.repo;

import com.beez.auth.domain.OtpChallenge;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

public interface OtpChallengeRepository extends JpaRepository<OtpChallenge, UUID> {
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select challenge from OtpChallenge challenge where challenge.id = :id")
  Optional<OtpChallenge> findByIdForUpdate(@Param("id") UUID id);

  @Modifying
  @Query(
      "update OtpChallenge challenge set challenge.consumedAt = :now "
          + "where challenge.phone = :phone and challenge.consumedAt is null")
  int consumeOutstanding(@Param("phone") String phone, @Param("now") Instant now);
}
