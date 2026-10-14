package com.beez.wallet.api;

import org.springframework.http.HttpStatus;

public class MerchantWalletException extends RuntimeException {
  private final String code;
  private final HttpStatus status;

  public MerchantWalletException(String code, String message, HttpStatus status) {
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
