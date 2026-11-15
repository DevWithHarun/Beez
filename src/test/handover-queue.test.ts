import { describe, expect, it } from "vitest";
import {
  enqueueScan,
  isNetworkFailure,
  parseQueue,
  pruneQueue,
  removeScan,
  retryDelayMs,
} from "@/lib/handover-queue";

describe("offline handover scans", () => {
  it("keeps one pending scan per order — the latest", () => {
    let q = enqueueScan([], { orderId: "O1", code: "1111", savedAt: 1 });
    q = enqueueScan(q, { orderId: "O1", code: "2222", savedAt: 2 });
    q = enqueueScan(q, { orderId: "O2", token: "BEEZ1.O2.pickup.0123456789abcdef", savedAt: 3 });
    expect(q.map((s) => [s.orderId, s.code ?? "qr"])).toEqual([
      ["O1", "2222"],
      ["O2", "qr"],
    ]);
    expect(removeScan(q, "O1").map((s) => s.orderId)).toEqual(["O2"]);
  });

  it("drops scans older than 12 hours", () => {
    const q = [{ orderId: "O1", code: "1", savedAt: 0, attempts: 0 }];
    expect(pruneQueue(q, 11 * 3600_000)).toHaveLength(1);
    expect(pruneQueue(q, 12 * 3600_000)).toHaveLength(0);
  });

  it("retries only when there was no connection, backing off to 2 minutes", () => {
    expect(isNetworkFailure(new Error("Wrong code. 4 tries left."), true)).toBe(false);
    expect(isNetworkFailure(new TypeError("Failed to fetch"), true)).toBe(true);
    expect(isNetworkFailure(new Error("anything"), false)).toBe(true);
    expect([0, 1, 2, 10].map(retryDelayMs)).toEqual([5_000, 10_000, 20_000, 120_000]);
  });

  it("ignores broken saved data", () => {
    expect(parseQueue("not json")).toEqual([]);
    expect(parseQueue(JSON.stringify([{ orderId: "O1", savedAt: 1, attempts: 0 }]))).toEqual([]);
  });
});
