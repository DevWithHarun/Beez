package com.beez.catalogue.api;

import com.beez.catalogue.api.CatalogueApiModels.MerchantShop;
import com.beez.catalogue.api.CatalogueApiModels.ProductView;
import com.beez.catalogue.service.CatalogueService;
import com.beez.orders.api.MerchantOrderModels.OrderSummary;
import com.beez.orders.api.MerchantOrderModels.TodaySummary;
import com.beez.orders.service.MerchantOrderService;
import com.beez.wallet.api.MerchantEarningsModels.EarningsSummary;
import com.beez.wallet.service.MerchantWalletService;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class MerchantDashboardController {
  private final CatalogueService catalogue;
  private final MerchantOrderService orders;
  private final MerchantWalletService wallet;

  public MerchantDashboardController(
      CatalogueService catalogue, MerchantOrderService orders, MerchantWalletService wallet) {
    this.catalogue = catalogue;
    this.orders = orders;
    this.wallet = wallet;
  }

  @GetMapping("/api/v1/merchants/me/dashboard")
  public ResponseEntity<MerchantDashboard> dashboard(@AuthenticationPrincipal Jwt principal) {
    UUID userId = UUID.fromString(principal.getSubject());
    MerchantShop shop = catalogue.merchantShop(userId);
    List<ProductView> products = shop == null ? List.of() : catalogue.merchantProducts(userId);
    MerchantDashboard body =
        new MerchantDashboard(
            Instant.now(),
            shop,
            orders.todaySummary(userId),
            orders.summary(userId),
            shop == null ? null : wallet.summary(userId),
            products.size(),
            (int) products.stream().filter(ProductView::inStock).count());
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
  }

  public record MerchantDashboard(
      Instant serverTime,
      MerchantShop shop,
      TodaySummary today,
      OrderSummary orders,
      EarningsSummary earnings,
      int productCount,
      int inStockProductCount) {}
}
