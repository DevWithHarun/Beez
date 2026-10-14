package com.beez.orders.repo;

import static com.beez.orders.api.MerchantOrderModels.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class MerchantOrderRepository {
  private static final RowMapper<MerchantOrder> ORDER_MAPPER =
      (rs, row) ->
          new MerchantOrder(
              rs.getObject("id", UUID.class),
              rs.getString("basket_no"),
              rs.getString("status"),
              rs.getInt("subtotal_kes"),
              rs.getTimestamp("paid_at").toInstant(),
              rs.getTimestamp("ready_at") == null ? null : rs.getTimestamp("ready_at").toInstant(),
              rs.getString("customer_name"),
              rs.getString("customer_phone"),
              rs.getString("delivery_landmark"),
              rs.getString("refund_status"),
              rs.getString("rider_name"),
              rs.getString("rider_phone"),
              List.of());
  private final JdbcTemplate jdbc;

  public MerchantOrderRepository(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @Transactional(readOnly = true)
  public OrderSummary summary(UUID userId) {
    return jdbc.queryForObject(
        """
        SELECT
            count(*) FILTER (WHERE vo.status = 'PAID') AS preparing_count,
            count(*) FILTER (WHERE vo.status = 'READY') AS ready_count,
            count(*) FILTER (
                WHERE vo.paid_at >= (
                    date_trunc('month', now() AT TIME ZONE 'Africa/Nairobi')
                    AT TIME ZONE 'Africa/Nairobi'
                )
                  AND vo.paid_at < (
                    (date_trunc('month', now() AT TIME ZONE 'Africa/Nairobi') + interval '1 month')
                    AT TIME ZONE 'Africa/Nairobi'
                )
            ) AS paid_orders_month,
            COALESCE(
                sum(vo.subtotal_kes) FILTER (
                    WHERE vo.paid_at >= (
                        date_trunc('month', now() AT TIME ZONE 'Africa/Nairobi')
                        AT TIME ZONE 'Africa/Nairobi'
                    )
                      AND vo.paid_at < (
                        (date_trunc('month', now() AT TIME ZONE 'Africa/Nairobi') + interval '1 month')
                        AT TIME ZONE 'Africa/Nairobi'
                    )
                ),
                0
            ) AS merchandise_kes_month
          FROM vendor_orders vo
          JOIN merchants m ON m.id = vo.merchant_id
         WHERE m.user_id = ?
           AND vo.paid_at IS NOT NULL
           AND vo.status IN ('PAID', 'READY', 'PICKED_UP', 'DELIVERED')
        """,
        (rs, row) ->
            new OrderSummary(
                rs.getInt("preparing_count"),
                rs.getInt("ready_count"),
                rs.getInt("paid_orders_month"),
                rs.getLong("merchandise_kes_month")),
        userId);
  }

  @Transactional(readOnly = true)
  public TodaySummary todaySummary(UUID userId) {
    return jdbc.queryForObject(
        """
        SELECT count(*) AS paid_orders_today,
               COALESCE(sum(vo.subtotal_kes), 0) AS merchandise_kes_today
          FROM vendor_orders vo
          JOIN merchants m ON m.id = vo.merchant_id
         WHERE m.user_id = ?
           AND vo.paid_at >= date_trunc('day', now() AT TIME ZONE 'Africa/Nairobi')
                             AT TIME ZONE 'Africa/Nairobi'
           AND vo.paid_at < (date_trunc('day', now() AT TIME ZONE 'Africa/Nairobi')
                              + interval '1 day') AT TIME ZONE 'Africa/Nairobi'
           AND vo.status IN ('PAID', 'READY', 'PICKED_UP', 'DELIVERED')
        """,
        (rs, row) ->
            new TodaySummary(
                rs.getInt("paid_orders_today"), rs.getLong("merchandise_kes_today")),
        userId);
  }

  @Transactional(readOnly = true)
  public List<MerchantOrder> list(
      UUID userId, String status, OrderCursor cursor, int limit) {
    StringBuilder sql =
        new StringBuilder(
            """
            SELECT vo.id, b.basket_no, vo.status, vo.subtotal_kes, vo.paid_at, vo.ready_at,
                   b.customer_name, b.customer_phone, b.delivery_landmark,
                   rr.status AS refund_status, rider.display_name AS rider_name,
                   rider.phone AS rider_phone
              FROM vendor_orders vo
              JOIN merchants m ON m.id = vo.merchant_id
              JOIN baskets b ON b.id = vo.basket_id
              LEFT JOIN merchant_refund_requests rr ON rr.vendor_order_id = vo.id
              LEFT JOIN deliveries d ON d.basket_id = vo.basket_id
              LEFT JOIN users rider ON rider.id = d.rider_user_id
             WHERE m.user_id = ?
               AND vo.paid_at IS NOT NULL
               AND vo.status IN ('PAID', 'READY', 'PICKED_UP', 'DELIVERED', 'REJECTED')
            """);
    List<Object> args = new ArrayList<>();
    args.add(userId);
    if (status != null) {
      sql.append(" AND vo.status = ?");
      args.add(status);
    }
    if (cursor != null) {
      sql.append(" AND (vo.paid_at, vo.id) < (?, ?)");
      args.add(cursor.paidAt());
      args.add(cursor.id());
    }
    sql.append(" ORDER BY vo.paid_at DESC, vo.id DESC LIMIT ?");
    args.add(limit);
    List<MerchantOrder> orders = jdbc.query(sql.toString(), ORDER_MAPPER, args.toArray());
    return withItems(orders);
  }

  @Transactional(readOnly = true)
  public MerchantOrder find(UUID userId, UUID orderId) {
    MerchantOrder order =
        jdbc.query(
                """
                SELECT vo.id, b.basket_no, vo.status, vo.subtotal_kes, vo.paid_at, vo.ready_at,
                       b.customer_name, b.customer_phone, b.delivery_landmark,
                       rr.status AS refund_status, rider.display_name AS rider_name,
                       rider.phone AS rider_phone
                  FROM vendor_orders vo
                  JOIN merchants m ON m.id = vo.merchant_id
                  JOIN baskets b ON b.id = vo.basket_id
                  LEFT JOIN merchant_refund_requests rr ON rr.vendor_order_id = vo.id
                  LEFT JOIN deliveries d ON d.basket_id = vo.basket_id
                  LEFT JOIN users rider ON rider.id = d.rider_user_id
                 WHERE m.user_id = ? AND vo.id = ?
                   AND vo.paid_at IS NOT NULL
                   AND vo.status IN ('PAID', 'READY', 'PICKED_UP', 'DELIVERED', 'REJECTED')
                """,
                ORDER_MAPPER,
                userId,
                orderId)
            .stream()
            .findFirst()
            .orElse(null);
    return order == null ? null : withItems(List.of(order)).get(0);
  }

  @Transactional
  public MerchantOrder markReady(UUID userId, UUID orderId) {
    OrderState state;
    try {
      state =
          jdbc.queryForObject(
              """
              SELECT vo.status, vo.basket_id
                FROM vendor_orders vo
                JOIN merchants m ON m.id = vo.merchant_id
               WHERE m.user_id = ? AND vo.id = ? AND vo.paid_at IS NOT NULL
               FOR UPDATE OF vo
              """,
              (rs, row) ->
                  new OrderState(
                      rs.getString("status"), rs.getObject("basket_id", UUID.class)),
              userId,
              orderId);
    } catch (EmptyResultDataAccessException exception) {
      return null;
    }
    if ("READY".equals(state.status())) return find(userId, orderId);
    if (!"PAID".equals(state.status())) return null;

    jdbc.update(
        """
        UPDATE vendor_orders SET status = 'READY', ready_at = now()
         WHERE id = ? AND status = 'PAID'
        """,
        orderId);
    jdbc.update(
        """
        INSERT INTO vendor_order_events (vendor_order_id, from_status, to_status, actor_user_id)
        VALUES (?, 'PAID', 'READY', ?)
        """,
        orderId,
        userId);
    jdbc.update(
        "UPDATE baskets SET status = 'IN_PROGRESS' WHERE id = ? AND status = 'PAID'",
        state.basketId());
    return find(userId, orderId);
  }

  public UUID basketId(UUID userId, UUID orderId) {
    return jdbc.query(
            """
            SELECT vo.basket_id FROM vendor_orders vo
            JOIN merchants m ON m.id = vo.merchant_id
            WHERE m.user_id = ? AND vo.id = ?
            """,
            (rs, row) -> rs.getObject("basket_id", UUID.class),
            userId,
            orderId)
        .stream()
        .findFirst()
        .orElse(null);
  }

  @Transactional
  public MerchantOrder rejectPaidOrder(UUID userId, UUID orderId, String reason) {
    OrderState state;
    try {
      state =
          jdbc.queryForObject(
              """
              SELECT vo.status, vo.basket_id
                FROM vendor_orders vo
                JOIN merchants m ON m.id = vo.merchant_id
               WHERE m.user_id = ? AND vo.id = ? AND vo.paid_at IS NOT NULL
               FOR UPDATE OF vo
              """,
              (rs, row) ->
                  new OrderState(
                      rs.getString("status"), rs.getObject("basket_id", UUID.class)),
              userId,
              orderId);
    } catch (EmptyResultDataAccessException exception) {
      return null;
    }
    if (!"PAID".equals(state.status())) return null;
    int amount =
        jdbc.queryForObject(
            "SELECT subtotal_kes FROM vendor_orders WHERE id = ?", Integer.class, orderId);
    jdbc.update(
        "UPDATE vendor_orders SET status = 'REJECTED' WHERE id = ? AND status = 'PAID'",
        orderId);
    jdbc.update(
        """
        INSERT INTO vendor_order_events (vendor_order_id, from_status, to_status, actor_user_id)
        VALUES (?, 'PAID', 'REJECTED', ?)
        """,
        orderId,
        userId);
    jdbc.update(
        """
        INSERT INTO merchant_refund_requests
            (vendor_order_id, merchant_user_id, amount_kes, reason, status, resolved_at, resolution_note)
        VALUES (?, ?, ?, ?, ?, CASE WHEN ? = 0 THEN now() ELSE NULL END,
                CASE WHEN ? = 0 THEN 'No merchandise amount to refund.' ELSE NULL END)
        """,
        orderId,
        userId,
        amount,
        reason,
        amount == 0 ? "NOT_REQUIRED" : "PENDING",
        amount,
        amount);
    boolean allRejected =
        Boolean.TRUE.equals(
            jdbc.queryForObject(
                """
                SELECT NOT EXISTS (
                    SELECT 1 FROM vendor_orders
                     WHERE basket_id = ? AND status NOT IN ('REJECTED', 'CANCELLED')
                )
                """,
                Boolean.class,
                state.basketId()));
    if (allRejected) {
      jdbc.update(
          "UPDATE baskets SET status = 'CANCELLED' WHERE id = ? AND status IN ('PAID', 'IN_PROGRESS')",
          state.basketId());
    }
    return find(userId, orderId);
  }

  private List<MerchantOrder> withItems(List<MerchantOrder> orders) {
    if (orders.isEmpty()) return orders;
    String placeholders = String.join(",", java.util.Collections.nCopies(orders.size(), "?"));
    Object[] ids = orders.stream().map(MerchantOrder::id).toArray();
    Map<UUID, List<OrderItem>> itemsByOrder = new HashMap<>();
    jdbc.query(
        """
        SELECT vendor_order_id, product_id, name_snapshot, qty, unit_price_kes, line_total_kes
          FROM order_items WHERE vendor_order_id IN (%s) ORDER BY vendor_order_id, id
        """
            .formatted(placeholders),
        rs -> {
          UUID orderId = rs.getObject("vendor_order_id", UUID.class);
          itemsByOrder
              .computeIfAbsent(orderId, ignored -> new ArrayList<>())
              .add(
                  new OrderItem(
                      rs.getObject("product_id", UUID.class),
                      rs.getString("name_snapshot"),
                      rs.getInt("qty"),
                      rs.getInt("unit_price_kes"),
                      rs.getInt("line_total_kes")));
        },
        ids);
    return orders.stream()
        .map(
            order ->
                new MerchantOrder(
                    order.id(),
                    order.basketNo(),
                    order.status(),
                    order.subtotalKes(),
                    order.paidAt(),
                    order.readyAt(),
                    order.customerName(),
                    order.customerPhone(),
                    order.deliveryLandmark(),
                    order.refundStatus(),
                    order.riderName(),
                    order.riderPhone(),
                    itemsByOrder.getOrDefault(order.id(), List.of())))
        .toList();
  }

  public record OrderCursor(Instant paidAt, UUID id) {}

  private record OrderState(String status, UUID basketId) {}
}
