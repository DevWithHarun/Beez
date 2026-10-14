package com.beez.dispatch.api;

import org.springframework.http.HttpStatus;

public class DispatchException extends RuntimeException {
  private final String code;
  private final HttpStatus status;

  public DispatchException(String code, String message, HttpStatus status) {
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
