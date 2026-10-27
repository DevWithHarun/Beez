import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { Shell, PhoneStep, OtpStep } from "@/components/onboarding";
import { supabase } from "@/integrations/supabase/client";
import { resolveLoginDestination } from "@/lib/identity.functions";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in | Beez" },
      { name: "description", content: "Sign in to Beez with your phone number and go straight to your dashboard." },
      { property: "og:title", content: "Sign in to Beez" },
      { property: "og:description", content: "Enter your phone number, verify the code, and land on your dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const enter = useCallback(async () => {
    setBusy(true); setErr('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setStep('phone'); return; }
      const destination = await resolveLoginDestination();
      await queryClient.invalidateQueries({ queryKey: ['my-workspace'] });
      await navigate({ to: destination });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Signing in failed. Please try again.');
      setStep('phone');
    } finally {
      setBusy(false);
    }
  }, [navigate, queryClient]);

  useEffect(() => { void enter(); }, [enter]);

  return (
    <Shell>
      {step === 'phone' ? (
        <PhoneStep
          title="Sign in with your phone"
          desc="Enter the number you registered with Beez and we'll text you a code."
          phone={phone}
          setPhone={setPhone}
          onNext={() => setStep("otp")}
          cta="Send Code"
          shouldCreateUser={false}
        />
      ) : (
        <OtpStep
          title="Enter the 6-digit code"
          phone={phone}
          onNext={enter}
          cta="Verify & Continue"
          shouldCreateUser={false}
        />
      )}
      <p className="mt-8 text-center text-sm text-muted-foreground">
        New to Beez?{" "}
        <Link to="/get-started" className="font-semibold text-primary">Create an account</Link>
      </p>
      {busy && <p className="mt-6 text-center text-sm text-muted-foreground">Opening your dashboard…</p>}
    </Shell>
  );
}
