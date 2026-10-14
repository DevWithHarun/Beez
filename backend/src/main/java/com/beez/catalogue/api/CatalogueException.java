package com.beez.catalogue.api;

import org.springframework.http.HttpStatus;

public class CatalogueException extends RuntimeException {
  private final String code;
  private final HttpStatus status;

  public CatalogueException(String code, String message, HttpStatus status) {
    super(message);
    this.code = code;
    this.status = status;
  }

  public String getCode() {
    return code;
  }

  public HttpStatus getStatus() {
    return status;
  }
}
