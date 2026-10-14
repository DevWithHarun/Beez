import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Bike, ShoppingBag, Store } from "lucide-react";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import {
  getSession,
  logoutSession,
  parseSession,
  refreshSession,
  saveSession,
  subscribeToSession,
} from "@/shared/auth/session";

export const Route = createFileRoute("/app")({
  head: () => ({
    meta: [
      { title: "Get started with Beez" },
      {
        name: "description",
        content: "Get started with Beez as a merchant, rider or customer.",
      },
    ],
  }),
  component: LaunchApp,
});

type Role = "merchant" | "rider" | "customer";
type Step = "welcome" | "choose" | "phone" | "code" | "onboarding" | "guest";
type EntryMode = "start" | "login";

const roleDetails = {
  merchant: {
    label: "Merchant",
    description: "Manage your shop, products and orders.",
    icon: Store,
  },
  rider: {
    label: "Rider",
    description: "Deliver orders and manage your earnings.",
    icon: Bike,
  },
  customer: {
    label: "Customer",
    description: "Discover nearby shops and place an order.",
    icon: ShoppingBag,
  },
} satisfies Record<Role, { label: string; description: string; icon: typeof Store }>;

function LaunchApp() {
  const navigate = useNavigate();
  const session = useSyncExternalStore(subscribeToSession, getSession, getSession);
  const [role, setRole] = useState<Role | null>(null);
  const [step, setStep] = useState<Step>("welcome");
  const [entryMode, setEntryMode] = useState<EntryMode>("start");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [fullName, setFullName] = useState("");
  const [shopName, setShopName] = useState("");
  const [area, setArea] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [retryAfter, setRetryAfter] = useState(0);

  useEffect(() => {
    if (retryAfter <= 0) return;
    const timer = window.setInterval(() => {
      setRetryAfter((remaining) => Math.max(0, remaining - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryAfter]);

  useEffect(() => {
    void refreshSession().catch(() => {
      setNotice("We couldn't check your saved sign-in. Please try again.");
    });
  }, []);

  useEffect(() => {
    if (!session) return;
    setRole(session.user.role.toLowerCase() as Role);
    setFullName(session.user.displayName ?? "");
    setShopName(session.user.shopName ?? "");
    setArea(session.user.area ?? "");
    if (session.user.onboardingRequired) {
      setStep("onboarding");
    } else {
      void navigate({ to: session.user.role === "MERCHANT" ? "/merchant" : "/rider" });
    }
  }, [session, navigate]);

  const chooseRole = (selected: Role) => {
    setRole(selected);
    setNotice("");
    setStep(selected === "customer" ? "guest" : "phone");
  };

  const begin = (mode: EntryMode) => {
    setEntryMode(mode);
    setRole(null);
    setNotice("");
    setStep(mode === "login" ? "phone" : "choose");
  };

  const backToWelcome = () => {
    setNotice("");
    setStep("welcome");
  };

  const backToRoles = () => {
    setNotice("");
    setStep("choose");
  };

  const backFromAuthStep = () => {
    setNotice("");
    if (step === "code" && entryMode === "login") {
      setStep("phone");
    } else if (entryMode === "start") {
      setStep("choose");
    } else {
      setStep("welcome");
    }
  };

  const requestCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendCode();
  };

  const sendCode = async () => {
    setNotice("");
    if (entryMode === "start" && (!role || role === "customer")) return;
    const normalizedPhone = normalizeKenyanPhone(phone);
    if (!normalizedPhone) {
      setNotice("Enter a valid Kenyan mobile number, such as 0712 345 678.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(
        entryMode === "login" ? "/api/v1/auth/otp/login/request" : "/api/v1/auth/otp/request",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Beez-Client": "pwa" },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify({
            phone: normalizedPhone,
            ...(entryMode === "start" && role ? { role: role.toUpperCase() } : {}),
          }),
        },
      );
      const payload: unknown = await response.json().catch(() => null);
      if (!payload) {
        throw new Error("Sign-in service isn't available yet. No code was confirmed as sent.");
      }
      if (!response.ok) {
        throw new Error(apiMessage(payload) ?? "We couldn't send a code. Please try again.");
      }

      const requestedChallengeId = objectString(payload, "challengeId");
      if (!requestedChallengeId) {
        throw new Error("Sign-in returned an unexpected response. Please try again later.");
      }
      setChallengeId(requestedChallengeId);
      setPhone(normalizedPhone);
      setCode("");
      setStep("code");
      setNotice("If this number can sign in, a code will be sent shortly.");
      setRetryAfter(numericField(payload, "retryAfterSeconds") ?? 60);
    } catch (error) {
      setNotice(
        error instanceof TypeError
          ? "We couldn't reach sign-in. No code was confirmed as sent; please try again later."
          : error instanceof Error
            ? error.message
            : "We couldn't send a code. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const resendCode = () => {
    if (retryAfter > 0 || busy) return;
    void sendCode();
  };

  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice("");
    if (code.length !== 6) {
      setNotice("Enter the six-digit code.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/v1/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Beez-Client": "pwa" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          challengeId,
          code,
          ...(entryMode === "start" && role ? { role: role.toUpperCase() } : {}),
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!payload) {
        throw new Error("Code verification isn't connected yet. No account was signed in.");
      }
      if (!response.ok) {
        throw new Error(apiMessage(payload) ?? "That code could not be verified.");
      }

      const verifiedSession = parseSession(payload);
      saveSession(verifiedSession);
      if (verifiedSession.user.onboardingRequired) {
        setStep("onboarding");
        setNotice("Your phone is verified. Finish setting up your account.");
      } else {
        void navigate({
          to: verifiedSession.user.role === "MERCHANT" ? "/merchant" : "/rider",
        });
      }
    } catch (error) {
      setNotice(
        error instanceof TypeError
          ? "We couldn't reach sign-in. No account was signed in; please try again later."
          : error instanceof Error
            ? error.message
            : "That code could not be verified.",
      );
    } finally {
      setBusy(false);
    }
  };

  const submitOnboarding = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = fullName.trim();
    if (!trimmedName) {
      setNotice("Please enter your name to continue.");
      return;
    }

    const token = getSession()?.accessToken;
    if (!token) {
      setNotice("Your sign-in session expired. Please sign in again.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/v1/auth/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Beez-Client": "pwa",
        },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          displayName: trimmedName,
          ...(role === "merchant" ? { shopName: shopName.trim() } : {}),
          area: area.trim(),
          language: "en",
        }),
      });

      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(apiMessage(payload) ?? "We couldn't save your profile information.");
      }

      const current = getSession();
      const user = parseUser(payload);
      if (current) {
        saveSession({
          ...current,
          user: {
            ...current.user,
            displayName: user.displayName,
            shopName: user.shopName,
            area: user.area,
            language: user.language,
            onboardingRequired: user.onboardingRequired,
            onboardingStatus: user.onboardingStatus,
          },
        });
      }

      setNotice("");
    } catch (error) {
      setNotice(
        error instanceof TypeError
          ? "We couldn't reach the profile service. Please try again later."
          : error instanceof Error
            ? error.message
            : "We couldn't save your profile information.",
      );
    } finally {
      setBusy(false);
    }
  };

  const title =
    step === "welcome"
      ? "Welcome to Beez"
      : step === "choose"
        ? "Get started"
        : step === "phone"
          ? entryMode === "login"
            ? "Log in"
            : "Get started"
          : step === "code"
            ? "Enter your code"
            : step === "onboarding"
              ? "Set up your account"
              : "Explore Beez as a customer";

  return (
    <main className="launch-page" data-step={step}>
      <div className="launch-scene">
        <div className="launch-hero" aria-label="Beez brand presentation">
          <img className="launch-world-map" src="/global-map.png" alt="" aria-hidden="true" />
          <svg className="launch-chart" viewBox="0 0 360 170" aria-hidden="true">
            <path d="M0 142 36 128 64 132 93 86 122 112 153 68 184 99 216 45 249 78 284 35 320 52 360 16" />
            <path d="M0 153 41 139 73 148 108 112 142 123 178 96 211 118 246 72 284 96 321 66 360 76" />
            <path d="M0 162 42 154 75 136 108 145 144 105 179 119 214 88 250 109 287 70 322 88 360 50" />
          </svg>
          <div className="launch-plate">
            <img
              src="/beez-onboarding-logo.png"
              alt="Beez. Smart tools. Real growth."
              className="launch-hero-logo"
              width={384}
              height={449}
            />
          </div>
        </div>

        <section className="launch-panel-wrap" aria-labelledby="launch-title">
          <div className="launch-card-panel">
            {step === "choose" ? (
              <button className="launch-back" type="button" onClick={backToWelcome}>
                <ArrowLeft size={17} aria-hidden="true" />
                Back
              </button>
            ) : step === "phone" || step === "code" || step === "guest" ? (
              <button
                className="launch-back"
                type="button"
                onClick={entryMode === "login" ? backFromAuthStep : backToRoles}
              >
                <ArrowLeft size={17} aria-hidden="true" />
                {step === "guest"
                  ? "Change account type"
                  : entryMode === "login"
                    ? step === "code"
                      ? "Use a different number"
                      : "Back"
                    : "Change account type"}
              </button>
            ) : null}

            <div className="launch-heading">
              <span className="launch-kicker">YOUR BEEZ ACCOUNT</span>
              <h1 id="launch-title">{title}</h1>
              <p>
                {step === "welcome"
                  ? "Tools for local shops, riders and customers, all in one place."
                  : step === "choose"
                    ? entryMode === "login"
                      ? "Choose the account you want to access."
                      : "Choose how you want to use Beez. Customers can continue without an account."
                    : step === "phone"
                      ? entryMode === "login"
                        ? "Enter the phone number linked to your Beez account. We'll send you a one-time sign-in code."
                        : `Enter your phone number to create or access your ${role} account. We'll send a one-time code.`
                      : step === "code"
                        ? `Enter the six-digit code sent to ${phone}.`
                        : step === "onboarding"
                          ? "A few details help us set up your Beez workspace."
                          : "Customer shopping is designed to work without signing in."}
              </p>
            </div>

            {step === "welcome" && (
              <div className="launch-welcome-actions">
                <button className="launch-primary" type="button" onClick={() => begin("start")}>
                  Get started <ArrowRight size={18} aria-hidden="true" />
                </button>
                <button className="launch-secondary" type="button" onClick={() => begin("login")}>
                  Log in
                </button>
              </div>
            )}

            {step === "choose" && (
              <div className="launch-role-list">
                {(["merchant", "rider", "customer"] as const).map((item) => {
                  const { label, description, icon: Icon } = roleDetails[item];
                  return (
                    <button
                      className="launch-role"
                      key={item}
                      type="button"
                      onClick={() => chooseRole(item)}
                    >
                      <span className="launch-role-icon">
                        <Icon size={22} aria-hidden="true" />
                      </span>
                      <span className="launch-role-copy">
                        <strong>{label}</strong>
                        <small>{description}</small>
                      </span>
                      <ArrowRight className="launch-role-arrow" size={19} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            )}

            {session && (
              <div className="launch-session-state">
                <p role="status">
                  Signed in as {session.user.phone} ·{" "}
                  {session.user.role === "MERCHANT" ? "Merchant" : "Rider"}
                </p>
                <button
                  className="launch-text-button"
                  type="button"
                  onClick={() => {
                    void logoutSession()
                      .then(() => {
                        setRole(null);
                        setStep("welcome");
                        setNotice("");
                      })
                      .catch((error: unknown) => {
                        setNotice(
                          error instanceof Error
                            ? error.message
                            : "We couldn't sign you out. Please try again.",
                        );
                      });
                  }}
                >
                  Sign out
                </button>
              </div>
            )}

            {step === "phone" && (
              <>
                <form className="launch-form" onSubmit={requestCode}>
                  <label htmlFor="launch-phone">Mobile number</label>
                  <div className="launch-phone-field">
                    <span aria-label="Kenya country code">+254</span>
                    <input
                      autoComplete="tel-national"
                      id="launch-phone"
                      inputMode="tel"
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="712 345 678"
                      required
                      value={phone.replace(/^\+254/, "")}
                    />
                  </div>
                  <p className="launch-field-note">
                    We’ll use this number for a one-time sign-in code.
                  </p>
                  <button className="launch-primary" disabled={busy} type="submit">
                    {busy ? "Sending code…" : "Continue with SMS"}
                    {!busy && <ArrowRight size={18} aria-hidden="true" />}
                  </button>
                </form>
              </>
            )}

            {step === "code" && (
              <form className="launch-form" onSubmit={verifyCode}>
                <label htmlFor="launch-code">Six-digit code</label>
                <input
                  autoComplete="one-time-code"
                  className="launch-code-input"
                  id="launch-code"
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  pattern="[0-9]{6}"
                  placeholder="••••••"
                  required
                  value={code}
                />
                <button className="launch-primary" disabled={busy} type="submit">
                  {busy ? "Verifying…" : "Verify code"}
                  {!busy && <ArrowRight size={18} aria-hidden="true" />}
                </button>
                <button
                  className="launch-text-button"
                  type="button"
                  onClick={() => setStep("phone")}
                >
                  Use a different number
                </button>
                <button
                  className="launch-text-button"
                  disabled={retryAfter > 0 || busy}
                  type="button"
                  onClick={resendCode}
                >
                  {retryAfter > 0 ? `Resend code in ${retryAfter}s` : "Resend code"}
                </button>
              </form>
            )}

            {step === "onboarding" && (
              <form className="launch-form" onSubmit={submitOnboarding}>
                <label htmlFor="launch-name">Your name</label>
                <input
                  autoComplete="name"
                  id="launch-name"
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Full name"
                  required
                  value={fullName}
                />
                {role === "merchant" ? (
                  <>
                    <label htmlFor="launch-shop">Shop name</label>
                    <input
                      autoComplete="organization"
                      id="launch-shop"
                      onChange={(event) => setShopName(event.target.value)}
                      placeholder="Name customers will see"
                      required
                      value={shopName}
                    />
                    <label htmlFor="launch-area">Your market or area</label>
                    <input
                      id="launch-area"
                      onChange={(event) => setArea(event.target.value)}
                      placeholder="e.g. Kongowea"
                      required
                      value={area}
                    />
                  </>
                ) : (
                  <>
                    <label htmlFor="launch-area">Your delivery area</label>
                    <input
                      id="launch-area"
                      onChange={(event) => setArea(event.target.value)}
                      placeholder="Town or neighbourhood"
                      required
                      value={area}
                    />
                    <p className="launch-field-note">
                      Rider verification and approval happen before delivery jobs are available.
                    </p>
                  </>
                )}
                <button className="launch-primary" disabled={busy} type="submit">
                  {busy ? "Saving…" : "Create account"}
                  {!busy && <ArrowRight size={18} aria-hidden="true" />}
                </button>
              </form>
            )}

            {step === "guest" && (
              <div className="launch-guest">
                <span className="launch-guest-icon">
                  <ShoppingBag size={24} aria-hidden="true" />
                </span>
                <p>
                  Browse local shops and products without signing in. You can explore as a guest.
                </p>
                <Link className="launch-primary" to="/discover">
                  Discover shops <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </div>
            )}

            {notice && (
              <div className="launch-notice" role="status">
                {notice}
              </div>
            )}

            <p className="launch-legal">
              Sign in securely with a one-time code sent to your phone. Never share your code.
            </p>
          </div>
          <p className="launch-footer">Built for everyday business in Kenya.</p>
        </section>
      </div>
    </main>
  );
}

function normalizeKenyanPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const national = digits.startsWith("254")
    ? digits.slice(3)
    : digits.startsWith("0")
      ? digits.slice(1)
      : digits;

  return /^[17]\d{8}$/.test(national) ? `+254${national}` : null;
}

function apiMessage(payload: unknown) {
  if (typeof payload !== "object" || payload === null || !("message" in payload)) return null;
  return typeof payload.message === "string" ? payload.message : null;
}

function objectString(payload: unknown, key: string) {
  if (!isRecord(payload)) return null;
  return typeof payload[key] === "string" ? payload[key] : null;
}

function parseUser(payload: unknown) {
  if (!isRecord(payload)) {
    throw new Error("Profile service returned an unexpected response.");
  }

  const user = payload;
  if (
    typeof user["id"] !== "string" ||
    (user["role"] !== "MERCHANT" && user["role"] !== "RIDER") ||
    typeof user["status"] !== "string" ||
    typeof user["onboardingStatus"] !== "string" ||
    typeof user["onboardingRequired"] !== "boolean" ||
    (typeof user["displayName"] !== "string" && user["displayName"] !== null) ||
    (typeof user["shopName"] !== "string" && user["shopName"] !== null) ||
    (typeof user["area"] !== "string" && user["area"] !== null) ||
    typeof user["phone"] !== "string" ||
    typeof user["language"] !== "string"
  ) {
    throw new Error("Profile service returned incomplete account information.");
  }

  return {
    id: user["id"],
    role: user["role"],
    status: user["status"],
    onboardingStatus: user["onboardingStatus"],
    onboardingRequired: user["onboardingRequired"],
    displayName: user["displayName"],
    shopName: user["shopName"],
    area: user["area"],
    phone: user["phone"],
    language: user["language"],
  };
}

function numericField(payload: unknown, key: string) {
  if (!isRecord(payload)) return null;
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
