package com.beez.orders.service;

import static com.beez.orders.api.MerchantOrderModels.*;

import com.beez.dispatch.service.DispatchService;
import com.beez.orders.api.MerchantOrderException;
import com.beez.orders.repo.MerchantOrderRepository;
import com.beez.orders.repo.MerchantOrderRepository.OrderCursor;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MerchantOrderService {
  private static final int PAGE_SIZE = 20;
  private static final List<String> FILTER_STATUSES =
      List.of("PAID", "READY", "PICKED_UP", "DELIVERED", "REJECTED");
  private final MerchantOrderRepository orders;
  private final DispatchService dispatch;

  public MerchantOrderService(MerchantOrderRepository orders, DispatchService dispatch) {
    this.orders = orders;
    this.dispatch = dispatch;
  }

  public OrderSummary summary(UUID userId) {
    return orders.summary(userId);
  }

  public TodaySummary todaySummary(UUID userId) {
    return orders.todaySummary(userId);
  }

  public OrderPage list(UUID userId, String rawStatus, String encodedCursor) {
    String status = normalizeStatus(rawStatus);
    OrderCursor cursor = decodeCursor(encodedCursor);
    List<MerchantOrder> results = orders.list(userId, status, cursor, PAGE_SIZE + 1);
    boolean hasMore = results.size() > PAGE_SIZE;
    List<MerchantOrder> page = hasMore ? results.subList(0, PAGE_SIZE) : results;
    String nextCursor = hasMore ? encodeCursor(page.getLast()) : null;
    return new OrderPage(page, nextCursor);
  }

  public MerchantOrder get(UUID userId, UUID orderId) {
    MerchantOrder order = orders.find(userId, orderId);
    if (order == null) {
      throw new MerchantOrderException(
          "order_not_found", "This order was not found.", HttpStatus.NOT_FOUND);
    }
    return order;
  }

  @Transactional
  public MerchantOrder markReady(UUID userId, UUID orderId) {
    MerchantOrder order = orders.markReady(userId, orderId);
    if (order == null) {
      throw new MerchantOrderException(
          "order_transition_invalid",
          "Only paid orders can be marked ready. Refresh the order and try again.",
          HttpStatus.CONFLICT);
    }
    UUID basketId = orders.basketId(userId, orderId);
    if (basketId != null) dispatch.queueIfReady(basketId);
    return order;
  }

  @Transactional
  public MerchantOrder rejectPaidOrder(UUID userId, UUID orderId, String reason) {
    if (reason == null || reason.isBlank() || reason.trim().length() > 240) {
      throw new MerchantOrderException(
          "order_rejection_reason_invalid",
          "Enter a reason of 1 to 240 characters.",
          HttpStatus.BAD_REQUEST);
    }
    MerchantOrder order = orders.rejectPaidOrder(userId, orderId, reason.trim());
    if (order == null) {
      throw new MerchantOrderException(
          "order_transition_invalid",
          "Only orders that are still being prepared can be rejected.",
          HttpStatus.CONFLICT);
    }
    UUID basketId = orders.basketId(userId, orderId);
    if (basketId != null) dispatch.queueIfReady(basketId);
    return order;
  }
  private static String normalizeStatus(String status) {
    if (status == null || status.isBlank()) return null;
    String normalized = status.trim().toUpperCase(java.util.Locale.ROOT);
    if (!FILTER_STATUSES.contains(normalized)) {
      throw new MerchantOrderException(
          "order_status_invalid",
          "Choose a valid order status filter.",
          HttpStatus.BAD_REQUEST);
    }
    return normalized;
  }

  private static OrderCursor decodeCursor(String cursor) {
    if (cursor == null || cursor.isBlank()) return null;
    try {
      String decoded =
          new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
      int separator = decoded.lastIndexOf('|');
      if (separator <= 0) throw new IllegalArgumentException("Cursor is incomplete.");
      Instant paidAt = Instant.parse(decoded.substring(0, separator));
      UUID id = UUID.fromString(decoded.substring(separator + 1));
      return new OrderCursor(paidAt, id);
    } catch (IllegalArgumentException exception) {
      throw new MerchantOrderException(
          "order_cursor_invalid",
          "Refresh the order list and try again.",
          HttpStatus.BAD_REQUEST);
    }
  }

  private static String encodeCursor(MerchantOrder order) {
    String raw = order.paidAt() + "|" + order.id();
    return Base64.getUrlEncoder()
        .withoutPadding()
        .encodeToString(raw.getBytes(StandardCharsets.UTF_8));
  }
}
