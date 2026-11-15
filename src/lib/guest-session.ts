import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { startGuestSession } from '@/lib/guest.functions';

/** Guest shoppers have a session for their orders but no Beez account. */
export function isGuestUser(user: User | null | undefined): boolean {
  return !!user && (user.app_metadata?.['guest'] === true || user.is_anonymous === true);
}

/** A real (non-guest) session, or null. Use for sign-in and dashboard checks. */
export async function getAccountSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session && !isGuestUser(session.user) ? session : null;
}

/** Makes sure this browser has a session that can place orders, starting a guest one if needed. */
export async function ensureShopperSession(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return;
  const { tokenHash } = await startGuestSession();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
  if (error) throw new Error('Checkout is busy right now. Please try again.');
}
