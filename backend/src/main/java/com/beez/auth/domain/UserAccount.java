package com.beez.auth.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(name = "users")
public class UserAccount {
  @Id
  @UuidGenerator
  private UUID id;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 16)
  private UserRole role;

  @Column(unique = true, length = 16)
  private String phone;

  @Column(name = "display_name", length = 120)
  private String displayName;

  @Column(name = "shop_name", length = 120)
  private String shopName;

  @Column(name = "onboarding_area", length = 120)
  private String area;

  @Column(nullable = false, length = 5)
  private String language = "sw";

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 16)
  private UserStatus status = UserStatus.ACTIVE;

  @Column(name = "token_version", nullable = false)
  private int tokenVersion;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "last_login_at")
  private Instant lastLoginAt;

  protected UserAccount() {}

  public UserAccount(String phone, UserRole role, Instant now) {
    this.phone = phone;
    this.role = role;
    this.createdAt = now;
    this.lastLoginAt = now;
  }

  @PrePersist
  void initializeCreatedAt() {
    if (createdAt == null) {
      createdAt = Instant.now();
    }
  }

  public UUID getId() {
    return id;
  }

  public UserRole getRole() {
    return role;
  }

  public String getPhone() {
    return phone;
  }

  public String getDisplayName() {
    return displayName;
  }

  public void setDisplayName(String displayName) {
    this.displayName = displayName == null ? null : displayName.trim();
  }

  public String getShopName() {
    return shopName;
  }

  public void setShopName(String shopName) {
    this.shopName = shopName == null ? null : shopName.trim();
  }

  public String getArea() {
    return area;
  }

  public void setArea(String area) {
    this.area = area == null ? null : area.trim();
  }

  public String getLanguage() {
    return language;
  }

  public void setLanguage(String language) {
    this.language = language == null ? this.language : language.trim().toLowerCase(Locale.ROOT);
  }

  public boolean isOnboardingRequired() {
    return displayName == null
        || displayName.isBlank()
        || area == null
        || area.isBlank()
        || (role == UserRole.MERCHANT && (shopName == null || shopName.isBlank()));
  }

  public UserStatus getStatus() {
    return status;
  }

  public void setStatus(UserStatus status) {
    this.status = status;
  }

  public int getTokenVersion() {
    return tokenVersion;
  }

  public Instant getLastLoginAt() {
    return lastLoginAt;
  }

  public void setLastLoginAt(Instant lastLoginAt) {
    this.lastLoginAt = lastLoginAt;
  }

  public void incrementTokenVersion() {
    tokenVersion++;
  }
}
