import { describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getSession: vi.fn() } } }));
vi.mock('@/lib/guest.functions', () => ({ startGuestSession: vi.fn() }));
import type { User } from '@supabase/supabase-js';
import { isGuestUser } from '@/lib/guest-session';

const user = (app_metadata: Record<string, unknown>, is_anonymous = false) => ({ id: 'u', app_metadata, is_anonymous } as unknown as User);

describe('guest shoppers', () => {
  it('treats guest checkout sessions as guests', () => {
    expect(isGuestUser(user({ guest: true }))).toBe(true);
    expect(isGuestUser(user({}, true))).toBe(true);
  });
  it('treats real accounts and signed-out visitors as not guests', () => {
    expect(isGuestUser(user({ provider: 'phone' }))).toBe(false);
    expect(isGuestUser(null)).toBe(false);
  });
});
