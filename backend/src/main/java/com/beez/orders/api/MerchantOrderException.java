package com.beez.orders.api;

import org.springframework.http.HttpStatus;

public class MerchantOrderException extends RuntimeException {
  private final String code;
  private final HttpStatus status;

  public MerchantOrderException(String code, String message, HttpStatus status) {
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
