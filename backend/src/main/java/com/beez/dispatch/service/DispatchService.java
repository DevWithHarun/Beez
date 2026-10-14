package com.beez.dispatch.service;

import static com.beez.dispatch.api.DispatchModels.*;

import com.beez.dispatch.api.DispatchException;
import com.beez.wallet.service.MerchantWalletService;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DispatchService {
  private final JdbcTemplate jdbc;
  private final DeliveryCodeService deliveryCodes;
  private final MerchantWalletService wallet;

  public DispatchService(
      JdbcTemplate jdbc, DeliveryCodeService deliveryCodes, MerchantWalletService wallet) {
    this.jdbc = jdbc;
    this.deliveryCodes = deliveryCodes;
    this.wallet = wallet;
  }

  @Transactional(readOnly = true)
  public RiderState state(UUID riderUserId) {
    return jdbc.query(
            "SELECT approval_status, available FROM rider_profiles WHERE user_id = ?",
            (rs, row) ->
                new RiderState(
                    "APPROVED".equals(rs.getString("approval_status")),
                    rs.getBoolean("available")),
            riderUserId)
        .stream()
        .findFirst()
        .orElseThrow(
            () ->
                new DispatchException(
                    "rider_profile_missing",
                    "Your rider profile is not ready. Contact Beez support.",
                    HttpStatus.CONFLICT));
  }

  @Transactional
  public void queueIfReady(UUID basketId) {
    Boolean noUnready =
        jdbc.queryForObject(
            """
            SELECT NOT EXISTS (
                SELECT 1 FROM vendor_orders
                 WHERE basket_id = ? AND status NOT IN ('READY', 'REJECTED', 'CANCELLED')
            )
            """,
            Boolean.class,
            basketId);
    Boolean hasReady =
        jdbc.queryForObject(
            "SELECT EXISTS (SELECT 1 FROM vendor_orders WHERE basket_id = ? AND status = 'READY')",
            Boolean.class,
            basketId);
    if (!Boolean.TRUE.equals(noUnready) || !Boolean.TRUE.equals(hasReady)) return;

    UUID deliveryId = UUID.randomUUID();
    int inserted =
        jdbc.update(
            """
            INSERT INTO deliveries (id, basket_id, status)
            VALUES (?, ?, 'AVAILABLE')
            ON CONFLICT (basket_id) DO NOTHING
            """,
            deliveryId,
            basketId);
    if (inserted == 0) return;
    jdbc.update(
        """
        INSERT INTO delivery_stops (delivery_id, vendor_order_id, stop_number)
        SELECT ?, id, row_number() OVER (ORDER BY created_at, id)::smallint
          FROM vendor_orders
         WHERE basket_id = ? AND status = 'READY'
        """,
        deliveryId,
        basketId);
    event(deliveryId, null, null, "AVAILABLE", "All active shop orders are ready.");
  }

  @Transactional
  public void setAvailability(UUID riderUserId, boolean available) {
    String approval =
        jdbc.query(
                """
                SELECT approval_status FROM rider_profiles WHERE user_id = ? FOR UPDATE
                """,
                (rs, row) -> rs.getString(1),
                riderUserId)
            .stream()
            .findFirst()
            .orElseThrow(
                () ->
                    new DispatchException(
                        "rider_profile_missing",
                        "Your rider profile is not ready. Contact Beez support.",
                        HttpStatus.CONFLICT));
    if (!"APPROVED".equals(approval)) {
      throw new DispatchException(
          "rider_not_approved",
          "Delivery jobs are available after Beez approves your rider account.",
          HttpStatus.FORBIDDEN);
    }
    if (available
        && Boolean.TRUE.equals(
            jdbc.queryForObject(
                """
                SELECT EXISTS (
                    SELECT 1 FROM deliveries
                     WHERE rider_user_id = ?
                       AND status IN ('CLAIMED', 'PICKED_UP', 'ON_THE_WAY')
                )
                """,
                Boolean.class,
                riderUserId))) {
      throw conflict("Finish your active delivery before accepting more jobs.");
    }
    jdbc.update(
        "UPDATE rider_profiles SET available = ?, updated_at = now() WHERE user_id = ?",
        available,
        riderUserId);
  }

  @Transactional(readOnly = true)
  public List<AvailableDelivery> availableDeliveries(UUID riderUserId) {
    requireApproved(riderUserId);
    return jdbc.query(
        """
        SELECT d.id, count(ds.id) AS shop_count, z.name AS zone_name,
               b.delivery_landmark, d.created_at
          FROM deliveries d
          JOIN baskets b ON b.id = d.basket_id
          JOIN zones z ON z.id = b.zone_id
          JOIN delivery_stops ds ON ds.delivery_id = d.id
         WHERE d.status = 'AVAILABLE'
         GROUP BY d.id, z.name, b.delivery_landmark, d.created_at
         ORDER BY d.created_at, d.id
         LIMIT 50
        """,
        (rs, row) ->
            new AvailableDelivery(
                rs.getObject("id", UUID.class),
                rs.getInt("shop_count"),
                rs.getString("zone_name"),
                rs.getString("delivery_landmark"),
                rs.getTimestamp("created_at").toInstant()));
  }

  @Transactional
  public ActiveDelivery claim(UUID riderUserId, UUID deliveryId) {
    requireApprovedAndAvailable(riderUserId);
    if (Boolean.TRUE.equals(
        jdbc.queryForObject(
            """
            SELECT EXISTS (
                SELECT 1 FROM deliveries
                 WHERE rider_user_id = ? AND status IN ('CLAIMED', 'PICKED_UP', 'ON_THE_WAY')
            )
            """,
            Boolean.class,
            riderUserId))) {
      throw conflict("Finish your active delivery before claiming another job.");
    }
    int claimed =
        jdbc.update(
            """
            UPDATE deliveries
               SET rider_user_id = ?, status = 'CLAIMED', claimed_at = now(), updated_at = now()
             WHERE id = ? AND status = 'AVAILABLE'
            """,
            riderUserId,
            deliveryId);
    if (claimed != 1) {
      throw conflict("This delivery is no longer available. Refresh the job list.");
    }
    jdbc.update(
        "UPDATE rider_profiles SET available = false, updated_at = now() WHERE user_id = ?",
        riderUserId);
    event(deliveryId, riderUserId, "AVAILABLE", "CLAIMED", "Rider claimed delivery.");
    return activeForRider(riderUserId, deliveryId);
  }

  @Transactional(readOnly = true)
  public ActiveDelivery active(UUID riderUserId) {
    requireApproved(riderUserId);
    UUID deliveryId =
        jdbc.query(
                """
                SELECT id FROM deliveries
                 WHERE rider_user_id = ? AND status IN ('CLAIMED', 'PICKED_UP', 'ON_THE_WAY')
                 ORDER BY claimed_at DESC LIMIT 1
                """,
                (rs, row) -> rs.getObject("id", UUID.class),
                riderUserId)
            .stream()
            .findFirst()
            .orElse(null);
    return deliveryId == null ? null : activeForRider(riderUserId, deliveryId);
  }

  @Transactional
  public ActiveDelivery confirmPickup(UUID riderUserId, UUID deliveryId, UUID orderId) {
    DeliveryState delivery = requireAssignedDelivery(riderUserId, deliveryId);
    if (!"CLAIMED".equals(delivery.status()) && !"PICKED_UP".equals(delivery.status())) {
      throw conflict("This delivery is not accepting shop pickups.");
    }
    Integer pendingBefore =
        jdbc.queryForObject(
            """
            SELECT count(*) FROM delivery_stops
             WHERE delivery_id = ? AND stop_number < (
                 SELECT stop_number FROM delivery_stops
                  WHERE delivery_id = ? AND vendor_order_id = ?
             ) AND status = 'PENDING'
            """,
            Integer.class,
            deliveryId,
            deliveryId,
            orderId);
    if (pendingBefore == null) throw notFound();
    if (pendingBefore > 0) throw conflict("Complete the earlier shop pickup first.");
    int changed =
        jdbc.update(
            """
            UPDATE delivery_stops SET status = 'PICKED_UP', picked_up_at = now()
             WHERE delivery_id = ? AND vendor_order_id = ? AND status = 'PENDING'
            """,
            deliveryId,
            orderId);
    if (changed != 1) throw conflict("This shop stop has already been completed.");
    int orderChanged =
        jdbc.update(
            "UPDATE vendor_orders SET status = 'PICKED_UP' WHERE id = ? AND status = 'READY'",
            orderId);
    if (orderChanged != 1) throw conflict("This order is no longer ready for pickup.");
    jdbc.update(
        """
        INSERT INTO vendor_order_events (vendor_order_id, from_status, to_status, actor_user_id)
        VALUES (?, 'READY', 'PICKED_UP', ?)
        """,
        orderId,
        riderUserId);
    boolean allPicked =
        Boolean.TRUE.equals(
            jdbc.queryForObject(
                "SELECT NOT EXISTS (SELECT 1 FROM delivery_stops WHERE delivery_id = ? AND status = 'PENDING')",
                Boolean.class,
                deliveryId));
    String nextStatus = allPicked ? "ON_THE_WAY" : "PICKED_UP";
    jdbc.update(
        "UPDATE deliveries SET status = ?, updated_at = now() WHERE id = ?",
        nextStatus,
        deliveryId);
    if (allPicked) event(deliveryId, riderUserId, delivery.status(), "ON_THE_WAY", "All shop items picked up.");
    return activeForRider(riderUserId, deliveryId);
  }

  @Transactional
  public DeliveryCodeResult confirmDelivery(UUID riderUserId, UUID deliveryId, String code) {
    DeliveryState delivery = requireAssignedDelivery(riderUserId, deliveryId);
    if (!"ON_THE_WAY".equals(delivery.status())) {
      throw conflict("Complete every shop pickup before confirming delivery.");
    }
    CodeState codeState =
        jdbc.queryForObject(
            """
            SELECT d.code_locked, d.failed_code_attempts, s.code_hash
              FROM deliveries d
              JOIN delivery_code_secrets s ON s.basket_id = d.basket_id
             WHERE d.id = ? FOR UPDATE OF d
            """,
            (rs, row) ->
                new CodeState(
                    rs.getBoolean("code_locked"),
                    rs.getInt("failed_code_attempts"),
                    rs.getBytes("code_hash")),
            deliveryId);
    if (codeState.locked()) {
      return new DeliveryCodeResult("LOCKED", "The delivery code is locked. Contact Beez support.");
    }
    if (!deliveryCodes.matches(code, codeState.hash())) {
      int attempts = codeState.failedAttempts() + 1;
      boolean locked = attempts >= 5;
      jdbc.update(
          "UPDATE deliveries SET failed_code_attempts = ?, code_locked = ? WHERE id = ?",
          attempts,
          locked,
          deliveryId);
      return new DeliveryCodeResult(
          locked ? "LOCKED" : "INVALID_CODE",
          locked
              ? "Too many incorrect codes. Contact Beez support."
              : "That code is incorrect. Ask the customer to check it and try again.");
    }

    List<DeliveredOrder> orders =
        jdbc.query(
            """
            SELECT vo.id, vo.subtotal_kes, m.user_id
              FROM delivery_stops ds
              JOIN vendor_orders vo ON vo.id = ds.vendor_order_id
              JOIN merchants m ON m.id = vo.merchant_id
             WHERE ds.delivery_id = ? AND ds.status = 'PICKED_UP'
             ORDER BY ds.stop_number
            """,
            (rs, row) ->
                new DeliveredOrder(
                    rs.getObject("id", UUID.class),
                    rs.getInt("subtotal_kes"),
                    rs.getObject("user_id", UUID.class)),
            deliveryId);
    if (orders.isEmpty()) throw conflict("This delivery has no picked-up shop orders.");
    for (DeliveredOrder order : orders) {
      int changed =
          jdbc.update(
              "UPDATE vendor_orders SET status = 'DELIVERED' WHERE id = ? AND status = 'PICKED_UP'",
              order.orderId());
      if (changed != 1) throw conflict("An order changed while delivery was being completed.");
      jdbc.update(
          """
          INSERT INTO vendor_order_events (vendor_order_id, from_status, to_status, actor_user_id)
          VALUES (?, 'PICKED_UP', 'DELIVERED', ?)
          """,
          order.orderId(),
          riderUserId);
      wallet.recordDeliveredOrder(order.orderId(), order.merchantUserId(), order.subtotalKes());
    }
    jdbc.update(
        "UPDATE deliveries SET status = 'DELIVERED', delivered_at = now(), updated_at = now() WHERE id = ?",
        deliveryId);
    Integer deliveryFeeKes =
        jdbc.queryForObject(
            "SELECT delivery_fee_kes FROM baskets WHERE id = ?",
            Integer.class,
            delivery.basketId());
    wallet.recordRiderDelivery(deliveryId, riderUserId, deliveryFeeKes);
    jdbc.update(
        "UPDATE baskets SET status = 'COMPLETED' WHERE id = ? AND status = 'IN_PROGRESS'",
        delivery.basketId());
    jdbc.update(
        "UPDATE rider_profiles SET available = false, updated_at = now() WHERE user_id = ?",
        riderUserId);
    event(deliveryId, riderUserId, "ON_THE_WAY", "DELIVERED", "Customer delivery code verified.");
    return new DeliveryCodeResult("DELIVERED", "Delivery confirmed. Thank you.");
  }

  private ActiveDelivery activeForRider(UUID riderUserId, UUID deliveryId) {
    ActiveDelivery header =
        jdbc.queryForObject(
            """
            SELECT d.id, d.status, b.customer_name, b.customer_phone,
                   b.delivery_landmark, b.delivery_lat, b.delivery_lng
              FROM deliveries d JOIN baskets b ON b.id = d.basket_id
             WHERE d.id = ? AND d.rider_user_id = ?
            """,
            (rs, row) ->
                new ActiveDelivery(
                    rs.getObject("id", UUID.class),
                    rs.getString("status"),
                    rs.getString("customer_name"),
                    rs.getString("customer_phone"),
                    rs.getString("delivery_landmark"),
                    rs.getDouble("delivery_lat"),
                    rs.getDouble("delivery_lng"),
                    List.of()),
            deliveryId,
            riderUserId);
    List<DeliveryStop> stops =
        jdbc.query(
            """
            SELECT vo.id AS order_id, ds.stop_number, m.business_name, u.phone,
                   m.location_text, ds.status
              FROM delivery_stops ds
              JOIN vendor_orders vo ON vo.id = ds.vendor_order_id
              JOIN merchants m ON m.id = vo.merchant_id
              JOIN users u ON u.id = m.user_id
             WHERE ds.delivery_id = ?
             ORDER BY ds.stop_number
            """,
            (rs, row) ->
                new DeliveryStop(
                    rs.getObject("order_id", UUID.class),
                    rs.getInt("stop_number"),
                    rs.getString("business_name"),
                    rs.getString("phone"),
                    rs.getString("location_text"),
                    rs.getString("status")),
            deliveryId);
    return new ActiveDelivery(
        header.id(),
        header.status(),
        header.customerName(),
        header.customerPhone(),
        header.deliveryLandmark(),
        header.deliveryLat(),
        header.deliveryLng(),
        stops);
  }

  private DeliveryState requireAssignedDelivery(UUID riderUserId, UUID deliveryId) {
    return jdbc.query(
            """
            SELECT basket_id, status FROM deliveries WHERE id = ? AND rider_user_id = ? FOR UPDATE
            """,
            (rs, row) ->
                new DeliveryState(
                    rs.getObject("basket_id", UUID.class), rs.getString("status")),
            deliveryId,
            riderUserId)
        .stream()
        .findFirst()
        .orElseThrow(DispatchService::notFound);
  }

  private void requireApprovedAndAvailable(UUID riderUserId) {
    String approval =
        jdbc.query(
                "SELECT approval_status FROM rider_profiles WHERE user_id = ? AND available = true FOR UPDATE",
                (rs, row) -> rs.getString(1),
                riderUserId)
            .stream()
            .findFirst()
            .orElseThrow(
                () ->
                    new DispatchException(
                        "rider_unavailable",
                        "Set your rider availability to on before claiming a delivery.",
                        HttpStatus.CONFLICT));
    if (!"APPROVED".equals(approval)) {
      throw new DispatchException(
          "rider_not_approved",
          "Delivery jobs are available after Beez approves your rider account.",
          HttpStatus.FORBIDDEN);
    }
  }

  private void requireApproved(UUID riderUserId) {
    Boolean approved =
        jdbc.queryForObject(
            "SELECT EXISTS (SELECT 1 FROM rider_profiles WHERE user_id = ? AND approval_status = 'APPROVED')",
            Boolean.class,
            riderUserId);
    if (!Boolean.TRUE.equals(approved)) {
      throw new DispatchException(
          "rider_not_approved",
          "Delivery jobs are available after Beez approves your rider account.",
          HttpStatus.FORBIDDEN);
    }
  }

  private void event(
      UUID deliveryId, UUID actor, String fromStatus, String toStatus, String detail) {
    jdbc.update(
        """
        INSERT INTO delivery_events (delivery_id, actor_user_id, from_status, to_status, detail)
        VALUES (?, ?, ?, ?, ?)
        """,
        deliveryId,
        actor,
        fromStatus,
        toStatus,
        detail);
  }

  private static DispatchException conflict(String message) {
    return new DispatchException("delivery_transition_invalid", message, HttpStatus.CONFLICT);
  }

  private static DispatchException notFound() {
    return new DispatchException("delivery_not_found", "This delivery was not found.", HttpStatus.NOT_FOUND);
  }

  private record DeliveryState(UUID basketId, String status) {}
  private record CodeState(boolean locked, int failedAttempts, byte[] hash) {}
  private record DeliveredOrder(UUID orderId, int subtotalKes, UUID merchantUserId) {}
}
