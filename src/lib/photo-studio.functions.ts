import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  buildStudioPrompt,
  isMerchantPhotoPath,
  normaliseInstruction,
  originForKind,
  sanitiseAnalysis,
  type ImageOrigin,
  type MediaKind,
  type PhotoAnalysis,
} from "./photo-studio";

const BUCKET = "product-images";
const IMAGE_MODEL = "openai/gpt-image-2.5-sunburst";
const TEXT_MODEL = "openai/gpt-6-astra";

export type StudioMedia = {
  id: string;
  kind: MediaKind;
  origin: ImageOrigin;
  url: string;
  instruction: string | null;
  sourceMediaId: string | null;
};

type AuthedContext = {
  supabase: import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>;
  userId: string;
};

async function ownMerchantId(context: AuthedContext) {
  const { data, error } = await context.supabase
    .from("merchants")
    .select("id")
    .eq("owner_id", context.userId)
    .maybeSingle();
  if (error || !data) throw new Error("Save your business details first.");
  return data.id;
}

async function consumeStudioRequest(context: AuthedContext) {
  const { data, error } = await context.supabase.rpc("consume_photo_studio_request");
  if (error) throw new Error("The photo studio is unavailable right now. Please try again.");
  if (!data) throw new Error("You've used the photo studio a lot this hour. Please try again a bit later.");
}

function toMedia(row: {
  id: string;
  kind: string;
  origin: string;
  public_url: string;
  instruction: string | null;
  source_media_id: string | null;
}): StudioMedia {
  return {
    id: row.id,
    kind: row.kind as MediaKind,
    origin: row.origin as ImageOrigin,
    url: row.public_url,
    instruction: row.instruction,
    sourceMediaId: row.source_media_id,
  };
}

const MEDIA_COLUMNS = "id, merchant_id, kind, origin, storage_path, public_url, instruction, source_media_id";

/** Record the merchant's real photo after the browser uploads it to their own folder. */
export const registerProductPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ path: z.string().min(1).max(300) }))
  .handler(async ({ data, context }): Promise<StudioMedia> => {
    const merchantId = await ownMerchantId(context);
    if (!isMerchantPhotoPath(data.path, merchantId) || data.path.split("/")[1] !== "originals") {
      throw new Error("This photo could not be verified. Please upload it again.");
    }
    const publicUrl = context.supabase.storage.from(BUCKET).getPublicUrl(data.path).data.publicUrl;
    const { data: row, error } = await context.supabase
      .from("product_media")
      .insert({
        merchant_id: merchantId,
        kind: "original",
        origin: "photo",
        storage_path: data.path,
        public_url: publicUrl,
        created_by: context.userId,
      })
      .select(MEDIA_COLUMNS)
      .single();
    if (error || !row) throw new Error("Your photo could not be saved. Please try again.");
    await context.supabase.from("product_media_events").insert({
      media_id: row.id,
      merchant_id: merchantId,
      actor_id: context.userId,
      action: "uploaded",
    });
    return toMedia(row);
  });

function outputText(response: unknown): string | null {
  const r = response as {
    output_text?: string;
    output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  };
  if (typeof r.output_text === "string" && r.output_text) return r.output_text;
  for (const item of r.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) if (part.type === "output_text" && part.text) return part.text;
  }
  return null;
}

/** AI reads the real photo and drafts product details (ImageAnalysisService). */
export const analyseProductPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ mediaId: z.string().uuid(), language: z.enum(["en", "sw"]) }))
  .handler(async ({ data, context }): Promise<PhotoAnalysis> => {
    const { data: media, error } = await context.supabase
      .from("product_media")
      .select(MEDIA_COLUMNS)
      .eq("id", data.mediaId)
      .eq("kind", "original")
      .maybeSingle();
    if (error || !media) throw new Error("This photo could not be found.");
    await consumeStudioRequest(context);
    const { generateResponse, GatewayError } = await import("@lovable.dev/ai-gateway");
    try {
      const response = await generateResponse({
        model: TEXT_MODEL,
        reasoning: { effort: "low" },
        instructions:
          "You help small Kenyan market merchants list products on Beez. Look at the product photo and describe only what is clearly visible. Never invent brands, sizes, materials or features you cannot see. If the item shows wear or signs of use, say so honestly; never call a used item new. Write the name, category and description in the requested language (English or Kiswahili). Keep the description to one or two short, friendly sentences.",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: `Language: ${data.language === "sw" ? "Kiswahili" : "English"}` },
              { type: "input_image", image_url: media.public_url, detail: "auto" },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "product_photo_analysis",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                name: { type: ["string", "null"] },
                category: { type: ["string", "null"] },
                description: { type: ["string", "null"] },
                attributes: { type: "array", items: { type: "string" } },
                condition: { type: "string", enum: ["new", "used", "unclear"] },
              },
              required: ["name", "category", "description", "attributes", "condition"],
            },
          },
        },
        max_output_tokens: 600,
      });
      const text = outputText(response);
      const analysis = text ? sanitiseAnalysis(JSON.parse(text)) : null;
      if (!analysis) throw new Error("empty analysis");
      await context.supabase.from("product_media_events").insert({
        media_id: media.id,
        merchant_id: media.merchant_id,
        actor_id: context.userId,
        action: "analysed",
        details: { model: TEXT_MODEL, condition: analysis.condition, attributes: analysis.attributes },
      });
      return analysis;
    } catch (cause) {
      if (cause instanceof GatewayError) console.error("Photo analysis failed", cause.code, cause.ids);
      else console.error("Photo analysis failed", cause);
      throw new Error("Beez couldn't read this photo. You can still fill in the details yourself.");
    }
  });

