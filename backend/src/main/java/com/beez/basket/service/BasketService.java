package com.beez.basket.service;

import static com.beez.basket.api.BasketApiModels.*;

import com.beez.basket.api.BasketException;
import com.beez.common.KenyanMobile;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BasketService {
  private static final int UNPAID_PHONE_LIMIT_PER_HOUR = 3;
  private static final int IP_LIMIT_PER_HOUR = 30;
  private static final RowMapper<QuotedLine> LINE_MAPPER =
      (rs, row) ->
          new QuotedLine(
              rs.getObject("product_id", UUID.class),
              rs.getString("name_snapshot"),
              rs.getInt("qty"),
              rs.getInt("unit_price_kes"),
              rs.getInt("line_total_kes"),
              rs.getObject("merchant_id", UUID.class),
              rs.getString("business_name"),
              rs.getString("slug"));

  private final JdbcTemplate jdbc;
  private final BasketRateLimitService rateLimits;
  private final String rateLimitSecret;
  private final int baseFeeKes;
  private final int extraStopFeeKes;
  private final int freeDistanceKm;
  private final int perAdditionalKmKes;

  public BasketService(
      JdbcTemplate jdbc,
      BasketRateLimitService rateLimits,
      @Value("${beez.basket.rate-limit-secret}") String rateLimitSecret,
      @Value("${beez.basket.delivery.base-fee-kes}") int baseFeeKes,
      @Value("${beez.basket.delivery.extra-stop-fee-kes}") int extraStopFeeKes,
      @Value("${beez.basket.delivery.free-distance-km}") int freeDistanceKm,
      @Value("${beez.basket.delivery.per-additional-km-kes}") int perAdditionalKmKes) {
    this.jdbc = jdbc;
    this.rateLimits = rateLimits;
    this.rateLimitSecret = rateLimitSecret;
    this.baseFeeKes = baseFeeKes;
    this.extraStopFeeKes = extraStopFeeKes;
    this.freeDistanceKm = freeDistanceKm;
    this.perAdditionalKmKes = perAdditionalKmKes;
    if (baseFeeKes < 0 || extraStopFeeKes < 0 || freeDistanceKm < 0 || perAdditionalKmKes < 0) {
      throw new IllegalArgumentException("Basket delivery fee settings must be non-negative.");
    }
  }

  @Transactional
  public BasketView create(
      BasketCreate input, String rawIdempotencyKey, String clientAddress) {
    String idempotencyKey = validateIdempotencyKey(rawIdempotencyKey);
    String phone = normalizePhone(input.customer().phone());
    validateDuplicateLines(input.lines());
    requireTokenSecret();
    jdbc.query(
        "SELECT pg_advisory_xact_lock(hashtextextended(?, 0))",
        resultSet -> {
          if (!resultSet.next()) {
            throw new IllegalStateException("Idempotency lock was not acquired.");
          }
        },
        "basket-idempotency:" + idempotencyKey);
    byte[] fingerprint = fingerprint(input, phone);
    if (rateLimits.registerCheckoutAttempt(clientAddress) > IP_LIMIT_PER_HOUR) {
      throw new BasketException(
          "rate_limited",
          "Too many checkout attempts. Please wait and try again.",
          HttpStatus.TOO_MANY_REQUESTS);
    }
    BasketView previous = loadIdempotentBasket(idempotencyKey, fingerprint);
    if (previous != null) return previous;
    enforceUnpaidPhoneLimit(phone);
    validateDeliveryArea(
        input.zoneId(),
        new Point(input.delivery().lat().doubleValue(), input.delivery().lng().doubleValue()));

    List<QuotedLine> lines = new ArrayList<>();
    Map<UUID, VendorSummary> vendors = new HashMap<>();
    Map<UUID, Point> shopLocations = new HashMap<>();
    long itemsTotal = 0;
    for (BasketLine line : input.lines()) {
      ProductSnapshot product = loadAvailableProduct(input.zoneId(), line.productId());
      long lineTotal = Math.multiplyExact((long) product.priceKes(), line.qty());
      if (lineTotal > Integer.MAX_VALUE) throw invalidBasket();
      itemsTotal = Math.addExact(itemsTotal, lineTotal);
      if (itemsTotal > Integer.MAX_VALUE) throw invalidBasket();

      lines.add(
          new QuotedLine(
              product.productId(),
              product.name(),
              line.qty(),
              product.priceKes(),
              (int) lineTotal,
              product.merchantId(),
              product.shopName(),
              product.slug()));
      VendorSummary existingVendor = vendors.get(product.merchantId());
      int subtotal =
          Math.addExact(
              existingVendor == null ? 0 : existingVendor.subtotalKes(), (int) lineTotal);
      vendors.put(
          product.merchantId(),
          new VendorSummary(product.merchantId(), product.shopName(), product.slug(), subtotal));
      shopLocations.putIfAbsent(
          product.merchantId(), new Point(product.lat().doubleValue(), product.lng().doubleValue()));
    }

    int itemsTotalKes = Math.toIntExact(itemsTotal);
    int deliveryFeeKes = deliveryFee(vendors.size(), new ArrayList<>(shopLocations.values()),
        new Point(input.delivery().lat().doubleValue(), input.delivery().lng().doubleValue()));
    long total = (long) itemsTotalKes + deliveryFeeKes;
    if (total > Integer.MAX_VALUE) throw invalidBasket();
    int totalKes = Math.toIntExact(total);
    String trackingToken = trackingToken(idempotencyKey);
    Instant createdAt = Instant.now();
    Instant expiresAt = createdAt.plus(15, ChronoUnit.MINUTES);
    String basketNo = nextBasketNumber();
    UUID basketId = UUID.randomUUID();

    jdbc.update(
        """
        INSERT INTO baskets
            (id, basket_no, tracking_hash, idempotency_key, request_fingerprint, zone_id,
             customer_name, customer_phone, delivery_lat, delivery_lng, delivery_landmark,
             items_total_kes, delivery_fee_kes, total_kes, request_ip_hash, status, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_PAYMENT', ?, ?)
        """,
        basketId,
        basketNo,
        BasketDigests.sha256(trackingToken),
        idempotencyKey,
        fingerprint,
        input.zoneId(),
        input.customer().name().trim(),
        phone,
        input.delivery().lat(),
        input.delivery().lng(),
        input.delivery().landmark().trim(),
        itemsTotalKes,
        deliveryFeeKes,
        totalKes,
        BasketDigests.sha256(rateLimitSecret + "|basket-ip|" + clientAddress),
        expiresAt,
        createdAt);

    Map<UUID, UUID> vendorOrderIds = new HashMap<>();
    for (VendorSummary vendor : vendors.values()) {
      UUID vendorOrderId = UUID.randomUUID();
      vendorOrderIds.put(vendor.merchantId(), vendorOrderId);
      jdbc.update(
          """
          INSERT INTO vendor_orders (id, basket_id, merchant_id, subtotal_kes)
          VALUES (?, ?, ?, ?)
          """,
          vendorOrderId,
          basketId,
          vendor.merchantId(),
          vendor.subtotalKes());
    }

    for (QuotedLine line : lines) {
      jdbc.update(
          """
          INSERT INTO order_items
              (id, vendor_order_id, product_id, name_snapshot, unit_price_kes, qty, line_total_kes)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          """,
          UUID.randomUUID(),
          vendorOrderIds.get(line.merchantId()),
          line.productId(),
          line.name(),
          line.unitPriceKes(),
          line.qty(),
          line.lineTotalKes());
    }

    return response(
        new BasketHeader(
            basketId,
            basketNo,
            itemsTotalKes,
            deliveryFeeKes,
            totalKes,
            "PENDING_PAYMENT",
            expiresAt,
            BasketDigests.sha256(trackingToken)),
        trackingToken);
  }

  @Transactional(readOnly = true)
  public BasketView track(String trackingToken) {
    if (trackingToken == null || !trackingToken.matches("[A-Za-z0-9_-]{40,60}")) {
      throw basketNotFound();
    }
    BasketHeader basket;
    try {
      basket =
          jdbc.queryForObject(
              """
              SELECT id, basket_no, items_total_kes, delivery_fee_kes, total_kes, status, expires_at
                FROM baskets
               WHERE tracking_hash = ?
              """,
              (rs, row) ->
                  new BasketHeader(
                      rs.getObject("id", UUID.class),
                      rs.getString("basket_no"),
                      rs.getInt("items_total_kes"),
                      rs.getInt("delivery_fee_kes"),
                      rs.getInt("total_kes"),
                      rs.getString("status"),
                      rs.getTimestamp("expires_at").toInstant(),
                      null),
              BasketDigests.sha256(trackingToken));
    } catch (EmptyResultDataAccessException exception) {
      throw basketNotFound();
    }
    return response(basket, trackingToken);
  }

  private BasketView response(BasketHeader basket, String token) {
    List<VendorSummary> vendors =
        jdbc.query(
            """
            SELECT vo.merchant_id, m.business_name, m.slug, vo.subtotal_kes, vo.status,
                   rr.status AS refund_status
              FROM vendor_orders vo JOIN merchants m ON m.id = vo.merchant_id
              LEFT JOIN merchant_refund_requests rr ON rr.vendor_order_id = vo.id
             WHERE vo.basket_id = ? ORDER BY m.id
            """,
            (rs, row) ->
                new VendorSummary(
                    rs.getObject("merchant_id", UUID.class),
                    rs.getString("business_name"),
                    rs.getString("slug"),
                    rs.getInt("subtotal_kes"),
                    rs.getString("status"),
                    rs.getString("refund_status")),
            basket.id());
    List<QuotedLine> lines =
        jdbc.query(
            """
            SELECT oi.product_id, oi.name_snapshot, oi.unit_price_kes, oi.qty, oi.line_total_kes,
                   vo.merchant_id, m.business_name, m.slug
              FROM order_items oi
              JOIN vendor_orders vo ON vo.id = oi.vendor_order_id
              JOIN merchants m ON m.id = vo.merchant_id
             WHERE vo.basket_id = ? ORDER BY m.id, oi.id
            """,
            LINE_MAPPER,
            basket.id());
    String status =
        "PENDING_PAYMENT".equals(basket.status()) && !basket.expiresAt().isAfter(Instant.now())
            ? "EXPIRED"
            : basket.status();
    return new BasketView(
        basket.basketNo(),
        token,
        basket.itemsTotalKes(),
        basket.deliveryFeeKes(),
        basket.totalKes(),
        status,
        basket.expiresAt(),
        vendors,
        lines);
  }

  private ProductSnapshot loadAvailableProduct(UUID zoneId, UUID productId) {
    try {
      return jdbc.queryForObject(
          """
          SELECT p.id AS product_id, p.name, p.price_kes, m.id AS merchant_id,
                 m.business_name, m.slug, m.lat, m.lng
            FROM products p
            JOIN merchants m ON m.id = p.merchant_id
            JOIN zones z ON z.id = m.zone_id
           WHERE p.id = ? AND p.deleted_at IS NULL AND p.in_stock = true
             AND m.status = 'ACTIVE' AND m.is_open = true
             AND m.zone_id = ? AND z.active = true
           FOR UPDATE OF p
          """,
          (rs, row) ->
              new ProductSnapshot(
                  rs.getObject("product_id", UUID.class),
                  rs.getString("name"),
                  rs.getInt("price_kes"),
                  rs.getObject("merchant_id", UUID.class),
                  rs.getString("business_name"),
                  rs.getString("slug"),
                  rs.getBigDecimal("lat"),
                  rs.getBigDecimal("lng")),
          productId,
          zoneId);
    } catch (EmptyResultDataAccessException exception) {
      throw new BasketException(
          "out_of_stock",
          "One or more items are unavailable in this service area. Refresh the shop and try again.",
          HttpStatus.CONFLICT);
    }
  }

  private void validateDeliveryArea(UUID zoneId, Point delivery) {
    List<ZoneArea> zones =
        jdbc.query(
            """
            SELECT centre_lat, centre_lng, radius_m
              FROM zones WHERE id = ? AND active = true
            """,
            (rs, row) ->
                new ZoneArea(
                    rs.getDouble("centre_lat"),
                    rs.getDouble("centre_lng"),
                    rs.getInt("radius_m")),
            zoneId);
    if (zones.isEmpty()) {
      throw new BasketException(
          "zone_unavailable",
          "This service area is no longer available. Choose another area and try again.",
          HttpStatus.CONFLICT);
    }
    ZoneArea zone = zones.get(0);
    if (distanceKm(new Point(zone.lat(), zone.lng()), delivery) * 1000 > zone.radiusMeters()) {
      throw new BasketException(
          "outside_service_area",
          "Your delivery point is outside this Beez service area.",
          HttpStatus.UNPROCESSABLE_ENTITY);
    }
  }

  private void enforceUnpaidPhoneLimit(String phone) {
    jdbc.query(
        "SELECT pg_advisory_xact_lock(hashtextextended(?, 0))",
        resultSet -> {
          if (!resultSet.next()) {
            throw new IllegalStateException("Phone rate-limit lock was not acquired.");
          }
        },
        phone);
    Integer count =
        jdbc.queryForObject(
            """
            SELECT count(*) FROM baskets
             WHERE customer_phone = ? AND status = 'PENDING_PAYMENT'
               AND expires_at > now()
               AND created_at >= now() - interval '1 hour'
            """,
            Integer.class,
            phone);
    if (count != null && count >= UNPAID_PHONE_LIMIT_PER_HOUR) {
      throw new BasketException(
          "rate_limited",
          "You have several unpaid baskets. Finish or wait for one to expire before starting another.",
          HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private int deliveryFee(int stops, List<Point> locations, Point delivery) {
    List<Point> remaining = new ArrayList<>(locations);
    Point current = remaining.remove(0);
    double distance = 0;
    while (!remaining.isEmpty()) {
      Point from = current;
      Point next =
          remaining.stream()
              .min(java.util.Comparator.comparingDouble(point -> distanceKm(from, point)))
              .orElseThrow();
      distance += distanceKm(current, next);
      current = next;
      remaining.remove(next);
    }
    distance += distanceKm(current, delivery);
    long additionalKm = Math.max(0L, (long) Math.ceil(distance) - freeDistanceKm);
    long fee =
        (long) baseFeeKes
            + (long) extraStopFeeKes * Math.max(0, stops - 1)
            + (long) perAdditionalKmKes * additionalKm;
    if (fee > Integer.MAX_VALUE) throw invalidBasket();
    return Math.toIntExact(fee);
  }

  private static double distanceKm(Point left, Point right) {
    double lat1 = Math.toRadians(left.lat());
    double lat2 = Math.toRadians(right.lat());
    double deltaLat = lat2 - lat1;
    double deltaLng = Math.toRadians(right.lng() - left.lng());
    double a =
        Math.pow(Math.sin(deltaLat / 2), 2)
            + Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin(deltaLng / 2), 2);
    a = Math.max(0, Math.min(1, a));
    return 6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private String nextBasketNumber() {
    Long number = jdbc.queryForObject("SELECT nextval('basket_number_seq')", Long.class);
    return "BZ-" + String.format(java.util.Locale.ROOT, "%06d", number);
  }

  private BasketView loadIdempotentBasket(String key, byte[] fingerprint) {
    List<BasketHeader> matches =
        jdbc.query(
            """
            SELECT id, basket_no, items_total_kes, delivery_fee_kes, total_kes, status,
                   expires_at, request_fingerprint
              FROM baskets WHERE idempotency_key = ?
            """,
            (rs, row) -> {
              if (!MessageDigest.isEqual(rs.getBytes("request_fingerprint"), fingerprint)) {
                throw new BasketException(
                    "idempotency_conflict",
                    "This checkout attempt was already used for different basket details. Refresh and try again.",
                    HttpStatus.CONFLICT);
              }
              return new BasketHeader(
                  rs.getObject("id", UUID.class),
                  rs.getString("basket_no"),
                  rs.getInt("items_total_kes"),
                  rs.getInt("delivery_fee_kes"),
                  rs.getInt("total_kes"),
                  rs.getString("status"),
                  rs.getTimestamp("expires_at").toInstant(),
                  null);
            },
            key);
    if (matches.isEmpty()) return null;
    BasketHeader basket = matches.get(0);
    String trackingToken = trackingToken(key);
    if (!MessageDigest.isEqual(BasketDigests.sha256(trackingToken), loadTrackingHash(basket.id()))) {
      throw new IllegalStateException("Basket tracking capability integrity check failed.");
    }
    return response(basket, trackingToken);
  }

  private byte[] loadTrackingHash(UUID basketId) {
    return jdbc.queryForObject(
        "SELECT tracking_hash FROM baskets WHERE id = ?", byte[].class, basketId);
  }

  private String trackingToken(String idempotencyKey) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(
          new SecretKeySpec(rateLimitSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      return Base64.getUrlEncoder().withoutPadding()
          .encodeToString(mac.doFinal(("basket-token:" + idempotencyKey).getBytes(StandardCharsets.UTF_8)));
    } catch (java.security.GeneralSecurityException exception) {
      throw new IllegalStateException("Basket token signing is unavailable.", exception);
    }
  }

  private void requireTokenSecret() {
    if (rateLimitSecret == null || rateLimitSecret.length() < 32) {
      throw new BasketException(
          "checkout_unavailable",
          "Guest checkout is not configured yet. Please try again later.",
          HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  private static byte[] fingerprint(BasketCreate input, String phone) {
    String canonical =
        input.zoneId()
            + "|"
            + input.lines().stream()
                .sorted(java.util.Comparator.comparing(line -> line.productId().toString()))
                .map(line -> line.productId() + ":" + line.qty())
                .collect(java.util.stream.Collectors.joining(","))
            + "|"
            + input.customer().name().trim()
            + "|"
            + phone
            + "|"
            + input.delivery().lat().stripTrailingZeros().toPlainString()
            + "|"
            + input.delivery().lng().stripTrailingZeros().toPlainString()
            + "|"
            + input.delivery().landmark().trim();
    return BasketDigests.sha256(canonical);
  }

  private static String validateIdempotencyKey(String value) {
    if (value == null || !value.matches("[A-Za-z0-9_-]{16,100}")) {
      throw new BasketException(
          "idempotency_key_required",
          "Refresh your basket and try checkout again.",
          HttpStatus.BAD_REQUEST);
    }
    return value;
  }

  private static String normalizePhone(String value) {
    try {
      return KenyanMobile.normalize(value);
    } catch (IllegalArgumentException exception) {
      throw new BasketException("invalid_phone", exception.getMessage(), HttpStatus.BAD_REQUEST);
    }
  }

  private static void validateDuplicateLines(List<BasketLine> lines) {
    Set<UUID> productIds = new HashSet<>();
    for (BasketLine line : lines) {
      if (!productIds.add(line.productId())) {
        throw new BasketException(
            "duplicate_product",
            "Each product should appear once in your basket.",
            HttpStatus.BAD_REQUEST);
      }
    }
  }

  private static BasketException invalidBasket() {
    return new BasketException(
        "basket_invalid", "The basket total is outside the supported range.", HttpStatus.BAD_REQUEST);
  }

  private static BasketException basketNotFound() {
    return new BasketException(
        "basket_not_found", "This tracking link is invalid or has expired.", HttpStatus.NOT_FOUND);
  }

  private record Point(double lat, double lng) {}

  private record ZoneArea(double lat, double lng, int radiusMeters) {}

  private record ProductSnapshot(
      UUID productId,
      String name,
      int priceKes,
      UUID merchantId,
      String shopName,
      String slug,
      java.math.BigDecimal lat,
      java.math.BigDecimal lng) {}

  private record BasketHeader(
      UUID id,
      String basketNo,
      int itemsTotalKes,
      int deliveryFeeKes,
      int totalKes,
      String status,
      Instant expiresAt,
      byte[] trackingHash) {}
}
