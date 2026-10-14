package com.beez.wallet.api;

import static com.beez.wallet.api.MerchantEarningsModels.*;

import static com.beez.wallet.api.WithdrawalModels.*;

import com.beez.wallet.service.MerchantWalletService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/merchants/me/earnings")
public class MerchantEarningsController {
  private final MerchantWalletService wallet;

  public MerchantEarningsController(MerchantWalletService wallet) {
    this.wallet = wallet;
  }

  @GetMapping
  public ResponseEntity<EarningsSummary> summary(@AuthenticationPrincipal Jwt principal) {
    return noStore(wallet.summary(userId(principal)));
  }

  @GetMapping("/history")
  public ResponseEntity<LedgerPage> history(@AuthenticationPrincipal Jwt principal) {
    return noStore(wallet.history(userId(principal)));
  }

  @GetMapping("/withdrawals")
  public ResponseEntity<WithdrawalPage> withdrawals(@AuthenticationPrincipal Jwt principal) {
    return noStore(wallet.withdrawals(userId(principal)));
  }

  @PostMapping("/withdrawals")
  public ResponseEntity<Withdrawal> requestWithdrawal(
      @AuthenticationPrincipal Jwt principal, @Valid @RequestBody WithdrawalRequest input) {
    return ResponseEntity.status(201)
        .cacheControl(CacheControl.noStore())
        .body(wallet.requestWithdrawal(userId(principal), input.amountKes()));
  }

  private static UUID userId(Jwt principal) {
    return UUID.fromString(principal.getSubject());
  }

  private static <T> ResponseEntity<T> noStore(T body) {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
  }
}
