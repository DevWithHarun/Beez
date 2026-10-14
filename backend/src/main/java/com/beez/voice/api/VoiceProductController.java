package com.beez.voice.api;

import static com.beez.voice.api.VoiceProductModels.*;

import com.beez.voice.service.VoiceProductService;
import jakarta.validation.constraints.Pattern;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Validated
@RestController
@RequestMapping("/api/v1/merchants/me/voice-products")
public class VoiceProductController {
  private final VoiceProductService voice;

  public VoiceProductController(VoiceProductService voice) {
    this.voice = voice;
  }

  @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ResponseEntity<VoiceDraft> extract(
      @AuthenticationPrincipal Jwt principal,
      @RequestParam("audio") MultipartFile audio,
      @RequestParam("language")
          @Pattern(regexp = "en|sw", message = "Choose English or Swahili.")
          String language) {
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .body(
            voice.extract(
                UUID.fromString(principal.getSubject()), audio, language.toLowerCase(Locale.ROOT)));
  }
}
