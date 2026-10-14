package com.beez.adapters.voice;

import com.beez.voice.api.VoiceException;
import com.beez.voice.spi.SpeechToText;
import java.time.Duration;
import java.net.http.HttpClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Component
public class OpenAiSpeechToText implements SpeechToText {
  private final RestClient client;
  private final String apiKey;
  private final String model;

  public OpenAiSpeechToText(
      @Value("${beez.voice.openai.api-key:}") String apiKey,
      @Value("${beez.voice.openai.base-url:https://api.openai.com/v1}") String baseUrl,
      @Value("${beez.voice.openai.transcription-model:gpt-4o-mini-transcribe}") String model) {
    this.apiKey = apiKey;
    this.model = model;
    JdkClientHttpRequestFactory requestFactory =
        new JdkClientHttpRequestFactory(
            HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
    requestFactory.setReadTimeout(Duration.ofSeconds(45));
    this.client =
        RestClient.builder()
            .baseUrl(baseUrl)
            .requestFactory(requestFactory)
            .defaultHeader("Authorization", "Bearer " + apiKey)
            .build();
  }

  @Override
  public String transcribe(byte[] audio, String languageTag, String mediaType) {
    requireConfigured();
    MultiValueMap<String, Object> form = new LinkedMultiValueMap<>();
    form.add("file", new AudioResource(audio, extension(mediaType)));
    form.add("model", model);
    form.add("language", languageTag);
    form.add("response_format", "json");
    try {
      Transcription response =
          client
              .post()
              .uri("/audio/transcriptions")
              .contentType(MediaType.MULTIPART_FORM_DATA)
              .body(form)
              .retrieve()
              .body(Transcription.class);
      return response == null ? "" : response.text();
    } catch (RestClientResponseException exception) {
      throw providerUnavailable(exception);
    } catch (org.springframework.web.client.RestClientException exception) {
      throw new VoiceException(
          "voice_provider_unavailable",
          "Voice transcription is temporarily unavailable. Please try again or add products manually.",
          HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  private void requireConfigured() {
    if (apiKey.isBlank()) {
      throw new VoiceException(
          "voice_provider_unavailable",
          "Voice setup is incomplete. Please add products manually or contact Beez support.",
          HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  static VoiceException providerUnavailable(RestClientResponseException exception) {
    if (exception.getStatusCode().value() == 429) {
      return new VoiceException(
          "voice_provider_rate_limited",
          "Voice processing is busy. Please wait a moment or add products manually.",
          HttpStatus.SERVICE_UNAVAILABLE);
    }
    return new VoiceException(
        "voice_provider_unavailable",
        "Voice processing is temporarily unavailable. Please try again or add products manually.",
        HttpStatus.SERVICE_UNAVAILABLE);
  }

  private record Transcription(String text) {}

  private static String extension(String mediaType) {
    return switch (mediaType) {
      case "audio/ogg" -> "ogg";
      case "audio/mp4" -> "mp4";
      case "audio/mpeg" -> "mp3";
      default -> "webm";
    };
  }

  private static final class AudioResource extends ByteArrayResource {
    private final String extension;

    private AudioResource(byte[] audio, String extension) {
      super(audio);
      this.extension = extension;
    }

    @Override
    public String getFilename() {
      return "merchant-voice-note." + extension;
    }
  }
}
