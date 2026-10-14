package com.beez.notification;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.beez.auth.spi.SmsSender;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class MerchantOrderAlertServiceTest {
  @Test
  void deliversQueuedOrderAlertWithoutIncludingCustomerDetails() {
    JdbcTemplate jdbc = mock(JdbcTemplate.class);
    SmsSender smsSender = mock(SmsSender.class);
    UUID alertId = UUID.randomUUID();
    UUID orderId = UUID.randomUUID();
    UUID merchantId = UUID.randomUUID();
    MerchantOrderAlertService.OrderAlert alert =
        new MerchantOrderAlertService.OrderAlert(alertId, orderId, merchantId, 1);
    when(
            jdbc.query(
                anyString(),
                ArgumentMatchers.<RowMapper<MerchantOrderAlertService.OrderAlert>>any()))
        .thenReturn(List.of(alert));
    when(
            jdbc.query(
                anyString(),
                ArgumentMatchers.<RowMapper<MerchantOrderAlertService.Recipient>>any(),
                any(Object[].class)))
        .thenReturn(List.of(new MerchantOrderAlertService.Recipient("+254712345678", "Mama Amina")));

    new MerchantOrderAlertService(jdbc, smsSender).deliverQueuedAlerts();

    verify(smsSender)
        .send(
            "+254712345678",
            "Beez: A new paid order has arrived for Mama Amina. Sign in to review and prepare it.");
    verify(jdbc)
        .update(
            anyString(),
            eq(alertId));
  }
}
