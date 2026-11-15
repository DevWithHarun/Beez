// Beez AI photo studio rules (blueprint section 5). Pure and browser-safe:
// shared by the merchant studio, the server functions and the tests.

export type StudioMode = "enhanced" | "studio" | "promotional";
export type MediaKind = "original" | StudioMode;
export type ImageOrigin = "photo" | "ai_enhanced" | "ai_presentation";
export type StudioLanguage = "en" | "sw";

export const STUDIO_MODES: StudioMode[] = ["enhanced", "studio", "promotional"];
export const MAX_INSTRUCTION_LENGTH = 200;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/** Real photo vs AI presentation: enhanced/studio keep the actual product, promotional is a styled scene. */
export function originForKind(kind: MediaKind): ImageOrigin {
  if (kind === "original") return "photo";
  if (kind === "promotional") return "ai_presentation";
  return "ai_enhanced";
}

export const MODE_LABELS: Record<MediaKind, { en: string; sw: string }> = {
  original: { en: "Original", sw: "Picha halisi" },
  enhanced: { en: "Enhanced", sw: "Imeboreshwa" },
  studio: { en: "Clean studio", sw: "Mandhari safi" },
  promotional: { en: "Promotional", sw: "Ya matangazo" },
};

/** What customers see under a product picture. Real photos carry no label. */
export function customerImageLabel(origin: ImageOrigin | null | undefined): string | null {
  if (origin === "ai_presentation") return "AI-styled image · actual item may look different";
  if (origin === "ai_enhanced") return "Photo touched up with AI";
  return null;
}

const PRESERVE_PRODUCT =
  "This is a real product a small Kenyan market merchant is selling. Keep the product itself exactly as it is: same shape, colour, pattern, logos, text, size, wear, stains, scratches and any signs of use. Do not add, remove, repair or redesign any part of the product, and never make a used item look new.";

const MODE_PROMPTS: Record<StudioMode, string> = {
  enhanced: `${PRESERVE_PRODUCT} Improve the photograph only: correct brightness and exposure, balance the colours to look natural, improve sharpness, gently reduce distracting clutter around the product and frame it neatly in the centre as a square product photo.`,
  studio: `${PRESERVE_PRODUCT} Place the same product on a clean, plain, soft white studio background with soft even lighting and a subtle natural shadow, centred as a square catalogue photo. Remove everything else from the background.`,
  promotional: `${PRESERVE_PRODUCT} Create a tasteful, realistic promotional scene that shows this same product in a fitting everyday Kenyan lifestyle setting with warm natural light. The product must stay the clear focus and must look exactly like the reference photo. Do not add any text, prices, logos, badges or people's faces.`,
};

/** Clean a merchant's change request ("make the background white") before it reaches the AI. */
export function normaliseInstruction(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_INSTRUCTION_LENGTH);
  return cleaned.length >= 2 ? cleaned : null;
}

export function buildStudioPrompt(mode: StudioMode, instruction?: string | null): string {
  const change = normaliseInstruction(instruction);
  const base = MODE_PROMPTS[mode];
  if (!change) return base;
  return `${base}\n\nThe merchant also asked for this change (apply it only to the background, lighting or framing, never to the product itself): "${change}"`;
}

/** Storage paths must live inside the merchant's own folder and use a safe file name. */
export function isMerchantPhotoPath(path: string, merchantId: string): boolean {
  if (!merchantId || path.length > 300) return false;
  const [owner, folder, file, ...rest] = path.split("/");
  return (
    rest.length === 0 &&
    owner === merchantId &&
    (folder === "originals" || folder === "studio") &&
    typeof file === "string" &&
    /^[a-zA-Z0-9._-]{1,120}$/.test(file) &&
    !file.startsWith(".")
  );
}

export function photoFileProblem(file: { type: string; size: number }): string | null {
  if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) return "Choose a JPG, PNG or WebP photo.";
  if (file.size > MAX_PHOTO_BYTES) return "The photo must be 5 MB or smaller.";
  if (file.size === 0) return "This photo file is empty.";
  return null;
}

/** Spoken explanation of the options Beez prepared (section 5.2). */
export function explainOptions(kinds: MediaKind[], productName: string | null, lang: StudioLanguage): string {
  const ready = kinds.filter((k) => k !== "original");
  const name = productName?.trim();
  if (lang === "sw") {
    if (!ready.length) return "Nimepokea picha yako. Chagua jinsi ungependa niiboreshe.";
    const list = ready.map((k) => MODE_LABELS[k].sw.toLowerCase()).join(", ");
    return `Nimeandaa picha ${ready.length === 1 ? "moja" : ready.length} ${name ? `ya ${name}` : ""}: ${list}. Chagua unayopenda, au niambie nibadilishe nini, kisha uchapishe.`.replace(/\s+/g, " ");
  }
  if (!ready.length) return "I have your photo. Choose how you would like me to improve it.";
  const list = ready.map((k) => MODE_LABELS[k].en.toLowerCase()).join(", ");
  return `I have prepared ${ready.length === 1 ? "a new version" : `${ready.length} versions`} of your ${name || "product"} photo: ${list}. Choose the one you like, or tell me what to change, then publish it.`;
}

export type PhotoAnalysis = {
  name: string | null;
  category: string | null;
  description: string | null;
  attributes: string[];
  condition: "new" | "used" | "unclear";
};

/** Keep only safe, bounded fields from the AI's reading of the photo. */
export function sanitiseAnalysis(value: unknown): PhotoAnalysis | null {
  if (!value || typeof value !== "object") return null;
  const v = value as {
    name?: unknown;
    category?: unknown;
    description?: unknown;
    attributes?: unknown;
    condition?: unknown;
  };
  const text = (x: unknown, max: number) =>
    typeof x === "string" && x.trim() ? x.trim().slice(0, max) : null;
  const condition = v.condition === "new" || v.condition === "used" ? v.condition : "unclear";
  const attributes = Array.isArray(v.attributes)
    ? v.attributes.filter((a): a is string => typeof a === "string" && !!a.trim()).map((a) => a.trim().slice(0, 40)).slice(0, 6)
    : [];
  return {
    name: text(v.name, 120),
    category: text(v.category, 100),
    description: text(v.description, 600),
    attributes,
    condition,
  };
}
