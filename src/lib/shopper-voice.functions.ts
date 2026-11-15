import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import {
  composeReply, linesNeedAi, mergeLines, parseSpokenList, toListLines,
  type CatalogEntry, type ListLine, type ShopperLanguage,
} from './shopper-voice';
import type { Database } from '@/integrations/supabase/types';

// Public on purpose: shoppers can use the voice assistant before signing in.
// It only reads active products (already public) and never changes data.

const LANGS = ['en', 'sw', 'fr'] as const;

async function publicClient() {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key) {
    // Fall back to the app's generated public client (same publishable key).
    const { supabase } = await import('@/integrations/supabase/client');
    return supabase;
  }
  const { createClient } = await import('@supabase/supabase-js');
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith('sb_') && h.get('Authorization') === `Bearer ${key}`) h.delete('Authorization');
        h.set('apikey', key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

async function loadCatalog(): Promise<CatalogEntry[]> {
  const client = await publicClient();
  const { data, error } = await client
    .from('products')
    .select('id, name, category, price_kes, stock, merchant:merchants(name)')
    .eq('active', true)
    .limit(300);
  if (error) throw new Error('Products could not be loaded right now. Please try again.');
  return (data as unknown as { id: string; name: string; category: string; price_kes: number; stock: number; merchant: { name: string } | null }[])
    .map(p => ({ id: p.id, name: p.name, category: p.category, price: p.price_kes, stock: p.stock, merchantName: p.merchant?.name ?? 'Local merchant' }));
}

function extractOutputText(response: unknown): string | null {
  const r = response as { output_text?: string; output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> };
  if (typeof r.output_text === 'string' && r.output_text) return r.output_text;
  for (const item of r.output ?? []) {
    if (item.type !== 'message') continue;
    for (const part of item.content ?? []) if (part.type === 'output_text' && part.text) return part.text;
  }
  return null;
}

const LANGUAGE_NAME: Record<ShopperLanguage, string> = { en: 'English', sw: 'Kiswahili', fr: 'French' };

async function askAssistant(transcript: string, language: ShopperLanguage, catalog: CatalogEntry[]) {
  const { generateResponse, GatewayError } = await import('@lovable.dev/ai-gateway');
  const list = catalog
    .map(p => `id=${p.id} | ${p.name} | ${p.category} | KSh ${p.price} | stock ${p.stock} | seller ${p.merchantName}`)
    .join('\n');
  try {
    const response = await generateResponse({
      model: 'openai/gpt-6-astra',
      reasoning: { effort: 'low' },
      instructions:
        'You are Beez, a friendly voice shopping assistant for local markets in Kenya. Shoppers speak English, Kiswahili, Sheng, French, Haitian Creole or a mix. ' +
        'Read what the shopper said and pick products ONLY from the catalogue given. ' +
        'If they list things to buy, return one line per thing with the quantity they asked for (whole numbers, at least 1; "2 kg" means 2). ' +
        'If they ask a question or want suggestions (for example "what fruit do you have"), return the matching products with quantity 1 and answer the question. ' +
        'Never invent products or ids. If something is not in the catalogue or has stock 0, return it with product_id null. ' +
        'If several catalogue rows match, choose the one with stock. ' +
        'reply: one or two short, warm spoken sentences in the shopper\'s selected language, saying what you found and what is missing. No markdown, no ids.',
      input: [{ role: 'user', content: `Selected language: ${LANGUAGE_NAME[language]}\nCatalogue:\n${list || '(empty)'}\n\nShopper said: "${transcript}"` }],
      text: {
        format: {
          type: 'json_schema',
          name: 'shopping_reply',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              reply: { type: 'string' },
              lines: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    heard: { type: 'string' },
                    quantity: { type: 'integer' },
                    product_id: { type: ['string', 'null'] },
                  },
                  required: ['heard', 'quantity', 'product_id'],
                },
              },
            },
            required: ['reply', 'lines'],
          },
        },
      },
      max_output_tokens: 1500,
    });
    const text = extractOutputText(response);
    if (!text) return null;
    return z.object({
      reply: z.string(),
      lines: z.array(z.object({ heard: z.string(), quantity: z.number(), product_id: z.string().nullable() })).max(30),
    }).parse(JSON.parse(text));
  } catch (error) {
    if (error instanceof GatewayError) console.error('Shopper assistant AI failed', error.code, error.ids);
    else console.error('Shopper assistant AI failed', error);
    return null;
  }
}

export type ShopperAssistantResult = { reply: string; lines: ListLine[]; source: 'rules' | 'ai' };

export const askShopperAssistant = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ transcript: z.string().trim().min(1).max(300), language: z.enum(LANGS) }))
  .handler(async ({ data }): Promise<ShopperAssistantResult> => {
    const catalog = await loadCatalog();
    const ruleLines = toListLines(parseSpokenList(data.transcript), catalog);
    if (!linesNeedAi(data.transcript, ruleLines)) {
      return { reply: composeReply(ruleLines, catalog, data.language), lines: ruleLines, source: 'rules' };
    }

    const ai = await askAssistant(data.transcript, data.language, catalog);
    if (!ai) {
      // AI unavailable: still give the shopper whatever the rules understood.
      return { reply: composeReply(ruleLines, catalog, data.language), lines: ruleLines, source: 'rules' };
    }
    const aiLines: ListLine[] = ai.lines.map(l => {
      const product = l.product_id ? catalog.find(c => c.id === l.product_id && c.stock > 0) : undefined;
      const wanted = Math.max(1, Math.min(99, Math.round(l.quantity)));
      if (!product) return { heard: l.heard, quantity: wanted, productId: null, limited: false };
      const quantity = Math.min(wanted, product.stock);
      return { heard: l.heard, quantity, productId: product.id, limited: quantity < wanted };
    });
    return { reply: ai.reply, lines: mergeLines([], aiLines, catalog), source: 'ai' };
  });

export const transcribeShopperSpeech = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => {
    if (!(input instanceof FormData)) throw new Error('Expected audio upload');
    const audio = input.get('audio');
    const language = input.get('language');
    if (!(audio instanceof Blob) || audio.size === 0) throw new Error('No audio was recorded');
    if (audio.size > 1_500_000) throw new Error('That was too long. Keep it under 10 seconds.');
    const lang = (LANGS as readonly string[]).includes(String(language)) ? (language as ShopperLanguage) : 'en';
    return { audio, language: lang };
  })
  .handler(async ({ data }) => {
    const { transcribeAudio, GatewayError } = await import('@lovable.dev/ai-gateway');
    try {
      const result = await transcribeAudio({
        model: 'openai/gpt-transcribe',
        file: data.audio,
        language: data.language,
        prompt: 'A shopper in Kenya listing groceries to buy: nyanya, mkate, maziwa, sukari, unga, tomatoes, bread, milk, kilo, kg.',
      });
      const text = typeof result === 'string' ? result : (result as { text?: string }).text ?? '';
      return { transcript: text.trim() };
    } catch (error) {
      if (error instanceof GatewayError) console.error('Shopper transcription failed', error.code, error.ids);
      else console.error('Shopper transcription failed', error);
      throw new Error("Beez couldn't hear that clearly. Please try again or type your list.");
    }
  });
