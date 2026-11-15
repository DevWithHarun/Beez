export type VoiceProductDraft = {
  name: string | null;
  category: string | null;
  price_kes: number | null;
  stock: number | null;
};

export type VoiceProductUpdates = Partial<VoiceProductDraft>;

export function mergeVoiceProductUpdates(
  current: VoiceProductDraft,
  updates: VoiceProductUpdates,
): { draft: VoiceProductDraft; changedFields: (keyof VoiceProductDraft)[] } {
  const draft = { ...current };
  const changedFields: (keyof VoiceProductDraft)[] = [];
  if (updates.name != null && updates.name !== current.name) {
    draft.name = updates.name;
    changedFields.push("name");
  }
  if (updates.category != null && updates.category !== current.category) {
    draft.category = updates.category;
    changedFields.push("category");
  }
  if (updates.price_kes != null && updates.price_kes !== current.price_kes) {
    draft.price_kes = updates.price_kes;
    changedFields.push("price_kes");
  }
  if (updates.stock != null && updates.stock !== current.stock) {
    draft.stock = updates.stock;
    changedFields.push("stock");
  }

  return { draft, changedFields };
}

export function missingVoiceProductFields(draft: VoiceProductDraft) {
  return (["name", "category", "price_kes", "stock"] as const).filter((field) => {
    const value = draft[field];
    return value === null || (typeof value === "string" && !value.trim());
  });
}
