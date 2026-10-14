package com.beez.catalogue.service;

import static com.beez.catalogue.api.CatalogueApiModels.*;

import com.beez.auth.service.PhoneNumbers;
import com.beez.catalogue.api.CatalogueException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CatalogueService {
  private static final int PAGE_SIZE = 30;

  private static final RowMapper<ZoneView> ZONE_MAPPER =
      (rs, row) -> new ZoneView(rs.getObject("id", UUID.class), rs.getString("name"));

  private static final RowMapper<ShopSummary> SHOP_MAPPER =
      (rs, row) ->
          new ShopSummary(
              rs.getObject("id", UUID.class),
              rs.getString("slug"),
              rs.getString("business_name"),
              rs.getString("category"),
              rs.getObject("zone_id", UUID.class),
              rs.getString("zone_name"),
              rs.getString("location_text"),
              rs.getBoolean("is_open"));

  private static final RowMapper<ProductView> PRODUCT_MAPPER =
      (rs, row) ->
          new ProductView(
              rs.getObject("id", UUID.class),
              rs.getString("name"),
              rs.getString("unit"),
              rs.getInt("price_kes"),
              rs.getBoolean("in_stock"));

  private final JdbcTemplate jdbc;
  private final ObjectMapper objectMapper;

  public CatalogueService(JdbcTemplate jdbc, ObjectMapper objectMapper) {
    this.jdbc = jdbc;
    this.objectMapper = objectMapper;
  }

  @Transactional(readOnly = true)
  public CursorPage<ZoneView> zones(String cursor) {
    UUID afterId = parseCursor(cursor);
    String sql =
        "SELECT id, name FROM zones WHERE active = true "
            + (afterId == null ? "" : "AND id > ? ")
            + "ORDER BY id LIMIT ?";
    List<Object> args = afterId == null ? List.of(PAGE_SIZE + 1) : List.of(afterId, PAGE_SIZE + 1);
    List<ZoneView> rows = jdbc.query(sql, ZONE_MAPPER, args.toArray());
    return page(rows, ZoneView::id);
  }

  @Transactional(readOnly = true)
  public CursorPage<ShopSummary> shops(UUID zoneId, String category, String query, String cursor) {
    UUID afterId = parseCursor(cursor);
    StringBuilder sql =
        new StringBuilder(
            "SELECT m.id, m.slug, m.business_name, m.category, m.zone_id, z.name AS zone_name, "
                + "m.location_text, m.is_open FROM merchants m JOIN zones z ON z.id = m.zone_id "
                + "WHERE m.status = 'ACTIVE' AND z.active = true AND m.zone_id = ?");
    java.util.ArrayList<Object> args = new java.util.ArrayList<>();
    args.add(zoneId);
    if (category != null && !category.isBlank()) {
      sql.append(" AND lower(m.category) = lower(?)");
      args.add(category.trim());
    }
    if (query != null && !query.isBlank()) {
      sql.append(
          " AND (m.business_name ILIKE ? ESCAPE E'\\\\' OR EXISTS (SELECT 1 FROM products p "
              + "WHERE p.merchant_id = m.id AND p.deleted_at IS NULL "
              + "AND p.name ILIKE ? ESCAPE E'\\\\'))");
      String pattern = "%" + escapeLike(query.trim()) + "%";
      args.add(pattern);
      args.add(pattern);
    }
    if (afterId != null) {
      sql.append(" AND m.id > ?");
      args.add(afterId);
    }
    sql.append(" ORDER BY m.id LIMIT ?");
    args.add(PAGE_SIZE + 1);

    List<ShopSummary> rows = jdbc.query(sql.toString(), SHOP_MAPPER, args.toArray());
    return page(rows, ShopSummary::id);
  }

  @Transactional(readOnly = true)
  public ShopPage shop(String slug) {
    ShopSummary shop;
    try {
      shop =
          jdbc.queryForObject(
              """
              SELECT m.id, m.slug, m.business_name, m.category, m.zone_id,
                     z.name AS zone_name, m.location_text, m.is_open
                FROM merchants m JOIN zones z ON z.id = m.zone_id
               WHERE m.slug = ? AND m.status = 'ACTIVE' AND z.active = true
              """,
              SHOP_MAPPER,
              slug);
    } catch (EmptyResultDataAccessException exception) {
      throw new CatalogueException(
          "shop_not_found", "This shop is not available.", HttpStatus.NOT_FOUND);
    }

    List<ProductView> products =
        jdbc.query(
            """
            SELECT id, name, unit, price_kes, in_stock
              FROM products
             WHERE merchant_id = (SELECT id FROM merchants WHERE slug = ?)
               AND deleted_at IS NULL
             ORDER BY lower(name), id
            """,
            PRODUCT_MAPPER,
            slug);
    return new ShopPage(
        shop.id(),
        shop.slug(),
        shop.name(),
        shop.category(),
        shop.zoneId(),
        shop.zoneName(),
        shop.locationText(),
        shop.isOpen(),
        products);
  }

  @Transactional(readOnly = true)
  public MerchantShop merchantShop(UUID userId) {
    try {
      return jdbc.queryForObject(
          """
          SELECT m.id, m.slug, m.business_name, m.category, m.zone_id,
                 z.name AS zone_name, m.location_text, m.status, m.lat, m.lng, m.payout_phone,
                 m.is_open, m.opening_hours
            FROM merchants m JOIN zones z ON z.id = m.zone_id
           WHERE m.user_id = ?
          """,
          (rs, row) ->
              new MerchantShop(
                  rs.getObject("id", UUID.class),
                  rs.getString("slug"),
                  rs.getString("business_name"),
                  rs.getString("category"),
                  rs.getObject("zone_id", UUID.class),
                  rs.getString("zone_name"),
                  rs.getString("location_text"),
                  rs.getString("status"),
                  rs.getBigDecimal("lat"),
                  rs.getBigDecimal("lng"),
                  rs.getString("payout_phone"),
                  rs.getBoolean("is_open"),
                  parseOpeningHours(rs.getString("opening_hours"))),
          userId);
    } catch (EmptyResultDataAccessException exception) {
      return null;
    }
  }

  @Transactional
  public MerchantShop updateAvailability(UUID userId, AvailabilityUpdate input) {
      if (input.openingHours() != null) validateOpeningHours(input.openingHours());
      int updated =
          jdbc.update(
              """
              UPDATE merchants
                 SET is_open = ?, opening_hours = COALESCE(?::jsonb, opening_hours)
               WHERE user_id = ? AND status = 'ACTIVE'
              """,
              input.isOpen(),
              serializeOpeningHours(input.openingHours()),
              userId);
      if (updated == 0) {
        throw new CatalogueException(
            "shop_not_active",
            "Only an approved active shop can change its availability.",
            HttpStatus.CONFLICT);
      }
      return merchantShop(userId);
    }

  private void validateOpeningHours(Map<String, BusinessHours> hours) {
      if (hours == null || hours.values().stream().anyMatch(java.util.Objects::isNull)) {
        throw new CatalogueException(
            "opening_hours_invalid",
            "Opening hours must include valid settings for all seven days.",
            HttpStatus.BAD_REQUEST);
      }
      List<String> days =
          List.of("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday");
      if (hours.size() != days.size()
          || !hours.keySet().containsAll(days)) {
        throw new CatalogueException(
            "opening_hours_invalid",
            "Opening hours must include all seven days.",
            HttpStatus.BAD_REQUEST);
      }
      for (BusinessHours day : hours.values()) {
        if ((day.open()
                && (day.opensAt() == null
                    || day.closesAt() == null
                    || !day.opensAt().isBefore(day.closesAt())))
            || (!day.open() && (day.opensAt() != null || day.closesAt() != null))) {
          throw new CatalogueException(
              "opening_hours_invalid",
              "Open days need valid opening and closing times; closed days must not include times.",
              HttpStatus.BAD_REQUEST);
        }
      }
    }

  private Map<String, BusinessHours> parseOpeningHours(String json) {
      try {
        return objectMapper.readValue(json, new TypeReference<>() {});
      } catch (JsonProcessingException exception) {
        throw new IllegalStateException("Stored merchant opening hours are invalid.", exception);
      }
    }

  private String serializeOpeningHours(Map<String, BusinessHours> hours) {
      if (hours == null) return null;
      try {
        return objectMapper.writeValueAsString(hours);
      } catch (JsonProcessingException exception) {
        throw new IllegalArgumentException("Opening hours could not be serialized.", exception);
    }
  }

  @Transactional
  public MerchantShop saveMerchantShop(UUID userId, ShopCreate input) {
    if (!Boolean.TRUE.equals(
        jdbc.query(
            "SELECT EXISTS (SELECT 1 FROM zones WHERE id = ? AND active = true)",
            rs -> rs.next() && rs.getBoolean(1),
            input.zoneId()))) {
      throw new CatalogueException(
          "zone_unavailable",
          "Choose an active Beez service area before setting up your shop.",
          HttpStatus.BAD_REQUEST);
    }

    String payoutPhone =
        input.payoutPhone() == null || input.payoutPhone().isBlank()
            ? null
            : PhoneNumbers.normalizeKenyanMobile(input.payoutPhone());
    MerchantShop existing = merchantShop(userId);
    String slug =
        existing == null ? createSlug(input.businessName(), userId) : existing.slug();
    if (existing == null) {
      jdbc.update(
          """
          INSERT INTO merchants
              (user_id, slug, business_name, category, zone_id, location_text, lat, lng,
               payout_phone, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_REVIEW')
          """,
          userId,
          slug,
          input.businessName().trim(),
          input.category().trim(),
          input.zoneId(),
          input.locationText().trim(),
          input.lat(),
          input.lng(),
          payoutPhone);
    } else {
      jdbc.update(
          """
          UPDATE merchants
             SET business_name = ?, category = ?, zone_id = ?, location_text = ?, lat = ?, lng = ?,
                 payout_phone = COALESCE(?, payout_phone),
                 status = CASE WHEN status = 'REJECTED' THEN 'PENDING_REVIEW' ELSE status END
           WHERE user_id = ?
          """,
          input.businessName().trim(),
          input.category().trim(),
          input.zoneId(),
          input.locationText().trim(),
          input.lat(),
          input.lng(),
          payoutPhone,
          userId);
    }
    return merchantShop(userId);
  }

  @Transactional
  public void reviewMerchant(UUID merchantId, boolean approved) {
    String status = approved ? "ACTIVE" : "REJECTED";
    int updated =
        jdbc.update(
            """
            UPDATE merchants SET status = ?
             WHERE id = ? AND status = 'PENDING_REVIEW'
            """,
            status,
            merchantId);
    if (updated == 1) return;

    String currentStatus =
        jdbc.query(
                "SELECT status FROM merchants WHERE id = ?",
                (rs, row) -> rs.getString("status"),
                merchantId)
            .stream()
            .findFirst()
            .orElseThrow(
                () ->
                    new CatalogueException(
                        "merchant_not_found",
                        "This merchant application was not found.",
                        HttpStatus.NOT_FOUND));
    throw new CatalogueException(
        "merchant_review_transition_invalid",
        "This merchant application is no longer awaiting review (current status: "
            + currentStatus.toLowerCase(Locale.ROOT).replace('_', ' ')
            + ").",
        HttpStatus.CONFLICT);
  }

  @Transactional(readOnly = true)
  public List<ProductView> merchantProducts(UUID userId) {
    UUID merchantId = requireMerchantId(userId);
    return jdbc.query(
        """
        SELECT id, name, unit, price_kes, in_stock FROM products
         WHERE merchant_id = ? AND deleted_at IS NULL
         ORDER BY created_at DESC, id
        """,
        PRODUCT_MAPPER,
        merchantId);
  }

  @Transactional
  public ProductView createProduct(UUID userId, ProductWrite input) {
    UUID merchantId = requireMerchantId(userId);
    UUID productId = UUID.randomUUID();
    jdbc.update(
        """
        INSERT INTO products (id, merchant_id, name, unit, price_kes, in_stock)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        productId,
        merchantId,
        input.name().trim(),
        normalizeNullable(input.unit()),
        input.priceKes(),
        input.inStock());
    return product(merchantId, productId);
  }

  @Transactional
  public List<ProductView> createProducts(UUID userId, List<ProductWrite> inputs) {
    if (inputs == null || inputs.isEmpty() || inputs.size() > 30) {
      throw new CatalogueException(
          "product_batch_invalid",
          "Choose between 1 and 30 products to add.",
          HttpStatus.BAD_REQUEST);
    }
    UUID merchantId = requireMerchantId(userId);
    return inputs.stream()
        .map(
            input -> {
              UUID productId = UUID.randomUUID();
              jdbc.update(
                  """
                  INSERT INTO products (id, merchant_id, name, unit, price_kes, in_stock)
                  VALUES (?, ?, ?, ?, ?, ?)
                  """,
                  productId,
                  merchantId,
                  input.name().trim(),
                  normalizeNullable(input.unit()),
                  input.priceKes(),
                  input.inStock());
              return product(merchantId, productId);
            })
        .toList();
  }

  @Transactional
  public ProductView updateProduct(UUID userId, UUID productId, ProductWrite input) {
    UUID merchantId = requireMerchantId(userId);
    int updated =
        jdbc.update(
            """
            UPDATE products SET name = ?, unit = ?, price_kes = ?, in_stock = ?
             WHERE id = ? AND merchant_id = ? AND deleted_at IS NULL
            """,
            input.name().trim(),
            normalizeNullable(input.unit()),
            input.priceKes(),
            input.inStock(),
            productId,
            merchantId);
    if (updated == 0) throw productNotFound();
    return product(merchantId, productId);
  }

  @Transactional
  public void archiveProduct(UUID userId, UUID productId) {
    UUID merchantId = requireMerchantId(userId);
    int updated =
        jdbc.update(
            """
            UPDATE products SET deleted_at = now()
             WHERE id = ? AND merchant_id = ? AND deleted_at IS NULL
            """,
            productId,
            merchantId);
    if (updated == 0) throw productNotFound();
  }

  public UUID requireMerchantId(UUID userId) {
    List<UUID> ids =
        jdbc.query(
            "SELECT id FROM merchants WHERE user_id = ?",
            (rs, row) -> rs.getObject("id", UUID.class),
            userId);
    if (ids.isEmpty()) {
      throw new CatalogueException(
          "shop_setup_required",
          "Set up your shop before managing products.",
          HttpStatus.CONFLICT);
    }
    return ids.get(0);
  }

  private ProductView product(UUID merchantId, UUID productId) {
    try {
      return jdbc.queryForObject(
          """
          SELECT id, name, unit, price_kes, in_stock FROM products
           WHERE id = ? AND merchant_id = ? AND deleted_at IS NULL
          """,
          PRODUCT_MAPPER,
          productId,
          merchantId);
    } catch (EmptyResultDataAccessException exception) {
      throw productNotFound();
    }
  }

  private static CatalogueException productNotFound() {
    return new CatalogueException(
        "product_not_found", "This product is not available.", HttpStatus.NOT_FOUND);
  }

  private String createSlug(String name, UUID userId) {
    String base =
        name.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
    if (base.length() > 48) base = base.substring(0, 48).replaceAll("-$", "");
    if (base.isBlank()) base = "shop";
    String suffix = userId.toString().substring(0, 8);
    return base + "-" + suffix;
  }

  private static String normalizeNullable(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }

  private static String escapeLike(String value) {
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
  }

  private static UUID parseCursor(String cursor) {
    if (cursor == null || cursor.isBlank()) return null;
    try {
      return UUID.fromString(cursor);
    } catch (IllegalArgumentException exception) {
      throw new CatalogueException(
          "cursor_invalid", "Refresh the list and try again.", HttpStatus.BAD_REQUEST);
    }
  }

  private static <T> CursorPage<T> page(List<T> rows, java.util.function.Function<T, UUID> id) {
    boolean hasMore = rows.size() > PAGE_SIZE;
    List<T> items = hasMore ? rows.subList(0, PAGE_SIZE) : rows;
    String nextCursor = hasMore ? id.apply(items.get(items.size() - 1)).toString() : null;
    return new CursorPage<>(items, nextCursor);
  }
}
