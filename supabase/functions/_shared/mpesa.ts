export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export type DarajaConfig = {
  baseUrl: string;
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  initiatorName: string;
  securityCredential: string;
  callbackToken: string;
  commandId: "BusinessPayment" | "SalaryPayment" | "PromotionPayment";
};

export function getDarajaConfig(): DarajaConfig {
  const environment = Deno.env.get("DARAJA_ENVIRONMENT") ?? "sandbox";
  if (environment !== "sandbox" && environment !== "production") {
    throw new Error("DARAJA_ENVIRONMENT must be sandbox or production");
  }

  const required: Record<string, string | undefined> = {
    DARAJA_CONSUMER_KEY: Deno.env.get("DARAJA_CONSUMER_KEY"),
    DARAJA_CONSUMER_SECRET: Deno.env.get("DARAJA_CONSUMER_SECRET"),
    DARAJA_SHORTCODE: Deno.env.get("DARAJA_SHORTCODE"),
    DARAJA_INITIATOR_NAME: Deno.env.get("DARAJA_INITIATOR_NAME"),
    DARAJA_SECURITY_CREDENTIAL: Deno.env.get("DARAJA_SECURITY_CREDENTIAL"),
    DARAJA_CALLBACK_TOKEN: Deno.env.get("DARAJA_CALLBACK_TOKEN"),
  };
  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length) {
    throw new Error(`Missing M-Pesa function secret(s): ${missing.join(", ")}`);
  }
  const commandId = Deno.env.get("DARAJA_COMMAND_ID") ?? "BusinessPayment";
  if (!["BusinessPayment", "SalaryPayment", "PromotionPayment"].includes(commandId)) {
    throw new Error("DARAJA_COMMAND_ID must be a supported Daraja B2C command");
  }

  return {
    baseUrl:
      environment === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke",
    consumerKey: required.DARAJA_CONSUMER_KEY!,
    consumerSecret: required.DARAJA_CONSUMER_SECRET!,
    shortcode: required.DARAJA_SHORTCODE!,
    initiatorName: required.DARAJA_INITIATOR_NAME!,
    securityCredential: required.DARAJA_SECURITY_CREDENTIAL!,
    callbackToken: required.DARAJA_CALLBACK_TOKEN!,
    commandId: commandId as DarajaConfig["commandId"],
  };
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function getDarajaAccessToken(config: DarajaConfig): Promise<string> {
  const response = await fetch(
    `${config.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: {
        Authorization: `Basic ${btoa(`${config.consumerKey}:${config.consumerSecret}`)}`,
      },
    },
  );
  const result = await response.json().catch(() => null);
  if (!response.ok || typeof result?.access_token !== "string") {
    throw new Error("Safaricom authentication failed");
  }
  return result.access_token;
}

export function callbackUrl(type: "result" | "timeout", callbackToken: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/+$/, "");
  if (!supabaseUrl) throw new Error("Missing SUPABASE_URL function secret");
  const url = new URL(`${supabaseUrl}/functions/v1/rider-mpesa-callback`);
  url.searchParams.set("token", callbackToken);
  url.searchParams.set("type", type);
  return url.toString();
}

export function getServiceRoleKey() {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY function secret");
  return key;
}

export function getSupabaseAnonKey() {
  const key = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!key) throw new Error("Missing SUPABASE_ANON_KEY function secret");
  return key;
}
