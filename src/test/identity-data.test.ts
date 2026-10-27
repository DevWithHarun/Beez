import { describe, it, expect } from 'vitest';
import { loginDestination, workspaceTarget } from '@/lib/identity-data';

describe('Login destinations', () => {
  it('sends admins to the admin area', () => {
    expect(loginDestination({ admin: true, merchant: false, rider: false })).toBe('/admin');
  });
  it('sends merchants to their dashboard', () => {
    expect(loginDestination({ admin: false, merchant: true, rider: false })).toBe('/merchant/dashboard');
  });
  it('sends riders to their dashboard', () => {
    expect(loginDestination({ admin: false, merchant: false, rider: true })).toBe('/rider/dashboard');
  });
  it('sends users with no workspace to the marketplace', () => {
    expect(loginDestination({ admin: false, merchant: false, rider: false })).toBe('/discover');
  });
});

describe('Bottom-nav workspace targets', () => {
  it('Sell opens the merchant dashboard for merchants', () => {
    expect(workspaceTarget({ admin: false, merchant: true, rider: false }, 'merchant')).toBe('/merchant/dashboard');
  });
  it('Sell opens merchant onboarding for signed-out users', () => {
    expect(workspaceTarget(null, 'merchant')).toBe('/onboarding/merchant');
  });
  it('Delivery opens the rider dashboard for riders', () => {
    expect(workspaceTarget({ admin: false, merchant: false, rider: true }, 'rider')).toBe('/rider/dashboard');
  });
  it('Delivery opens rider onboarding when the user is not a rider', () => {
    expect(workspaceTarget({ admin: false, merchant: true, rider: false }, 'rider')).toBe('/onboarding/rider');
  });
});
