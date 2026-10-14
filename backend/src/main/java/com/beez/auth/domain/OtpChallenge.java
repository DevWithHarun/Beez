package com.beez.auth.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "otp_challenges")
public class OtpChallenge {
  @Id
  private UUID id;

  @Column(nullable = false, length = 16)
  private String phone;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 16)
  private UserRole role;

  @Column(nullable = false, length = 16)
  private String purpose = "LOGIN";

  @Column(name = "code_hmac", nullable = false, columnDefinition = "bytea")
  private byte[] codeHmac;

  @Column(nullable = false, length = 8)
  private String channel = "SMS";

  @Column(nullable = false)
  private short attempts;

  @Column(name = "max_attempts", nullable = false)
  private short maxAttempts = 5;

  @Column(name = "expires_at", nullable = false)
  private Instant expiresAt;

  @Column(name = "consumed_at")
  private Instant consumedAt;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  protected OtpChallenge() {}

  public OtpChallenge(
      UUID id, String phone, UserRole role, byte[] codeHmac, Instant expiresAt, Instant createdAt) {
    this.id = id;
    this.phone = phone;
    this.role = role;
    this.codeHmac = codeHmac.clone();
    this.expiresAt = expiresAt;
    this.createdAt = createdAt;
  }

  public UUID getId() {
    return id;
  }

  public String getPhone() {
    return phone;
  }

  public UserRole getRole() {
    return role;
  }

  public byte[] getCodeHmac() {
    return codeHmac.clone();
  }

  public short getAttempts() {
    return attempts;
  }

  public short getMaxAttempts() {
    return maxAttempts;
  }

  public Instant getExpiresAt() {
    return expiresAt;
  }

  public Instant getConsumedAt() {
    return consumedAt;
  }

  public void recordAttempt() {
    attempts++;
  }

  public void consume(Instant now) {
    consumedAt = now;
  }

  public boolean isUsableAt(Instant now) {
    return consumedAt == null && expiresAt.isAfter(now) && attempts < maxAttempts;
  }
}
