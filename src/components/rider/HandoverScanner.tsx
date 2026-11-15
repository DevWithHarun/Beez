// Rider's scanner for the shop's pickup QR and the customer's delivery QR, with a
// type-the-4-digit-code backup. The server checks every code; when there's no
// signal the scan is saved and sent later.
import { useEffect, useId, useRef, useState } from "react";
import { Camera, Check, CloudOff, Keyboard, Loader2, X } from "lucide-react";
import { parseHandoverToken, type HandoverKind } from "@/lib/handover";
import type { ScanResult } from "@/lib/use-handover-queue";

type Props = {
  orderId: string;
  kind: HandoverKind;
  onClose: () => void;
  onSubmit: (input: { token?: string; code?: string }) => Promise<ScanResult>;
  onDone: (result: ScanResult) => void;
};

type CamState = "starting" | "on" | "blocked" | "off";

export function HandoverScanner({ orderId, kind, onClose, onSubmit, onDone }: Props) {
  const regionId = `beez-scan-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [mode, setMode] = useState<"camera" | "code">("camera");
  const [cam, setCam] = useState<CamState>("starting");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const busyRef = useRef(false);
  const who = kind === "pickup" ? "shop" : "customer";

  const send = async (input: { token?: string; code?: string }) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const res = await onSubmit(input);
      setResult(res);
      if (navigator.vibrate) navigator.vibrate(res.kind === "done" ? [80, 40, 80] : 200);
      window.setTimeout(() => onDone(res), res.kind === "done" ? 1200 : 2200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That code didn't work. Please try again.");
      if (navigator.vibrate) navigator.vibrate(300);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const sendRef = useRef(send);
  sendRef.current = send;

  useEffect(() => {
    if (mode !== "camera" || result) return;
    let stopped = false;
    let scanner: { isScanning: boolean; stop: () => Promise<void>; clear: () => void } | null =
      null;
    setCam("starting");
    (async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (stopped) return;
        const s = new Html5Qrcode(regionId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
        scanner = s;
        let last = "";
        await s.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (w: number, h: number) => {
              const side = Math.floor(Math.min(w, h) * 0.72);
              return { width: side, height: side };
            },
          },
          (text: string) => {
            if (text === last || busyRef.current) return;
            last = text;
            window.setTimeout(() => {
              if (last === text) last = "";
            }, 2500);
            const parsed = parseHandoverToken(text);
            if (!parsed) return setError("That isn't a Beez handover code.");
            if (parsed.orderId !== orderId)
              return setError(`That QR is for order ${parsed.orderId}, not ${orderId}.`);
            if (parsed.kind !== kind)
              return setError(
                kind === "pickup"
                  ? "That's the customer's delivery code. Scan the shop's pickup code."
                  : "That's the shop's pickup code. Scan the customer's delivery code.",
              );
            void sendRef.current({ token: text });
          },
          () => undefined,
        );
        if (stopped) await s.stop().catch(() => undefined);
        else setCam("on");
      } catch {
        if (!stopped) {
          setCam("blocked");
          setMode("code");
        }
      }
    })();
    return () => {
      stopped = true;
      const s = scanner;
      if (s) {
        (s.isScanning ? s.stop() : Promise.resolve())
          .catch(() => undefined)
          .finally(() => {
            try {
              s.clear();
            } catch {
              /* already cleared */
            }
          });
      }
    };
  }, [mode, result, regionId, orderId, kind]);

  return (
    <div
      className="scan-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Scan the ${who}'s QR code`}
    >
      <div className="scan-sheet">
        <div className="scan-head">
          <div>
            <small>Order {orderId}</small>
            <b>
              {kind === "pickup" ? "Scan the shop's pickup QR" : "Scan the customer's delivery QR"}
            </b>
          </div>
          <button className="scan-close" aria-label="Close scanner" onClick={onClose}>
            <X />
          </button>
        </div>

        {result ? (
          <div className="scan-result" role="status">
            {result.kind === "done" ? (
              <>
                <span className="ok">
                  <Check />
                </span>
                <b>{kind === "pickup" ? "Pickup confirmed" : "Delivered!"}</b>
                <p>
                  {kind === "pickup"
                    ? "Head to the customer."
                    : "Great job. Your earning is in Wallet."}
                </p>
              </>
            ) : (
              <>
                <span className="saved">
                  <CloudOff />
                </span>
                <b>Saved on your phone</b>
                <p>No signal right now. Beez will send it as soon as you're back online.</p>
              </>
            )}
          </div>
        ) : mode === "camera" ? (
          <>
            <div className="scan-camera">
              <div id={regionId} />
              {cam === "starting" && (
                <p className="scan-camnote">
                  <Loader2 className="spin" /> Starting camera…
                </p>
              )}
            </div>
            <p className="scan-hint">Point your camera at the {who}'s QR code.</p>
          </>
        ) : (
          <form
            className="scan-code"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.length === 4) void send({ code });
            }}
          >
            {cam === "blocked" && (
              <p className="scan-warn">
                Camera unavailable. Ask the {who} to read you their 4-digit code.
              </p>
            )}
            <label>
              4-digit code from the {who}
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{4}"
                maxLength={4}
                value={code}
                autoFocus
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                aria-describedby="scan-error"
              />
            </label>
            <button className="yellow" type="submit" disabled={busy || code.length !== 4}>
              {busy ? <Loader2 className="spin" /> : <Check size={16} />} Confirm code
            </button>
          </form>
        )}

        {error && !result && (
          <p id="scan-error" className="scan-error" role="alert">
            {error}
          </p>
        )}
        {busy && mode === "camera" && (
          <p className="scan-hint" role="status">
            <Loader2 className="spin" /> Checking…
          </p>
        )}

        {!result && (
          <button
            className="scan-switch"
            onClick={() => {
              setError("");
              setMode(mode === "camera" ? "code" : "camera");
            }}
          >
            {mode === "camera" ? (
              <>
                <Keyboard size={16} /> Type the 4-digit code instead
              </>
            ) : (
              <>
                <Camera size={16} /> Use the camera
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
