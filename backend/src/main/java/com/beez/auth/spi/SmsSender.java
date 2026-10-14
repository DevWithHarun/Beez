package com.beez.auth.spi;

public interface SmsSender {
  void send(String phoneNumber, String message);
}
