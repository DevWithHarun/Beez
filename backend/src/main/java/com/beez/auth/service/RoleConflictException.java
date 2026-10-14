package com.beez.auth.service;

import org.springframework.http.HttpStatus;

public class RoleConflictException extends AuthException {
  public RoleConflictException() {
    super(
        "role_conflict",
        "This phone number is already registered for another account type.",
        HttpStatus.CONFLICT);
  }
}
