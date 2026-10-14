package com.beez.voice.service;

import static com.beez.voice.api.VoiceProductModels.*;

import com.beez.voice.api.VoiceException;
import com.beez.voice.spi.ProductExtractor;
import com.beez.voice.spi.SpeechToText;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class VoiceProductService {
  private static final long MAX_AUDIO_BYTES = 10 * 1024 * 1024;
  private static final long MAX_AUDIO_BYTES_PER_HOUR = 50 * 1024 * 1024;
  private static final int MAX_PRODUCTS = 30;
  private final SpeechToText speechToText;
  private final ProductExtractor productExtractor;
  private final JdbcTemplate jdbc;

  public VoiceProductService(
      SpeechToText speechToText, ProductExtractor productExtractor, JdbcTemplate jdbc) {
    this.speechToText = speechToText;
    this.productExtractor = productExtractor;
    this.jdbc = jdbc;
  }

  public VoiceDraft extract(UUID userId, MultipartFile audio, String language) {
    if (userId == null
        || audio == null
        || audio.isEmpty()
        || audio.getSize() > MAX_AUDIO_BYTES) {
      throw new VoiceException(
          "voice_audio_invalid",
          "Record a voice note under 60 seconds and 10 MB, then try again.",
          HttpStatus.BAD_REQUEST);
    }
    String contentType = audio.getContentType();
    String mediaType = contentType == null ? "" : contentType.split(";", 2)[0].trim();
    if (!List.of("audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg").contains(mediaType)) {
      throw new VoiceException(
          "voice_format_unsupported",
          "Use a supported browser recording format such as WebM, Ogg, or MP4 audio.",
          HttpStatus.UNSUPPORTED_MEDIA_TYPE);
    }
    if (!language.equals("en") && !language.equals("sw")) {
      throw new VoiceException(
          "voice_language_unsupported",
          "Choose English or Swahili for this recording.",
          HttpStatus.BAD_REQUEST);
    }

    jdbc.update("DELETE FROM merchant_voice_usage WHERE hour_start < now() - interval '48 hours'");
    List<Integer> usage =
        jdbc.query(
            """
            INSERT INTO merchant_voice_usage
              (merchant_user_id, hour_start, request_count, audio_bytes)
            VALUES (?, date_trunc('hour', now()), 1, ?)
            ON CONFLICT (merchant_user_id, hour_start) DO UPDATE
              SET request_count = merchant_voice_usage.request_count + 1,
                  audio_bytes = merchant_voice_usage.audio_bytes + EXCLUDED.audio_bytes
              WHERE merchant_voice_usage.request_count < 10
                AND merchant_voice_usage.audio_bytes + EXCLUDED.audio_bytes <= ?
            RETURNING request_count
            """,
            (rs, row) -> rs.getInt(1),
            userId,
            audio.getSize(),
            MAX_AUDIO_BYTES_PER_HOUR);
    if (usage.isEmpty()) {
      throw new VoiceException(
          "voice_usage_limit",
          "You’ve reached the hourly voice-processing limit. Please try later or add products manually.",
          HttpStatus.TOO_MANY_REQUESTS);
    }

    byte[] bytes;
    try {
      bytes = audio.getBytes();
    } catch (java.io.IOException exception) {
      throw new VoiceException(
          "voice_audio_unreadable", "The recording could not be read. Please record it again.", HttpStatus.BAD_REQUEST);
    }

    String transcript = speechToText.transcribe(bytes, language, mediaType);
    if (transcript == null || transcript.isBlank()) {
      throw new VoiceException(
          "voice_transcription_empty",
          "We couldn’t hear product details. Try again or enter products manually.",
          HttpStatus.UNPROCESSABLE_ENTITY);
    }
    if (transcript.length() > 8000) {
      throw new VoiceException(
          "voice_transcript_too_long",
          "That recording contains too much speech. Split it into shorter notes.",
          HttpStatus.UNPROCESSABLE_ENTITY);
    }

    ProductExtractor.Extraction extraction = productExtractor.extract(transcript);
    if (extraction == null || extraction.products() == null || extraction.unparsedPhrases() == null) {
      throw new VoiceException(
          "voice_extraction_unavailable",
          "Products could not be prepared from that recording. Try again or enter products manually.",
          HttpStatus.SERVICE_UNAVAILABLE);
    }
    List<String> unparsed = new ArrayList<>(extraction.unparsedPhrases());
    LinkedHashMap<String, ExtractedProduct> unique = new LinkedHashMap<>();
    boolean exceededProductLimit = extraction.products().size() > MAX_PRODUCTS;
    for (ProductExtractor.ExtractedProduct product :
        extraction.products().stream().limit(MAX_PRODUCTS).toList()) {
      if (product == null
          || product.name() == null
          || product.name().isBlank()
          || product.name().length() > 120
          || product.priceKes() == null
          || product.priceKes() < 0
          || product.priceKes() > 100000000
          || !Double.isFinite(product.confidence())
          || product.confidence() < 0
          || product.confidence() > 1
          || product.sourcePhrase() == null
          || product.sourcePhrase().length() > 240
          || (product.unit() != null && product.unit().length() > 40)) {
        unparsed.add(
            product == null || product.sourcePhrase() == null || product.sourcePhrase().isBlank()
                ? "A product could not be confidently read. Review it and enter it manually."
                : product.sourcePhrase());
        continue;
      }
      ExtractedProduct candidate =
          new ExtractedProduct(
              product.name().trim(),
              normalizeUnit(product.unit()),
              product.priceKes(),
              product.confidence(),
              product.sourcePhrase().trim());
      String key =
          candidate.name().toLowerCase(Locale.ROOT)
              + "\u0000"
              + (candidate.unit() == null ? "" : candidate.unit());
      ExtractedProduct existing = unique.get(key);
      if (existing == null || candidate.confidence() > existing.confidence()) {
        unique.put(key, candidate);
      }
    }
    List<String> boundedUnparsed =
        unparsed.stream()
            .filter(value -> value != null && !value.isBlank())
            .map(value -> value.length() > 240 ? value.substring(0, 240) : value)
            .limit(exceededProductLimit ? MAX_PRODUCTS - 1 : MAX_PRODUCTS)
            .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
    if (exceededProductLimit) {
      boundedUnparsed.add("Only the first 30 product drafts are shown. Record another note for more.");
    }
    return new VoiceDraft(
        transcript,
        List.copyOf(unique.values()),
        List.copyOf(boundedUnparsed));
  }

  private static String normalizeUnit(String value) {
    if (value == null || value.isBlank()) return null;
    return value.trim().toLowerCase(Locale.ROOT);
  }
}
