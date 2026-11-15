// Pure rules for handover scans saved while the rider has no signal. Each order
// keeps at most one pending scan (the latest), and only network failures are
// retried — a code the server rejects is dropped and shown to the rider. Tested.

export type QueuedScan = {
  orderId: string;
  token?: string;
  code?: string;
  savedAt: number;
  attempts: number;
};

export const MAX_QUEUE_AGE_MS = 12 * 60 * 60 * 1000;

export function enqueueScan(queue: QueuedScan[], scan: Omit<QueuedScan, "attempts">): QueuedScan[] {
  return [...queue.filter((q) => q.orderId !== scan.orderId), { ...scan, attempts: 0 }];
}

export function removeScan(queue: QueuedScan[], orderId: string) {
  return queue.filter((q) => q.orderId !== orderId);
}

/** Drop scans older than 12 hours; they'd only confuse the rider. */
export function pruneQueue(queue: QueuedScan[], nowMs: number) {
  return queue.filter((q) => nowMs - q.savedAt < MAX_QUEUE_AGE_MS);
}

/** Wait before retrying a scan: 5s, 10s, 20s … capped at 2 minutes. */
export function retryDelayMs(attempts: number) {
  return Math.min(120_000, 5_000 * 2 ** Math.max(0, attempts));
}

/** Did the request fail because there was no connection (worth retrying)? */
export function isNetworkFailure(error: unknown, online: boolean) {
  if (!online) return true;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /failed to fetch|networkerror|network request failed|load failed|timed? ?out|fetch failed/i.test(
    message,
  );
}

export function parseQueue(raw: string | null): QueuedScan[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter(
      (q): q is QueuedScan =>
        q &&
        typeof q.orderId === "string" &&
        typeof q.savedAt === "number" &&
        typeof q.attempts === "number" &&
        (typeof q.token === "string" || typeof q.code === "string"),
    );
  } catch {
    return [];
  }
}
