package com.beez.voice.api;

import org.springframework.http.HttpStatus;

public class VoiceException extends RuntimeException {
  private final String code;
  private final HttpStatus status;

  public VoiceException(String code, String message, HttpStatus status) {
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
