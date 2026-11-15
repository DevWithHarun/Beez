import { redirect } from '@tanstack/react-router';
import { getAccountSession } from '@/lib/guest-session';
import { getMyRoles } from '@/lib/identity.functions';
import { workspaceGate, type WorkspaceKind } from '@/lib/identity-data';

// Runs in a dashboard route's beforeLoad (client-only routes). Always checks
// fresh roles so a just-finished onboarding is never bounced by a stale cache.
export async function requireWorkspace(kind: WorkspaceKind) {
  const session = await getAccountSession(); // guest shoppers count as signed out
  const roles = session ? await getMyRoles() : null;
  const gate = workspaceGate(roles, kind);
  if (gate === '/login') throw redirect({ to: '/login', search: { next: kind } });
  if (gate !== 'allow') throw redirect({ to: gate });
  return { roles };
}
