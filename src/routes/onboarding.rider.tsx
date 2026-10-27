import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Phone, User, FileText, ThumbsUp, IdCard, Bike, Upload, Check } from "lucide-react";
import { Shell, Title, PrimaryBtn, Field, inputCls, PhoneStep, OtpStep, DoneStep, toE164 } from "@/components/onboarding";
import { saveRider } from "@/lib/rider.functions";
import beezMark from "@/assets/beez-mark.png.asset.json";

export const Route = createFileRoute("/onboarding/rider")({
  head: () => ({
    meta: [
      { title: "Rider sign up | Beez" },
      { name: "description", content: "Become a Beez rider: verify your phone, add details and documents, and start delivering." },
      { property: "og:title", content: "Ride and earn with Beez" },
      { property: "og:description", content: "Earn. Deliver. Grow with Beez." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RiderOnboarding,
});

const TOTAL = 6;
const overview = [
  { i: Phone, t: "Verify your phone number", d: "We'll send you a code to confirm your number." },
  { i: User, t: "Personal details", d: "Tell us a bit about yourself." },
  { i: FileText, t: "Delivery documents", d: "Upload your ID and bike details." },
  { i: ThumbsUp, t: "Start delivering", d: "Get approved and hit the road!" },
];

function UploadBox({ icon: I, t, d, file, setFile }: { icon: typeof IdCard; t: string; d: string; file: string | null; setFile: (v: string) => void }) {
  return (
    <div className="mb-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15"><I className="h-5 w-5 text-primary" /></span>
        <span><span className="block font-semibold">{t}</span><span className="text-xs text-muted-foreground">{d}</span></span>
      </div>
      <label className="mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-muted-foreground/50 py-6 text-sm text-muted-foreground hover:border-primary">
        {file ? <><Check className="h-5 w-5 text-success" /><span className="max-w-full truncate px-4">{file}</span></> : <><Upload className="h-5 w-5" />Tap to upload</>}
        <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setFile(f.name); }} />
      </label>
    </div>
  );
}

function RiderOnboarding() {
  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [idDoc, setIdDoc] = useState<string | null>(null);
  const [bike, setBike] = useState<string | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const next = () => setStep((s) => s + 1);
  const back = step > 0 && step < TOTAL - 1 ? () => setStep((s) => s - 1) : undefined;
  const finish = async () => {
    setSaving(true); setSaveErr('');
    try {
      await saveRider({ data: { full_name: name.trim(), phone: toE164(phone) } });
      await qc.invalidateQueries({ queryKey: ['my-workspace'] });
      navigate({ to: '/rider/dashboard' });
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Your details could not be saved. Please try again.');
      setSaving(false);
    }
  };

  return (
    <Shell onBack={back} step={step} total={TOTAL}>
      {step === 0 && (
        <>
          <div className="mb-8 text-center">
            <span className="mx-auto grid h-20 w-20 place-items-center rounded-full border-2 border-primary bg-foreground"><img src={beezMark.url} alt="Beez logo" className="h-14 w-14 object-contain" /></span>
            <h1 className="mt-5 text-3xl font-extrabold">Welcome, Rider!</h1>
            <p className="mt-2 text-muted-foreground">Let's get you set up in a few steps.</p>
          </div>
          {overview.map(({ i: I, t, d }, idx) => (
            <div key={t} className={`mb-3 flex items-center gap-4 rounded-2xl border p-4 ${idx === 0 ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${idx === 0 ? "bg-primary text-primary-foreground" : "bg-secondary"}`}><I className="h-5 w-5" /></span>
              <span><span className="block font-semibold">{t}</span><span className="text-sm text-muted-foreground">{d}</span></span>
            </div>
          ))}
          <div className="mt-6"><PrimaryBtn onClick={next}>Continue</PrimaryBtn></div>
        </>
      )}
      {step === 1 && (
        <PhoneStep
          title="Verify your phone number"
          desc="We'll send you a 6-digit code to this number."
          phone={phone}
          setPhone={setPhone}
          onNext={next}
          cta="Send Code"
          extra={
            <p className="mt-6 text-xs text-muted-foreground">
              By continuing, you agree to Beez's Terms and Privacy Policy.
            </p>
          }
        />
      )}
      {step === 2 && <OtpStep title="Enter the 6-digit code" phone={phone} onNext={next} />}
      {step === 3 && (
        <>
          <Title t="Personal details" d="Tell us a bit about yourself." />
          <Field label="Full name"><input className={inputCls} placeholder="James Mwangi" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Date of birth"><input type="date" className={inputCls} value={dob} onChange={(e) => setDob(e.target.value)} /></Field>
          <Field label="Gender">
            <select className={inputCls} value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="" disabled>Select gender</option>
              <option>Male</option><option>Female</option><option>Prefer not to say</option>
            </select>
          </Field>
          <div className="mt-4"><PrimaryBtn onClick={next} disabled={!name.trim() || !dob || !gender}>Continue</PrimaryBtn></div>
        </>
      )}
      {step === 4 && (
        <>
          <Title t="Delivery documents" d="Upload clear photos of your ID and bike details. This helps us verify you." />
          <UploadBox icon={IdCard} t="National ID" d="Front and back (clear photo)" file={idDoc} setFile={setIdDoc} />
          <UploadBox icon={Bike} t="Bike details" d="Registration, logbook or insurance" file={bike} setFile={setBike} />
          <div className="mt-4"><PrimaryBtn onClick={finish} disabled={!idDoc || !bike || saving}>{saving ? "Saving…" : "Continue"}</PrimaryBtn></div>
          {saveErr && <p className="mt-4 text-sm text-destructive">{saveErr}</p>}
        </>
      )}
      {step === 5 && <DoneStep title="You're all set!" desc="Your Beez rider account is ready. You'll get notified once you're approved." to="/rider/dashboard" />}
    </Shell>
  );
}
