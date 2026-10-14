package com.beez.wallet.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class RiderEarningsSettlementTest {
  private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
  private final MerchantWalletService wallet = new MerchantWalletService(jdbc);

  @Test
  void creditsNinetyFivePercentAndBooksFivePercentToThePlatform() {
    UUID deliveryId = UUID.randomUUID();
    UUID riderId = UUID.randomUUID();
    UUID customerFundsId = UUID.randomUUID();
    UUID platformRevenueId = UUID.randomUUID();
    UUID riderAccountId = UUID.randomUUID();

    when(jdbc.update(
            anyString(),
            any(UUID.class),
            anyString(),
            any(UUID.class),
            anyString()))
        .thenReturn(1);
    when(jdbc.queryForObject(anyString(), eq(UUID.class), any()))
        .thenReturn(customerFundsId, platformRevenueId, riderAccountId);

    wallet.recordRiderDelivery(deliveryId, riderId, 1000);

    verify(jdbc)
        .update(
            anyString(),
            any(UUID.class),
            eq("RIDER_DELIVERY"),
            eq(deliveryId),
            eq("Rider earnings after verified delivery"));
    verify(jdbc)
        .update(
            anyString(),
            any(UUID.class),
            eq(customerFundsId),
            eq(-1000L));
    verify(jdbc)
        .update(
            anyString(),
            any(UUID.class),
            eq(riderAccountId),
            eq(950L));
    verify(jdbc)
        .update(
            anyString(),
            any(UUID.class),
            eq(platformRevenueId),
            eq(50L));
  }

  @Test
  void doesNotCreateLedgerEntriesForAZeroDeliveryFee() {
    wallet.recordRiderDelivery(UUID.randomUUID(), UUID.randomUUID(), 0);

    verifyNoInteractions(jdbc);
  }
}
