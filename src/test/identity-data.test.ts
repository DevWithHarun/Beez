import { describe, it, expect } from 'vitest';
import { loginDestination, workspaceGate } from '@/lib/identity-data';

const none = { admin: false, merchant: false, rider: false };
const merchant = { ...none, merchant: true };
const rider = { ...none, rider: true };

describe('Login destinations', () => {
  it('sends admins to the admin area', () => {
    expect(loginDestination({ ...none, admin: true })).toBe('/admin');
  });
  it('sends merchants to their dashboard', () => {
    expect(loginDestination(merchant)).toBe('/merchant/dashboard');
  });
  it('sends riders to their dashboard', () => {
    expect(loginDestination(rider)).toBe('/rider/dashboard');
  });
  it('sends users with no workspace to the marketplace', () => {
    expect(loginDestination(none)).toBe('/discover');
  });
  it('after tapping Sell, a merchant lands on the merchant dashboard', () => {
    expect(loginDestination({ ...merchant, admin: true }, 'merchant')).toBe('/merchant/dashboard');
  });
  it('after tapping Delivery, a non-rider is sent to rider registration', () => {
    expect(loginDestination(merchant, 'rider')).toBe('/onboarding/rider');
  });
});

describe('Dashboard access', () => {
  it('signed-out visitors must sign in before the merchant dashboard', () => {
    expect(workspaceGate(null, 'merchant')).toBe('/login');
  });
  it('signed-out visitors must sign in before the rider dashboard', () => {
    expect(workspaceGate(null, 'rider')).toBe('/login');
  });
  it('merchants can open the merchant dashboard', () => {
    expect(workspaceGate(merchant, 'merchant')).toBe('allow');
  });
  it('riders can open the rider dashboard', () => {
    expect(workspaceGate(rider, 'rider')).toBe('allow');
  });
  it('a rider cannot open the merchant dashboard', () => {
    expect(workspaceGate(rider, 'merchant')).toBe('/onboarding/merchant');
  });
  it('a merchant cannot open the rider dashboard', () => {
    expect(workspaceGate(merchant, 'rider')).toBe('/onboarding/rider');
  });
  it('being an admin alone does not open the rider dashboard', () => {
    expect(workspaceGate({ ...none, admin: true }, 'rider')).toBe('/onboarding/rider');
  });
});