function base64ToBytes(b64: string) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Create an Enhanced, Clean studio or Promotional version from the real photo. */
export const createPhotoVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      sourceMediaId: z.string().uuid(),
      mode: z.enum(["enhanced", "studio", "promotional"]),
      instruction: z.string().max(400).nullable().optional(),
    }),
  )
  .handler(async ({ data, context }): Promise<StudioMedia> => {
    const { data: source, error } = await context.supabase
      .from("product_media")
      .select(MEDIA_COLUMNS)
      .eq("id", data.sourceMediaId)
      .eq("kind", "original")
      .maybeSingle();
    if (error || !source) throw new Error("The original photo could not be found.");
    const instruction = normaliseInstruction(data.instruction);
    await consumeStudioRequest(context);

    const download = await context.supabase.storage.from(BUCKET).download(source.storage_path);
    if (download.error || !download.data) throw new Error("The original photo could not be opened.");
    const type = download.data.type || "image/jpeg";
    const extension = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
    const original = new File([download.data], `product.${extension}`, { type });

    const { editImage, GatewayError } = await import("@lovable.dev/ai-gateway");
    let bytes: Uint8Array;
    try {
      const result = await editImage({
        model: IMAGE_MODEL,
        image: original,
        prompt: buildStudioPrompt(data.mode, instruction),
        size: "1024x1024",
        quality: "medium",
        output_format: "jpeg",
        n: 1,
      });
      const b64 = result.data?.[0]?.b64_json;
      if (!b64) throw new Error("empty image");
      bytes = base64ToBytes(b64);
    } catch (cause) {
      if (cause instanceof GatewayError) {
        console.error("Photo studio generation failed", cause.code, cause.ids);
        if (cause.code === "payment_required")
          throw new Error("The photo studio is out of AI credits. Please contact Beez support.");
      } else console.error("Photo studio generation failed", cause);
      throw new Error("Beez couldn't create this version. Please try again in a moment.");
    }

    const path = `${source.merchant_id}/studio/${crypto.randomUUID()}.jpg`;
    const upload = await context.supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
    if (upload.error) throw new Error("The new version could not be saved. Please try again.");
    const publicUrl = context.supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    const { data: row, error: insertError } = await context.supabase
      .from("product_media")
      .insert({
        merchant_id: source.merchant_id,
        source_media_id: source.id,
        kind: data.mode,
        origin: originForKind(data.mode),
        storage_path: path,
        public_url: publicUrl,
        instruction,
        model: IMAGE_MODEL,
        created_by: context.userId,
      })
      .select(MEDIA_COLUMNS)
      .single();
    if (insertError || !row) {
      await context.supabase.storage.from(BUCKET).remove([path]);
      throw new Error("The new version could not be saved. Please try again.");
    }
    await context.supabase.from("product_media_events").insert({
      media_id: row.id,
      merchant_id: source.merchant_id,
      actor_id: context.userId,
      action: data.mode === "promotional" ? "generated" : "enhanced",
      details: { model: IMAGE_MODEL, mode: data.mode, instruction, source_media_id: source.id },
    });
    return toMedia(row);
  });

/** Turn a spoken change request ("make the background white") into text. */
export const transcribeStudioRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    if (!(input instanceof FormData)) throw new Error("Expected audio upload");
    const audio = input.get("audio");
    const language = input.get("language");
    if (!(audio instanceof Blob) || audio.size === 0) throw new Error("No audio was recorded");
    if (audio.size > 2_000_000) throw new Error("The recording is too long. Keep it under 15 seconds.");
    return { audio, language: language === "sw" ? ("sw" as const) : ("en" as const) };
  })
  .handler(async ({ data }) => {
    const { transcribeAudio, GatewayError } = await import("@lovable.dev/ai-gateway");
    try {
      const result = await transcribeAudio({
        model: "openai/gpt-transcribe",
        file: data.audio,
        language: data.language,
        prompt: "Kenyan merchant asking for a change to a product photo: background, white, lighting, brighter, crop, mandhari, nyeupe, mwanga.",
      });
      const text = typeof result === "string" ? result : ((result as { text?: string }).text ?? "");
      return { transcript: text.trim() };
    } catch (error) {
      if (error instanceof GatewayError) console.error("Studio request transcription failed", error.code, error.ids);
      else console.error("Studio request transcription failed", error);
      throw new Error("Beez couldn't hear that clearly. Please try again or type your change.");
    }
  });
