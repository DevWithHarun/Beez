// Sends rider handover scans, saving them on the phone when there's no signal
// and retrying automatically once the connection is back.
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { verifyHandover } from "@/lib/handover.functions";
import {
  enqueueScan,
  isNetworkFailure,
  parseQueue,
  pruneQueue,
  removeScan,
  retryDelayMs,
  type QueuedScan,
} from "@/lib/handover-queue";

const KEY = "beez:rider-scan-queue:v1";

export type ScanResult = { kind: "done"; status: string; handover: string } | { kind: "saved" };

function load() {
  try {
    return pruneQueue(parseQueue(window.localStorage.getItem(KEY)), Date.now());
  } catch {
    return [];
  }
}
function save(queue: QueuedScan[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(queue));
  } catch {
    // Storage full or blocked: the scan still works online.
  }
}

export function useHandoverQueue(
  onSent: (orderId: string, status: string) => void,
  onDropped: (orderId: string, message: string) => void,
) {
  const verify = useServerFn(verifyHandover);
  const [queue, setQueue] = useState<QueuedScan[]>([]);
  const queueRef = useRef<QueuedScan[]>([]);
  const flushing = useRef(false);
  const callbacks = useRef({ onSent, onDropped });
  callbacks.current = { onSent, onDropped };

  const update = useCallback((next: QueuedScan[]) => {
    queueRef.current = next;
    setQueue(next);
    save(next);
  }, []);

  useEffect(() => {
    update(load());
  }, [update]);

  const flush = useCallback(async () => {
    if (flushing.current || !navigator.onLine) return;
    flushing.current = true;
    try {
      for (const scan of [...queueRef.current]) {
        try {
          const res = await verify({
            data: { orderId: scan.orderId, token: scan.token, code: scan.code },
          });
          update(removeScan(queueRef.current, scan.orderId));
          callbacks.current.onSent(scan.orderId, res.status);
        } catch (error) {
          if (isNetworkFailure(error, navigator.onLine)) {
            update(
              queueRef.current.map((q) =>
                q.orderId === scan.orderId ? { ...q, attempts: q.attempts + 1 } : q,
              ),
            );
            break;
          }
          update(removeScan(queueRef.current, scan.orderId));
          callbacks.current.onDropped(
            scan.orderId,
            error instanceof Error ? error.message : "The saved scan was not accepted.",
          );
        }
      }
    } finally {
      flushing.current = false;
    }
  }, [verify, update]);

  // Retry when the phone reconnects, and on a backing-off timer.
  const attempts = queue.reduce((max, q) => Math.max(max, q.attempts), 0);
  useEffect(() => {
    if (!queue.length) return;
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    const timer = window.setTimeout(() => void flush(), retryDelayMs(attempts));
    return () => {
      window.removeEventListener("online", onOnline);
      window.clearTimeout(timer);
    };
  }, [queue.length, attempts, flush]);

  const submit = useCallback(
    async (orderId: string, input: { token?: string; code?: string }): Promise<ScanResult> => {
      const queueIt = () => {
        update(enqueueScan(queueRef.current, { orderId, ...input, savedAt: Date.now() }));
        return { kind: "saved" as const };
      };
      if (!navigator.onLine) return queueIt();
      try {
        const res = await verify({ data: { orderId, ...input } });
        update(removeScan(queueRef.current, orderId));
        return { kind: "done", status: res.status, handover: res.kind };
      } catch (error) {
        if (isNetworkFailure(error, navigator.onLine)) return queueIt();
        throw error;
      }
    },
    [verify, update],
  );

  return { queue, submit, flush };
}
