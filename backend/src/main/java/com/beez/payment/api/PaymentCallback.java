package com.beez.payment.api;

public record PaymentCallback(
    String merchantRequestId,
    String checkoutRequestId,
    int resultCode,
    String description,
    Integer amount,
    String phone,
    String receipt) {}
