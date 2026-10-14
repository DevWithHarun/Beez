package com.beez.voice.api;

import java.util.List;

public final class VoiceProductModels {
  private VoiceProductModels() {}

  public record VoiceDraft(
      String transcript, List<ExtractedProduct> products, List<String> unparsedPhrases) {}

  public record ExtractedProduct(
      String name, String unit, Integer priceKes, double confidence, String sourcePhrase) {}
}
