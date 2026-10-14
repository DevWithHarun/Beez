package com.beez.operations.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.beez.auth.service.AuthService;
import com.beez.catalogue.service.CatalogueService;
import com.beez.operations.api.OperationsException;
import com.beez.operations.api.OperationsModels.OperationsSummary;
import com.beez.operations.api.OperationsModels.PendingRider;
import com.beez.wallet.service.MerchantWalletService;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class OperationsServiceTest {
  @Test
  void rejectsNonAdminActorsBeforeReadingOperationsQueues() {
    JdbcTemplate jdbc = mock(JdbcTemplate.class);
    OperationsService operations =
        new OperationsService(
            jdbc,
            mock(MerchantWalletService.class),
            mock(CatalogueService.class),
            mock(AuthService.class));
    UUID actor = UUID.randomUUID();
    when(jdbc.queryForObject(anyString(), eq(Boolean.class), eq(actor))).thenReturn(false);

    assertThatThrownBy(() -> operations.pendingRiders(actor))
        .isInstanceOf(OperationsException.class)
        .satisfies(
            error ->
                assertThat(((OperationsException) error).status().value()).isEqualTo(403));
  }

  @Test
  void pendingRidersSelectsAreaUnderTheNameUsedByTheRowMapper() {
    JdbcTemplate jdbc = mock(JdbcTemplate.class);
    OperationsService operations =
        new OperationsService(
            jdbc,
            mock(MerchantWalletService.class),
            mock(CatalogueService.class),
            mock(AuthService.class));
    UUID actor = UUID.randomUUID();
    when(jdbc.queryForObject(anyString(), eq(Boolean.class), eq(actor))).thenReturn(true);
    when(jdbc.query(anyString(), ArgumentMatchers.<RowMapper<PendingRider>>any()))
        .thenReturn(List.of());

    operations.pendingRiders(actor);

    ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
    verify(jdbc).query(sql.capture(), ArgumentMatchers.<RowMapper<PendingRider>>any());
    assertThat(sql.getValue()).contains("u.onboarding_area AS area");
  }

  @Test
  void operationsSummaryUsesNairobiDayBoundsAndVerifiedBasketMetrics() {
    JdbcTemplate jdbc = mock(JdbcTemplate.class);
    OperationsService operations =
        new OperationsService(
            jdbc,
            mock(MerchantWalletService.class),
            mock(CatalogueService.class),
            mock(AuthService.class));
    UUID actor = UUID.randomUUID();
    when(jdbc.queryForObject(anyString(), eq(Boolean.class), eq(actor))).thenReturn(true);
    OperationsSummary expected =
        new OperationsSummary(3, 4500, 2, 1, 24L, 4, 1, 1, 2, 3, 1, 1, 9,
            java.time.Instant.now());
    when(jdbc.queryForObject(
            anyString(),
            ArgumentMatchers.<RowMapper<OperationsSummary>>any(),
            ArgumentMatchers.<Object>any(),
            ArgumentMatchers.<Object>any()))
        .thenReturn(expected);

    OperationsSummary actual = operations.operationsSummary(actor);

    assertThat(actual).isEqualTo(expected);
    ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
    ArgumentCaptor<Object> bounds = ArgumentCaptor.forClass(Object.class);
    verify(jdbc)
        .queryForObject(
            sql.capture(),
            ArgumentMatchers.<RowMapper<OperationsSummary>>any(),
            bounds.capture(),
            bounds.capture());
    assertThat(sql.getValue())
        .contains("FROM baskets b")
        .contains("p.status = 'SUCCEEDED'")
        .contains("average_delivery_minutes")
        .contains("payment_issues")
        .contains("pending_withdrawals + pending_refunds");
    LocalDate businessDate = LocalDate.now(ZoneId.of("Africa/Nairobi"));
    assertThat(bounds.getAllValues())
        .containsExactly(
            Timestamp.from(businessDate.atStartOfDay(ZoneId.of("Africa/Nairobi")).toInstant()),
            Timestamp.from(
                businessDate.plusDays(1).atStartOfDay(ZoneId.of("Africa/Nairobi")).toInstant()));
  }
}
