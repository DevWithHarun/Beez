package com.beez.voice.spi;

import java.util.List;

public interface ProductExtractor {
  /** Return candidate product drafts; callers must validate before publication. */
  Extraction extract(String transcript);

  record Extraction(List<ExtractedProduct> products, List<String> unparsedPhrases) {}

  record ExtractedProduct(
      String name, String unit, Integer priceKes, double confidence, String sourcePhrase) {}
}
