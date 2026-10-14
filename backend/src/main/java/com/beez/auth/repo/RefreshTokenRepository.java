package com.beez.auth.repo;

import com.beez.auth.domain.RefreshToken;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select token from RefreshToken token where token.tokenHash = :hash")
  Optional<RefreshToken> findByTokenHashForUpdate(@Param("hash") byte[] hash);

  @Modifying
  @Query("update RefreshToken token set token.revokedAt = :now where token.familyId = :familyId")
  int revokeFamily(@Param("familyId") UUID familyId, @Param("now") Instant now);

  @Modifying
  @Query("update RefreshToken token set token.revokedAt = :now where token.userId = :userId and token.revokedAt is null")
  int revokeAllForUser(@Param("userId") UUID userId, @Param("now") Instant now);

  List<RefreshToken> findByUserIdAndRevokedAtIsNull(UUID userId);
}
