package com.beez.auth.service;

import com.beez.common.KenyanMobile;

public final class PhoneNumbers {
  private PhoneNumbers() {}

  public static String normalizeKenyanMobile(String input) {
    try {
      return KenyanMobile.normalize(input);
    } catch (IllegalArgumentException exception) {
      throw new AuthException(
          "invalid_phone",
          exception.getMessage(),
          org.springframework.http.HttpStatus.BAD_REQUEST);
    }
  }
}
