package com.beez.adapters.africastalking;

import com.beez.auth.service.AuthException;
import com.beez.auth.spi.SmsSender;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
@Profile("!prod & !sandbox")
public class UnavailableSmsSender implements SmsSender {
  @Override
  public void send(String phoneNumber, String message) {
    throw new AuthException(
        "sms_unavailable",
        "SMS delivery is not configured in this environment.",
        HttpStatus.SERVICE_UNAVAILABLE);
  }
}
