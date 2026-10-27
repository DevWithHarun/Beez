import { createServerFn } from '@tanstack/react-start';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { loginDestination, type WorkspaceRoles } from './identity-data';
import type { Database } from '@/integrations/supabase/types';

async function loadRoles(supabase: SupabaseClient<Database>, userId: string): Promise<WorkspaceRoles> {
  const [roles, merchant, rider] = await Promise.all([
    supabase.from('user_roles').select('role').eq('user_id', userId),
    supabase.from('merchants').select('id').eq('owner_id', userId).limit(1),
    supabase.from('riders').select('id').eq('id', userId).limit(1),
  ]);
  if (roles.error || merchant.error || rider.error) {
    throw new Error('We could not check your account. Please try again.');
  }
  return {
    admin: roles.data.some((r) => r.role === 'admin'),
    merchant: merchant.data.length > 0,
    rider: rider.data.length > 0,
  };
}

// Returns the signed-in user's workspaces: admin / merchant / rider flags.
export const getMyRoles = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(({ context }) => loadRoles(context.supabase, context.userId));

// Where the login page should send the signed-in user.
export const resolveLoginDestination = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => loginDestination(await loadRoles(context.supabase, context.userId)));
