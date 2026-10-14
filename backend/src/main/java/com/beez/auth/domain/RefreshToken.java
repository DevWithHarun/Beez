package com.beez.auth.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(name = "refresh_tokens")
public class RefreshToken {
  @Id
  @UuidGenerator
  private UUID id;

  @Column(name = "user_id", nullable = false)
  private UUID userId;

  @Column(name = "family_id", nullable = false)
  private UUID familyId;

  @Column(name = "token_hash", nullable = false, unique = true, columnDefinition = "bytea")
  private byte[] tokenHash;

  @Column(name = "expires_at", nullable = false)
  private Instant expiresAt;

  @Column(name = "family_expires_at", nullable = false)
  private Instant familyExpiresAt;

  @Column(name = "rotated_at")
  private Instant rotatedAt;

  @Column(name = "revoked_at")
  private Instant revokedAt;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "user_agent", length = 255)
  private String userAgent;

  protected RefreshToken() {}

  public RefreshToken(
      UUID userId,
      UUID familyId,
      byte[] tokenHash,
      Instant expiresAt,
      Instant familyExpiresAt,
      Instant createdAt,
      String userAgent) {
    this.userId = userId;
    this.familyId = familyId;
    this.tokenHash = tokenHash.clone();
    this.expiresAt = expiresAt;
    this.familyExpiresAt = familyExpiresAt;
    this.createdAt = createdAt;
    this.userAgent = userAgent;
  }

  public UUID getId() {
    return id;
  }

  public UUID getUserId() {
    return userId;
  }

  public UUID getFamilyId() {
    return familyId;
  }

  public Instant getExpiresAt() {
    return expiresAt;
  }

  public Instant getFamilyExpiresAt() {
    return familyExpiresAt;
  }

  public Instant getRotatedAt() {
    return rotatedAt;
  }

  public Instant getRevokedAt() {
    return revokedAt;
  }

  public void rotate(Instant now) {
    rotatedAt = now;
  }

  public void revoke(Instant now) {
    revokedAt = now;
  }
}
