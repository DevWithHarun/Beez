// Phone formatting and friendly error messages shared by every phone step.

export const toE164 = (phone: string) =>
  `+254${phone.replace(/\D/g, "").replace(/^0+/, "").replace(/^254/, "")}`;

// Maps raw Supabase auth errors to short, human messages.
export function friendlyPhoneError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("provider is disabled") || m.includes("unsupported phone provider") || m.includes("unsupported_provider") || m.includes("phone_provider_disabled")) {
    return "No code was sent. Phone sign-in is disabled for this Supabase project. Enable the Phone provider and configure an SMS provider in Supabase Authentication settings.";
  }
  if (m.includes("sms could not be sent") || m.includes("sms_not_sent") || m.includes("failed to send")) {
    return "We couldn't text your code right now. Please check the number and try again in a moment.";
  }
  if (m.includes("rate limit") || m.includes("over_request") || m.includes("too many")) {
    return "Too many attempts. Please wait a minute and request a new code.";
  }
  if (m.includes("invalid") && (m.includes("phone") || m.includes("number"))) {
    return "That number doesn't look right. Use the format 0712 345 678.";
  }
  if (m.includes("otp_expired") || m.includes("expired")) {
    return "That code has expired. Please request a new one.";
  }
  if (m.includes("invalid otp") || m.includes("invalid token") || m.includes("invalid_credentials") || m.includes("incorrect")) {
    return "That code isn't right. Check the text message and try again.";
  }
  return raw;
}
