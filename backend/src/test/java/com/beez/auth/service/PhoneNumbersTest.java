package com.beez.auth.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class PhoneNumbersTest {
  @Test
  void normalizesKenyanNationalAndInternationalFormats() {
    assertEquals("+254712345678", PhoneNumbers.normalizeKenyanMobile("0712 345 678"));
    assertEquals("+254112345678", PhoneNumbers.normalizeKenyanMobile("+254 (112) 345-678"));
    assertEquals("+254712345678", PhoneNumbers.normalizeKenyanMobile("254712345678"));
  }

  @Test
  void rejectsNonMobileAndMalformedNumbers() {
    assertThrows(AuthException.class, () -> PhoneNumbers.normalizeKenyanMobile("+254201234567"));
    assertThrows(AuthException.class, () -> PhoneNumbers.normalizeKenyanMobile("07123"));
    assertThrows(AuthException.class, () -> PhoneNumbers.normalizeKenyanMobile("letters"));
  }
}
