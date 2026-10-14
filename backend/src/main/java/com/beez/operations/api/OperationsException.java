package com.beez.operations.api;

import org.springframework.http.HttpStatus;

public class OperationsException extends RuntimeException {
  private final String code;
  private final HttpStatus status;

  public OperationsException(String code, String message, HttpStatus status) {
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
