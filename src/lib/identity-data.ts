// Pure role-based routing rules shared by the login flow, the bottom navs and
// the dashboard guards.
export type WorkspaceRoles = { admin: boolean; merchant: boolean; rider: boolean };
export type WorkspaceKind = 'merchant' | 'rider';

export type Dashboard = '/merchant/dashboard' | '/rider/dashboard';
export type Onboarding = '/onboarding/merchant' | '/onboarding/rider';
export type LoginDestination = '/admin' | Dashboard | Onboarding | '/discover';

export function dashboardPath(kind: WorkspaceKind): Dashboard {
  return kind === 'merchant' ? '/merchant/dashboard' : '/rider/dashboard';
}

export function onboardingPath(kind: WorkspaceKind): Onboarding {
  return kind === 'merchant' ? '/onboarding/merchant' : '/onboarding/rider';
}

// Where to go after signing in. When the visitor came from the Sell or Delivery
// tab (`next`), they go to that workspace — or set it up if they don't have it.
export function loginDestination(roles: WorkspaceRoles, next?: WorkspaceKind): LoginDestination {
  if (next) return roles[next] ? dashboardPath(next) : onboardingPath(next);
  if (roles.admin) return '/admin';
  if (roles.merchant) return '/merchant/dashboard';
  if (roles.rider) return '/rider/dashboard';
  return '/discover';
}

// Dashboard guard. Signed-out visitors (`null`) must sign in first; signed-in
// users without that workspace are sent to set it up. Only owners get in.
export function workspaceGate(roles: WorkspaceRoles | null, kind: WorkspaceKind): 'allow' | '/login' | Onboarding {
  if (!roles) return '/login';
  return roles[kind] ? 'allow' : onboardingPath(kind);
}

export function parseWorkspaceKind(value: unknown): WorkspaceKind | undefined {
  return value === 'merchant' || value === 'rider' ? value : undefined;
}
