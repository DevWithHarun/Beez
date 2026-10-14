package com.beez.auth.service;

import org.springframework.http.HttpStatus;

public class OtpRejectedException extends AuthException {
  public OtpRejectedException(String code, String message) {
    super(code, message, HttpStatus.UNAUTHORIZED);
  }
}
