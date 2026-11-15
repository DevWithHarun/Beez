import { describe, expect, it } from "vitest";
import {
  mergeVoiceProductUpdates,
  missingVoiceProductFields,
  type VoiceProductDraft,
} from "@/lib/voice-product";

const draft: VoiceProductDraft = {
  name: "Tomatoes",
  category: "Groceries",
  price_kes: 120,
  stock: 8,
};

describe("voice product drafts", () => {
  it("preserves unrelated fields when applying a correction", () => {
    const result = mergeVoiceProductUpdates(draft, { price_kes: 150 });

    expect(result.draft).toEqual({ ...draft, price_kes: 150 });
    expect(result.changedFields).toEqual(["price_kes"]);
  });

  it("does not apply null or unchanged updates", () => {
    const result = mergeVoiceProductUpdates(draft, { name: null, stock: 8 });

    expect(result.draft).toEqual(draft);
    expect(result.changedFields).toEqual([]);
  });

  it("reports all required product details that still need confirmation", () => {
    expect(
      missingVoiceProductFields({
        name: "Shoes",
        category: null,
        price_kes: null,
        stock: 10,
      }),
    ).toEqual(["category", "price_kes"]);
  });

  it("accepts zero price and stock without treating them as missing", () => {
    expect(missingVoiceProductFields({ ...draft, price_kes: 0, stock: 0 })).toEqual([]);
  });
});
