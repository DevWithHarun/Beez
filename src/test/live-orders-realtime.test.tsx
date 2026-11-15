import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  orderSnapshots: [] as unknown[],
  onSubscribe: null as ((status: string) => void) | null,
  from: vi.fn(),
  channel: vi.fn(),
  removeChannel: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.from,
    channel: mocks.channel,
    removeChannel: mocks.removeChannel,
  },
}));

import { useLiveOrder } from "@/lib/live-orders";

const order = (status: string, riderLat: number | null) => ({
  id: "BEEZ-1",
  merchant_name: "Shop",
  pickup_area: "Kizingo",
  customer_area: "Nyali",
  items_summary: "1 item",
  total_kes: 100,
  status,
  pickup_lat: -4.05,
  pickup_lng: 39.67,
  drop_lat: -4.02,
  drop_lng: 39.69,
  rider_id: status === "Preparing" ? null : "rider-1",
  rider_lat: riderLat,
  rider_lng: riderLat === null ? null : 39.68,
  delivery_fee_kes: 0,
  payment_status: "Paid",
  payment_method: "M-Pesa",
  customer_id: "customer-1",
  created_at: "2026-11-15T10:00:00Z",
  updated_at: "2026-11-15T10:00:00Z",
  assigned_at: null,
  delivered_at: null,
  rider_earning_kes: 0,
});

describe("customer live order reconnection", () => {
  beforeEach(() => {
    mocks.orderSnapshots = [order("Preparing", null), order("Assigned", -4.03)];
    mocks.onSubscribe = null;
    mocks.from.mockImplementation((table: string) => {
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        maybeSingle: vi.fn(async () => ({
          data: mocks.orderSnapshots.shift() ?? null,
          error: null,
        })),
        order: vi.fn(async () => ({ data: [], error: null })),
      };
      return query;
    });
    mocks.channel.mockImplementation(() => {
      const channel = {
        on: vi.fn(() => channel),
        subscribe: vi.fn((callback: (status: string) => void) => {
          mocks.onSubscribe = callback;
          return channel;
        }),
      };
      return channel;
    });
  });

  it("refreshes status and rider position when realtime reconnects", async () => {
    const { result } = renderHook(() => useLiveOrder("BEEZ-1"));

    await waitFor(() => expect(result.current.order?.status).toBe("Preparing"));
    act(() => mocks.onSubscribe?.("SUBSCRIBED"));

    await waitFor(() => {
      expect(result.current.order?.status).toBe("Assigned");
      expect(result.current.order?.rider_lat).toBe(-4.03);
      expect(result.current.connected).toBe(true);
    });
  });
});
