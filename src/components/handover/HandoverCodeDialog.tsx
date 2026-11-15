// Shows the shop's pickup QR or the customer's delivery QR, plus its 4-digit
// backup code. A fresh code is only issued when this opens or the holder asks,
// so a code locked after 5 wrong tries never quietly renews itself.
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { Check, Loader2, QrCode, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getHandoverCode } from "@/lib/handover.functions";
import { canShowHandover, type HandoverKind } from "@/lib/handover";

type Props = {
  orderId: string;
  kind: HandoverKind;
  status: string;
  arrivedAt?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type CodeState =
  | { kind: "loading" }
  | { kind: "ready"; token: string; code: string }
  | { kind: "waiting" }
  | { kind: "error"; message: string };

export function HandoverCodeDialog({
  orderId,
  kind,
  status,
  arrivedAt,
  open,
  onOpenChange,
}: Props) {
  const fetchCode = useServerFn(getHandoverCode);
  const [state, setState] = useState<CodeState>({ kind: "loading" });
  const done =
    kind === "pickup"
      ? ["In Transit", "Out for Delivery", "Delivered"].includes(status)
      : status === "Delivered";
  const showable = canShowHandover(kind, status, arrivedAt);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetchCode({ data: { orderId, kind } });
      setState(
        res.ready ? { kind: "ready", token: res.token, code: res.code } : { kind: "waiting" },
      );
    } catch (error) {
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "The code could not be loaded.",
      });
    }
  }, [fetchCode, orderId, kind]);

  useEffect(() => {
    if (open && showable) void load();
  }, [open, showable, load]);

  const title = kind === "pickup" ? "Pickup QR code" : "Your delivery QR code";
  const description =
    kind === "pickup"
      ? "Show this to the rider when you hand over the order. Only the assigned rider can use it, once."
      : "Show this to the rider when your order arrives. It confirms you received it.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="handover-done" role="status">
            <span>
              <Check className="h-8 w-8" />
            </span>
            <p className="font-semibold text-foreground">
              {kind === "pickup"
                ? "Picked up — the rider is on the way."
                : "Delivered. Enjoy your order!"}
            </p>
          </div>
        ) : !showable || state.kind === "waiting" ? (
          <p className="py-6 text-center text-sm text-muted-foreground" role="status">
            {kind === "pickup"
              ? "The code appears once a rider has taken this job."
              : "The code appears once the rider marks their arrival."}
          </p>
        ) : state.kind === "loading" ? (
          <p
            className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"
            role="status"
          >
            <Loader2 className="h-4 w-4 animate-spin" /> Getting your code…
          </p>
        ) : state.kind === "error" ? (
          <div className="space-y-3 py-4 text-center" role="alert">
            <p className="text-sm text-destructive">{state.message}</p>
            <Button variant="outline" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="handover-qr" aria-label={`QR code for order ${orderId}`}>
              <QRCodeSVG
                value={state.token}
                size={240}
                level="M"
                marginSize={2}
                bgColor="transparent"
                fgColor="currentColor"
              />
            </div>
            <div>
              <p className="mb-2 text-center text-xs text-muted-foreground">
                Camera not working? Read the rider this code:
              </p>
              <div
                className="handover-code"
                aria-label={`Backup code ${state.code.split("").join(" ")}`}
              >
                {state.code.split("").map((d, i) => (
                  <span key={i}>{d}</span>
                ))}
              </div>
            </div>
            <Button variant="ghost" className="w-full" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" /> Rider says it's locked? Get a new code
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Button that opens the QR pop-up. */
export function HandoverCodeButton({
  orderId,
  kind,
  status,
  arrivedAt,
  className,
  label,
}: {
  orderId: string;
  kind: HandoverKind;
  status: string;
  arrivedAt?: string | null;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <QrCode className="h-4 w-4" aria-hidden />{" "}
        {label ?? (kind === "pickup" ? "Pickup QR" : "Show delivery QR")}
      </button>
      <HandoverCodeDialog
        orderId={orderId}
        kind={kind}
        status={status}
        arrivedAt={arrivedAt}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
