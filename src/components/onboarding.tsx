import { useEffect, useRef, useState, type ClipboardEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { friendlyPhoneError, toE164 } from "@/lib/phone";
export { toE164 } from "@/lib/phone";
import { ArrowLeft, ArrowRight, ShieldCheck, Check } from "lucide-react";

export function Shell({ onBack, children, step, total }: { onBack?: (() => void) | undefined; children: ReactNode; step?: number; total?: number }) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-6">
        <div className="flex h-10 items-center justify-between">
          {onBack ? (
            <button onClick={onBack} aria-label="Back" className="rounded-full p-2 hover:bg-secondary"><ArrowLeft className="h-5 w-5" /></button>
          ) : (
            <Link to="/get-started" aria-label="Back" className="rounded-full p-2 hover:bg-secondary"><ArrowLeft className="h-5 w-5" /></Link>
          )}
          {total ? (
            <div className="flex gap-1.5">
              {Array.from({ length: total }).map((_, i) => (
                <span key={i} className={`h-1.5 w-6 rounded-full ${i <= (step ?? 0) ? "bg-primary" : "bg-secondary"}`} />
              ))}
            </div>
          ) : null}
          <span className="w-9" />
        </div>
        <div className="mt-6 flex flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}

export function Title({ t, d }: { t: string; d?: ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-extrabold">{t}</h1>
      {d && <p className="mt-2 text-muted-foreground">{d}</p>}
    </div>
  );
}

export function PrimaryBtn({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-4 font-bold text-primary-foreground transition hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100">
      {children} <ArrowRight className="h-4 w-4" />
    </button>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-5 block">
      <span className="mb-2 block text-sm text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export const inputCls = "w-full rounded-xl border border-input bg-card px-4 py-3.5 outline-none focus:border-primary";


export function PhoneStep({
  title,
  desc,
  phone,
  setPhone,
  onNext,
  cta = "Continue",
  extra,
  shouldCreateUser = true,
}: {
  title: string;
  desc: string;
  phone: string;
  setPhone: (v: string) => void;
  onNext: () => void;
  cta?: string;
  extra?: ReactNode;
  shouldCreateUser?: boolean;
}) {
  const valid = phone.replace(/\D/g, "").length >= 9;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const send = async () => {
    if (!valid) {
      setErr("Enter a valid Kenyan phone number, for example 0712 345 678.");
      return;
    }
    setBusy(true); setErr("");
    try {
      const normalizedPhone = toE164(phone);
      const { error } = await supabase.auth.signInWithOtp({
        phone: normalizedPhone,
        ...(!shouldCreateUser && { options: { shouldCreateUser: false } }),
      });
      if (error) setErr(friendlyPhoneError(error.message)); else onNext();
    } catch (error) {
      setErr(friendlyPhoneError(error instanceof Error ? error.message : "We couldn't text your code right now. Please try again."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Title t={title} d={desc} />
      <div className="flex rounded-xl border border-input bg-card">
        <span className="flex items-center gap-2 border-r border-input px-4 text-sm">🇰🇪 +254</span>
        <input inputMode="tel" placeholder="712 345 678" value={phone} onChange={(e) => setPhone(e.target.value)}
          className="flex-1 bg-transparent px-4 py-3.5 outline-none" />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">This number will be used for payments, orders and account recovery.</p>
      {err && <p role="alert" className="mt-4 text-sm text-destructive">{err}</p>}
      <div className="mt-8"><PrimaryBtn onClick={send} disabled={busy}>{busy ? "Sending…" : cta}</PrimaryBtn></div>
      {extra}
      <p className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" /> Your information is safe with Beez.</p>
    </>
  );
}

export function OtpStep({
  title,
  phone,
  onNext,
  cta = "Verify",
  shouldCreateUser = true,
}: {
  title: string;
  phone: string;
  onNext: () => void;
  cta?: string;
  shouldCreateUser?: boolean;
}) {
  const [code, setCode] = useState<string[]>(Array(6).fill(""));
  const [secs, setSecs] = useState(45);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [err, setErr] = useState("");
  const verify = async () => {
    setBusy(true); setErr("");
    try {
      const { error } = await supabase.auth.verifyOtp({ phone: toE164(phone), token: code.join(""), type: "sms" });
      if (error) setErr(friendlyPhoneError(error.message)); else onNext();
    } catch (error) {
      setErr(friendlyPhoneError(error instanceof Error ? error.message : "We couldn't verify that code. Please try again."));
    } finally {
      setBusy(false);
    }
  };
  const resend = async () => {
    setResending(true); setErr("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: toE164(phone),
        ...(!shouldCreateUser && { options: { shouldCreateUser: false } }),
      });
      if (error) setErr(friendlyPhoneError(error.message));
      else {
        setCode(Array(6).fill(""));
        setSecs(45);
      }
    } catch (error) {
      setErr(friendlyPhoneError(error instanceof Error ? error.message : "We couldn't text your code right now. Please try again."));
    } finally {
      setResending(false);
    }
  };
  useEffect(() => {
    if (secs <= 0) return;
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs]);
  const updateCode = (start: number, value: string) => {
    const digits = value.replace(/\D/g, "");
    const next = [...code];
    if (digits.length > 1) next.fill("", start);
    for (const [offset, digit] of [...digits].entries()) {
      if (start + offset >= next.length) break;
      next[start + offset] = digit;
    }
    setCode(next);
    if (digits && start + digits.length < next.length) refs.current[start + digits.length]?.focus();
  };
  const pasteCode = (start: number, event: ClipboardEvent<HTMLInputElement>) => {
    const digits = event.clipboardData.getData("text").replace(/\D/g, "");
    if (!digits) return;
    event.preventDefault();
    updateCode(start, digits);
  };
  return (
    <>
      <Title t={title} d={<>We've sent a 6-digit code to<br />{toE164(phone)}</>} />
      <div className="flex justify-between gap-2">
        {code.map((c, i) => (
          <input key={i} ref={(el) => { refs.current[i] = el; }} value={c} inputMode="numeric"
            aria-label={`Digit ${i + 1} of 6`}
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={i === 0 ? 6 : 1}
            onChange={(e) => updateCode(i, e.target.value)}
            onPaste={(e) => pasteCode(i, e)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !c && i > 0) refs.current[i - 1]?.focus();
              if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
              if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
            }}
            className="h-14 w-12 rounded-xl border border-input bg-card text-center text-xl font-bold outline-none focus:border-primary" />
        ))}
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Didn't receive the code?{" "}
        {secs > 0 ? <span className="text-primary">Resend in 00:{String(secs).padStart(2, "0")}</span>
          : <button onClick={resend} disabled={resending || busy} className="font-semibold text-primary disabled:opacity-50">{resending ? "Sending…" : "Resend"}</button>}
      </p>
      {err && <p role="alert" className="mt-4 text-center text-sm text-destructive">{err}</p>}
      <div className="mt-8"><PrimaryBtn onClick={verify} disabled={code.join("").length < 6 || busy || resending}>{busy ? "Verifying…" : cta}</PrimaryBtn></div>
    </>
  );
}

export function DoneStep({ title, desc, to, children }: { title: string; desc: string; to: "/merchant/dashboard" | "/rider/dashboard"; children?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      {children ?? (
        <span className="grid h-24 w-24 place-items-center rounded-full border-4 border-primary">
          <Check className="h-12 w-12 text-primary" strokeWidth={3} />
        </span>
      )}
      <h1 className="mt-8 text-3xl font-extrabold">{title}</h1>
      <p className="mt-3 text-muted-foreground">{desc}</p>
      <Link to={to} className="mt-10 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-4 font-bold text-primary-foreground">
        Go to Dashboard <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

export function OptionCard({ active, onClick, icon, t, d }: { active: boolean; onClick: () => void; icon?: ReactNode; t: string; d: string }) {
  return (
    <button onClick={onClick}
      className={`mb-3 flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition ${active ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50"}`}>
      {icon ?? (
        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${active ? "border-primary bg-primary" : "border-muted-foreground"}`}>
          {active && <Check className="h-4 w-4 text-primary-foreground" strokeWidth={3} />}
        </span>
      )}
      <span><span className="block font-semibold">{t}</span><span className="text-sm text-muted-foreground">{d}</span></span>
    </button>
  );
}
