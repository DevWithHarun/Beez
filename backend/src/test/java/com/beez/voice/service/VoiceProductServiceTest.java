package com.beez.voice.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.beez.voice.api.VoiceException;
import com.beez.voice.spi.ProductExtractor;
import com.beez.voice.spi.SpeechToText;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.mock.web.MockMultipartFile;

class VoiceProductServiceTest {
  @Test
  void createsDeduplicatedValidatedDraftsWithoutPublishingProducts() {
    SpeechToText speechToText = mock(SpeechToText.class);
    ProductExtractor extractor = mock(ProductExtractor.class);
    JdbcTemplate jdbc = mock(JdbcTemplate.class);
    when(
            jdbc.<Integer>query(
                anyString(),
                ArgumentMatchers.<RowMapper<Integer>>any(),
                any(Object[].class)))
        .thenReturn(List.of(1));
    when(speechToText.transcribe(any(byte[].class), eq("sw"), eq("audio/webm")))
        .thenReturn("Viazi kilo moja shilingi mia moja");
    when(extractor.extract(any()))
        .thenReturn(
            new ProductExtractor.Extraction(
                List.of(
                    new ProductExtractor.ExtractedProduct(
                        "Potatoes", "KG", 100, 0.7, "viazi kilo moja shilingi mia moja"),
                    new ProductExtractor.ExtractedProduct(
                        "potatoes", "kg", 100, 0.95, "viazi kilo moja shilingi mia moja")),
                List.of()));

    VoiceProductService service = new VoiceProductService(speechToText, extractor, jdbc);
    var draft =
        service.extract(
            UUID.randomUUID(),
            new MockMultipartFile(
                "audio",
                "note.webm",
                "audio/webm;codecs=opus",
                new byte[] {1, 2, 3}),
            "sw");

    assertEquals(1, draft.products().size());
    assertEquals("potatoes", draft.products().getFirst().name());
    assertEquals("kg", draft.products().getFirst().unit());
    assertEquals(0.95, draft.products().getFirst().confidence());
    verify(extractor).extract("Viazi kilo moja shilingi mia moja");
  }

  @Test
  void rejectsUnsupportedAudioBeforeUsingTheProvider() {
    SpeechToText speechToText = mock(SpeechToText.class);
    ProductExtractor extractor = mock(ProductExtractor.class);
    JdbcTemplate jdbc = mock(JdbcTemplate.class);
    VoiceProductService service = new VoiceProductService(speechToText, extractor, jdbc);

    VoiceException exception =
        assertThrows(
            VoiceException.class,
            () ->
                service.extract(
                    UUID.randomUUID(),
                    new MockMultipartFile(
                        "audio", "note.txt", "text/plain", new byte[] {1, 2, 3}),
                    "en"));

    assertEquals("voice_format_unsupported", exception.getCode());
    verify(speechToText, never()).transcribe(any(byte[].class), anyString(), anyString());
    verify(jdbc, never()).update(anyString());
  }
}
