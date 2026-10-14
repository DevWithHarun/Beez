package com.beez.orders.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.beez.orders.api.MerchantOrderException;
import com.beez.orders.api.MerchantOrderModels.MerchantOrder;
import com.beez.orders.repo.MerchantOrderRepository;
import com.beez.dispatch.service.DispatchService;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MerchantOrderServiceTest {
  private final MerchantOrderRepository repository = mock(MerchantOrderRepository.class);
  private final DispatchService dispatch = mock(DispatchService.class);
  private final MerchantOrderService service = new MerchantOrderService(repository, dispatch);
  private final UUID userId = UUID.randomUUID();

  @Test
  void returnsTwentyOrdersAndCursorForNextPage() {
    List<MerchantOrder> rows = new ArrayList<>();
    for (int index = 0; index < 21; index++) rows.add(order(index));
    when(repository.list(userId, "READY", null, 21)).thenReturn(rows);

    var page = service.list(userId, " ready ", null);

    assertThat(page.items()).hasSize(20);
    assertThat(page.nextCursor()).isNotBlank();
    verify(repository).list(userId, "READY", null, 21);
  }

  @Test
  void decodesCursorBeforeQueryingNextPage() {
    Instant paidAt = Instant.parse("2026-10-12T20:00:00Z");
    UUID orderId = UUID.randomUUID();
    String cursor =
        java.util.Base64.getUrlEncoder()
            .withoutPadding()
            .encodeToString((paidAt + "|" + orderId).getBytes(java.nio.charset.StandardCharsets.UTF_8));
    when(repository.list(
            userId,
            null,
            new MerchantOrderRepository.OrderCursor(paidAt, orderId),
            21))
        .thenReturn(List.of());

    assertThat(service.list(userId, null, cursor).items()).isEmpty();
  }

  @Test
  void rejectsInvalidStatusAndCursor() {
    assertThatThrownBy(() -> service.list(userId, "AWAITING_PAYMENT", null))
        .isInstanceOf(MerchantOrderException.class)
        .hasMessageContaining("valid order status");
    assertThatThrownBy(() -> service.list(userId, null, "not-a-cursor"))
        .isInstanceOf(MerchantOrderException.class)
        .hasMessageContaining("Refresh the order list");
  }

  @Test
  void rejectsOrderTransitionWhenRepositoryCannotMakeItReady() {
    UUID orderId = UUID.randomUUID();
    when(repository.markReady(userId, orderId)).thenReturn(null);

    assertThatThrownBy(() -> service.markReady(userId, orderId))
        .isInstanceOf(MerchantOrderException.class)
        .hasMessageContaining("Only paid orders");
  }

  private static MerchantOrder order(int index) {
    return new MerchantOrder(
        UUID.randomUUID(),
        "BZ-" + (1001 + index),
        "READY",
        500,
        Instant.parse("2026-10-12T20:00:00Z").minusSeconds(index),
        null,
        "Customer",
        "+254712345678",
        "Westlands",
        null,
        null,
        null,
        List.of());
  }
}
