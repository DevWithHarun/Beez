package com.beez.admin.auth;

import org.springframework.http.HttpStatus;

public class AdminAuthException extends RuntimeException {
  private final String code;
  private final HttpStatus status;

  public AdminAuthException(String code, String message, HttpStatus status) {
    super(message);
    this.code = code;
    this.status = status;
  }

  public String code() {
    return code;
  }

  public HttpStatus status() {
    return status;
  }
}
