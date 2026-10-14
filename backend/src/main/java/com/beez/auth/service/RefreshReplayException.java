package com.beez.auth.service;

import org.springframework.http.HttpStatus;

public class RefreshReplayException extends AuthException {
  public RefreshReplayException() {
    super(
        "refresh_reused",
        "This session is no longer valid. Please sign in again.",
        HttpStatus.UNAUTHORIZED);
  }
}
