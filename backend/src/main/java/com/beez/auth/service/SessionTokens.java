package com.beez.auth.service;

import com.beez.auth.domain.UserAccount;
import java.time.Instant;
import java.util.UUID;

public record SessionTokens(
    String accessToken,
    String refreshToken,
    Instant refreshExpiresAt,
    UserAccount user) {}
