package com.beez.catalogue.api;

import static com.beez.catalogue.api.CatalogueApiModels.*;

import com.beez.catalogue.service.CatalogueService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CatalogueController {
  private final CatalogueService catalogue;

  public CatalogueController(CatalogueService catalogue) {
    this.catalogue = catalogue;
  }

  @GetMapping("/api/v1/public/zones")
  public ResponseEntity<CursorPage<ZoneView>> zones(
      @RequestParam(required = false) String cursor) {
    return noStore(catalogue.zones(cursor));
  }

  @GetMapping("/api/v1/public/shops")
  public ResponseEntity<CursorPage<ShopSummary>> shops(
      @RequestParam UUID zone,
      @RequestParam(required = false) String category,
      @RequestParam(name = "q", required = false) String query,
      @RequestParam(required = false) String cursor) {
    return noStore(catalogue.shops(zone, category, query, cursor));
  }

  @GetMapping("/api/v1/public/m/{slug}")
  public ResponseEntity<ShopPage> shop(@PathVariable String slug) {
    return noStore(catalogue.shop(slug));
  }

  @GetMapping("/api/v1/merchants/me/shop")
  public ResponseEntity<MerchantShop> merchantShop(@AuthenticationPrincipal Jwt principal) {
    MerchantShop shop = catalogue.merchantShop(userId(principal));
    return shop == null
        ? ResponseEntity.notFound().cacheControl(CacheControl.noStore()).build()
        : noStore(shop);
  }

  @PutMapping("/api/v1/merchants/me/shop")
  public ResponseEntity<MerchantShop> saveMerchantShop(
      @AuthenticationPrincipal Jwt principal, @Valid @RequestBody ShopCreate input) {
    return noStore(catalogue.saveMerchantShop(userId(principal), input));
  }

  @PatchMapping("/api/v1/merchants/me/shop/availability")
  public ResponseEntity<MerchantShop> updateAvailability(
      @AuthenticationPrincipal Jwt principal, @Valid @RequestBody AvailabilityUpdate input) {
    return noStore(catalogue.updateAvailability(userId(principal), input));
  }

  @GetMapping("/api/v1/merchants/me/products")
  public ResponseEntity<java.util.List<ProductView>> merchantProducts(
      @AuthenticationPrincipal Jwt principal) {
    return noStore(catalogue.merchantProducts(userId(principal)));
  }

  @PostMapping("/api/v1/merchants/me/products")
  public ResponseEntity<ProductView> createProduct(
      @AuthenticationPrincipal Jwt principal, @Valid @RequestBody ProductWrite input) {
    return ResponseEntity.status(201)
        .cacheControl(CacheControl.noStore())
        .body(catalogue.createProduct(userId(principal), input));
  }

  @PostMapping("/api/v1/merchants/me/products/batch")
  public ResponseEntity<java.util.List<ProductView>> createProducts(
      @AuthenticationPrincipal Jwt principal, @Valid @RequestBody ProductBatchWrite input) {
    return ResponseEntity.status(201)
        .cacheControl(CacheControl.noStore())
        .body(catalogue.createProducts(userId(principal), input.products()));
  }

  @PatchMapping("/api/v1/merchants/me/products/{productId}")
  public ResponseEntity<ProductView> updateProduct(
      @AuthenticationPrincipal Jwt principal,
      @PathVariable UUID productId,
      @Valid @RequestBody ProductWrite input) {
    return noStore(catalogue.updateProduct(userId(principal), productId, input));
  }

  @DeleteMapping("/api/v1/merchants/me/products/{productId}")
  public ResponseEntity<Void> archiveProduct(
      @AuthenticationPrincipal Jwt principal, @PathVariable UUID productId) {
    catalogue.archiveProduct(userId(principal), productId);
    return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
  }

  private static UUID userId(Jwt principal) {
    return UUID.fromString(principal.getSubject());
  }

  private static <T> ResponseEntity<T> noStore(T body) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
  }
}
