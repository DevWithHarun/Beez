package com.beez.dispatch.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class DeliveryCodeServiceTest {
  private final DeliveryCodeService deliveryCodes =
      new DeliveryCodeService("0123456789abcdef0123456789abcdef");

  @Test
  void derivesAStableSixDigitCodeFromTheBasketCapabilityAndVerifiesItsHash() {
    String code = deliveryCodes.generate("tracking-capability");

    assertThat(code).matches("[0-9]{6}");
    assertThat(deliveryCodes.generate("tracking-capability")).isEqualTo(code);
    assertThat(deliveryCodes.matches(code, deliveryCodes.hash(code))).isTrue();
    String wrongCode = "000000".equals(code) ? "000001" : "000000";
    assertThat(deliveryCodes.matches(wrongCode, deliveryCodes.hash(code))).isFalse();
    assertThat(deliveryCodes.generate("another-tracking-capability")).matches("[0-9]{6}");
  }

  @Test
  void requiresABasketCapabilityToGenerateTheCode() {
    assertThatThrownBy(() -> deliveryCodes.generate(" "))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
