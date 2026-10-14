package com.beez.wallet.api;

import static com.beez.wallet.api.RiderEarningsModels.*;

import com.beez.wallet.service.MerchantWalletService;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/riders/me/earnings")
public class RiderEarningsController {
  private final MerchantWalletService wallet;

  public RiderEarningsController(MerchantWalletService wallet) {
    this.wallet = wallet;
  }

  @GetMapping
  public ResponseEntity<RiderEarningsSummary> summary(@AuthenticationPrincipal Jwt principal) {
    return noStore(wallet.riderSummary(userId(principal)));
  }

  @GetMapping("/history")
  public ResponseEntity<RiderLedgerPage> history(@AuthenticationPrincipal Jwt principal) {
    return noStore(wallet.riderHistory(userId(principal)));
  }

  private static UUID userId(Jwt principal) {
    return UUID.fromString(principal.getSubject());
  }

  private static <T> ResponseEntity<T> noStore(T body) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
  }
}
