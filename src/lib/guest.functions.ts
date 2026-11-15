import { createServerFn } from '@tanstack/react-start';
import { getRequestHeader } from '@tanstack/react-start/server';

// Starts a guest shopper session so people can order without signing up.
// The server makes a throwaway account (marked guest in app metadata, which
// shoppers can't edit) and returns a one-time sign-in code for this browser.
export const startGuestSession = createServerFn({ method: 'POST' }).handler(async () => {
  const ip = (getRequestHeader('cf-connecting-ip') || getRequestHeader('x-forwarded-for')?.split(',')[0] || 'unknown').trim();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`beez-guest:${ip}`));
  const ipHash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');

  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: allowed, error: limitError } = await supabaseAdmin.rpc('consume_guest_session', { _ip_hash: ipHash });
  if (limitError) throw new Error('Checkout is busy right now. Please try again.');
  if (!allowed) throw new Error('Too many new checkouts from this connection. Please wait a while and try again.');

  const email = `guest-${crypto.randomUUID()}@guest.beez.app`;
  const { error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { guest: true },
  });
  if (createError) {
    console.error('Guest account failed', createError.message);
    throw new Error('Checkout is busy right now. Please try again.');
  }
  const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    console.error('Guest sign-in code failed', linkError?.message);
    throw new Error('Checkout is busy right now. Please try again.');
  }
  return { tokenHash };
});
