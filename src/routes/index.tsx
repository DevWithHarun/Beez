import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Mic, Clapperboard, Store, Truck, ArrowRight, Play,
  Globe, ChevronDown, Check, Leaf, MapPin, Motorbike,
} from "lucide-react";
import heroWoman from "@/assets/landing-hero-woman.jpg";
import reelsPhones from "@/assets/landing-reels-phones.png";
import { BrandLogo } from "@/components/site/BrandLogo";
import { SiteMenu } from "@/components/site/SiteMenu";
import { WhatsAppIcon, MpesaPhone } from "@/components/brand-icons";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Beez — Shop, sell and deliver smarter in Kenya" },
      { name: "description", content: "Discover products, watch reels, connect with local merchants, pay with M-Pesa and get deliveries at your doorstep — just talk to Beez." },
      { property: "og:title", content: "Welcome to Beez — Shop • Sell • Deliver" },
      { property: "og:description", content: "Voice shopping, product reels, merchant videos, M-Pesa payments and fast delivery in one app." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Lang = "en" | "sw";
const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "sw", label: "Kiswahili" },
];

const T = {
  en: {
    welcome: "Welcome to",
    tagA: "Shop • Sell • Deliver",
    tagB: "Smarter, Faster, Closer.",
    desc: "Order by voice in Swahili, English, French and more. Buy from market vendors near you, while merchants sell on WhatsApp and track sales, stock and profits with AI.",
    talk: "Talk to Beez",
    ctaGetStarted: "Get Started",
    ctaLogin: "Login",
    script: ["Voice. Videos.", "Payments.", "More!"],
    isNew: "New",
    features: [
      ["Voice First", "Speak, shop and get things done."],
      ["Reels", "Discover products with short videos."],
      ["Merchant Videos", "See real shops and products."],
      ["WhatsApp Integration", "Order, ask or get support on WhatsApp."],
      ["Mobile Money", "Pay easily with M-Pesa and more."],
      ["Fast Delivery", "Track your order in real time."],
    ],
    reelsTitle: "Watch. Shop. Enjoy.",
    reelsSub: "Explore amazing products in reels!",
    reelsCta: "Explore Reels",
    tabs: ["Discover", "Track", "Sell", "Delivery"],
  },
  sw: {
    welcome: "Karibu",
    tagA: "Nunua • Uza • Peleka",
    tagB: "Kwa akili, haraka, karibu nawe.",
    desc: "Agiza kwa sauti kwa Kiswahili, Kiingereza, Kifaransa na zaidi. Nunua kutoka kwa wauzaji wa karibu nawe, huku wafanyabiashara wakiuza kwenye WhatsApp na kufuatilia mauzo, bidhaa na faida kwa AI.",
    talk: "Ongea na Beez",
    ctaGetStarted: "Anza",
    ctaLogin: "Ingia",
    script: ["Sauti. Video.", "Malipo.", "Zaidi!"],
    isNew: "Mpya",
    features: [
      ["Sauti Kwanza", "Ongea, nunua na maliza mambo."],
      ["Video Fupi", "Gundua bidhaa kwa video fupi."],
      ["Video za Maduka", "Ona maduka na bidhaa halisi."],
      ["WhatsApp", "Agiza, uliza au pata msaada kwenye WhatsApp."],
      ["Pesa kwa Simu", "Lipa kwa urahisi kwa M-Pesa na zaidi."],
      ["Usafirishaji wa Haraka", "Fuatilia agizo lako moja kwa moja."],
    ],
    reelsTitle: "Tazama. Nunua. Furahia.",
    reelsSub: "Gundua bidhaa nzuri kwenye video fupi!",
    reelsCta: "Tazama Video",
    tabs: ["Gundua", "Fuatilia", "Uza", "Usafirishaji"],
  },
} as const;

const featureStyle = [
  { icon: Mic, tint: "bg-tint-amber", circle: "bg-primary text-foreground", to: "/discover", isNew: false },
  { icon: Clapperboard, tint: "bg-tint-violet", circle: "bg-icon-violet text-foreground", to: "/discover", isNew: true },
  { icon: Store, tint: "bg-tint-mint", circle: "bg-icon-green text-foreground", to: "/groceries", isNew: true },
  { icon: WhatsAppIcon, tint: "bg-tint-mint", circle: "bg-icon-whatsapp text-ink-foreground", href: "https://wa.me/", isNew: false },
  { icon: MpesaPhone, tint: "bg-tint-blue", circle: "", to: "/scan-pay", isNew: false },
  { icon: Truck, tint: "bg-tint-amber", circle: "bg-icon-orange text-foreground", to: "/track", isNew: false },
] as const;

function useLang() {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    const saved = localStorage.getItem("beez-lang");
    if (saved === "sw" || saved === "en") setLang(saved);
  }, []);
  const choose = (l: Lang) => { setLang(l); localStorage.setItem("beez-lang", l); };
  return [lang, choose] as const;
}

function LanguagePicker({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Language"
        className="flex items-center gap-1 rounded-full bg-card px-2 py-1.5 text-[13px] font-semibold shadow-panel sm:gap-1.5 sm:px-4 sm:py-2 sm:text-sm"
      >
        <Globe className="h-4 w-4" /> <span className="hidden sm:inline">{LANGS.find((l) => l.code === lang)?.label}</span> <ChevronDown className="hidden h-3.5 w-3.5 sm:block" />
      </button>
      {open && (
        <ul role="listbox" className="absolute right-0 z-20 mt-2 w-40 overflow-hidden rounded-xl border bg-card py-1 shadow-panel">
          {LANGS.map((l) => (
            <li key={l.code}>
              <button
                type="button"
                role="option"
                aria-selected={lang === l.code}
                onClick={() => { onChange(l.code); setOpen(false); }}
                className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-secondary"
              >
                {l.label} {lang === l.code && <Check className="h-4 w-4 text-primary" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const tabLinks = [
  { icon: Leaf, to: "/discover" },
  { icon: MapPin, to: "/track" },
  // Dashboards guard themselves: signed-out visitors are sent to sign in,
  // and only merchants / riders get into their own dashboard.
  { icon: Store, to: "/merchant/dashboard" },
  { icon: Motorbike, to: "/rider/dashboard" },
] as const;

function BottomNav({ labels }: { labels: readonly string[] }) {
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-50">
      <ul className="mx-auto grid max-w-3xl grid-cols-4 rounded-t-[1.75rem] bg-card px-1 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-nav">
        {tabLinks.map(({ icon: I, to }, i) => {
          const active = i === 0;
          return (
            <li key={to} className="relative">
              {i > 0 && <span aria-hidden="true" className="absolute left-0 top-1/2 h-10 w-px -translate-y-1/2 bg-border" />}
              <Link
                to={to}
                className="flex h-full w-full flex-col items-center justify-center gap-0.5 py-1"
              >
                <span className={"grid h-10 w-10 place-items-center rounded-full sm:h-11 sm:w-11 " + (active ? "bg-primary" : "")}>
                  <I className={active ? "h-5 w-5" : "h-7 w-7"} strokeWidth={active ? 2.4 : 1.9} />
                </span>
                <span
                  className={
                    "whitespace-nowrap text-[clamp(11px,3.6vw,17px)] font-extrabold leading-tight " +
                    (active ? "text-primary text-stroke-ink" : "text-foreground")
                  }
                >
                  {labels[i]}
                </span>
                <span className={"mt-0.5 h-[3px] w-10 rounded-full " + (active ? "bg-primary" : "bg-transparent")} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function SoundWaves({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={className}>
      {[8, 16, 24].map((r) => (
        <path key={r} d={`M ${30 - r * 0.2} ${20 - r * 0.7} A ${r} ${r} 0 0 0 ${30 - r * 0.2} ${20 + r * 0.7}`} transform={`translate(${-r * 0.55} 0)`}
          className="fill-none stroke-primary" strokeWidth="3.2" strokeLinecap="round" />
      ))}
    </svg>
  );
}

function Index() {
  const [lang, setLang] = useLang();
  const t = T[lang];

  return (
    <div className="landing min-h-screen pb-28">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-b-[2rem]">
        <div className="absolute inset-y-0 right-0 w-[72%] md:w-[60%]">
          <img
            src={heroWoman}
            alt="Smiling shopper talking to Beez on her phone at a market"
            width={1280}
            height={1280}
            className="h-full w-full object-cover object-[62%_center]"
          />
          <div className="landing-hero-fade absolute inset-0" />
        </div>
        <SoundWaves className="absolute left-[48%] top-[40%] h-9 w-9 -rotate-12 sm:h-14 sm:w-14 md:left-[60%] md:top-[30%]" />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-8">
          <header className="flex items-center justify-between gap-1.5 pt-4 sm:gap-3 sm:pt-6">
            <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
              <SiteMenu />
              <BrandLogo />
            </div>
            <div className="flex items-center gap-1 sm:gap-3">
              <Link
                to="/get-started"
                className="whitespace-nowrap rounded-full bg-primary px-3 py-1.5 text-[clamp(11px,3.1vw,15px)] font-extrabold text-primary-foreground shadow-panel transition hover:scale-105 sm:px-5 sm:py-2.5"
              >
                {t.ctaGetStarted}
              </Link>
              <Link
                to="/login"
                className="whitespace-nowrap rounded-full border border-foreground/15 bg-card px-3 py-1.5 text-[clamp(11px,3.1vw,15px)] font-extrabold text-foreground shadow-panel transition hover:scale-105 sm:px-5 sm:py-2.5"
              >
                {t.ctaLogin}
              </Link>
              <LanguagePicker lang={lang} onChange={setLang} />
            </div>
          </header>

          <div className="pb-6 pt-5 md:pb-16 md:pt-14">
            <div className="max-w-[52%] sm:max-w-md md:max-w-lg">
              <h1 className="font-extrabold leading-[0.95] tracking-tight">
                <span className="block whitespace-nowrap text-[clamp(22px,7.2vw,26px)] sm:text-5xl">{t.welcome}</span>
                <span className="relative inline-block text-[56px] tracking-[-0.03em] sm:text-8xl">
                  Be<span className="text-primary">ez!</span>
                  <svg viewBox="0 0 300 20" preserveAspectRatio="none" aria-hidden="true" className="absolute -bottom-2 left-0 h-2.5 w-[115%] text-primary sm:-bottom-3 sm:h-4">
                    <path d="M3 17 C 80 4, 200 2, 297 6" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
                  </svg>
                </span>
              </h1>
              <p className="mt-5 text-[15px] font-extrabold leading-tight tracking-tight sm:text-2xl">
                {t.tagA}
                <br />
                {t.tagB}
              </p>
              <p className="mt-3 text-[12.5px] leading-snug sm:text-lg">{t.desc}</p>
              <Link
                to="/discover"
                className="mt-4 inline-flex items-center gap-2.5 whitespace-nowrap rounded-full bg-primary px-5 py-2.5 text-[15px] font-extrabold text-primary-foreground shadow-panel transition hover:scale-105 sm:px-7 sm:py-4 sm:text-xl"
              >
                <Mic className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.4} /> {t.talk} <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.6} />
              </Link>
            </div>
          </div>
        </div>

        <p className="landing-script-shadow absolute bottom-5 right-3 -rotate-[8deg] text-right font-script text-xl leading-[1.05] text-ink-foreground sm:bottom-8 sm:right-10 sm:text-4xl">
          {t.script[0]}
          <br />
          {t.script[1]} <span className="text-primary">{t.script[2]}</span>
          <svg viewBox="0 0 200 14" aria-hidden="true" className="ml-auto mt-0.5 h-2.5 w-28 text-primary sm:h-3 sm:w-48">
            <path d="M2 12 C 70 2, 140 2, 198 4" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          </svg>
        </p>
      </section>

      {/* Features */}
      <section className="mx-auto mt-2 max-w-6xl px-2 sm:px-8">
        <div className="grid grid-cols-3 gap-1.5 rounded-3xl bg-card p-1.5 shadow-panel sm:gap-4 sm:p-4">
          {featureStyle.map((f, i) => {
            const { icon: I, tint, circle, isNew } = f;
            const [title, desc] = t.features[i] ?? ["", ""];
            const inner = (
              <>
                {isNew && (
                  <span className="absolute right-1.5 top-1.5 rounded-md bg-destructive px-1.5 py-px text-[9px] font-bold text-destructive-foreground sm:text-xs">
                    {t.isNew}
                  </span>
                )}
                {circle ? (
                  <span className={"grid h-12 w-12 place-items-center rounded-full sm:h-16 sm:w-16 " + circle}>
                    <I className="h-6 w-6 sm:h-8 sm:w-8" />
                  </span>
                ) : (
                  <I className="h-12 w-9 sm:h-16 sm:w-12" />
                )}
                <h2 className="mt-2 whitespace-nowrap text-[clamp(9.5px,2.7vw,18px)] font-extrabold leading-tight tracking-[-0.02em]">{title}</h2>
                <p className="mt-0.5 text-[clamp(9.5px,2.55vw,14px)] leading-snug text-foreground/85">{desc}</p>
              </>
            );
            const cls = "relative flex flex-col items-center rounded-2xl border border-border/60 px-1 py-2.5 text-center transition hover:-translate-y-0.5 sm:px-4 sm:py-6 " + tint;
            return "href" in f ? (
              <a key={i} href={f.href} target="_blank" rel="noreferrer" className={cls}>{inner}</a>
            ) : (
              <Link key={i} to={f.to} className={cls}>{inner}</Link>
            );
          })}
        </div>
      </section>

      {/* Reels strip */}
      <section className="mx-auto mt-6 max-w-6xl px-3 sm:mt-10 sm:px-8">
        <div className="relative">
          <svg viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden="true" className="absolute -bottom-2.5 left-0 h-10 w-[70%] sm:-bottom-4 sm:h-16">
            <path d="M0 0 H400 C 300 18, 170 40, 40 40 C 14 40, 0 26, 0 10 Z" className="fill-primary" />
          </svg>
          <div className="relative rounded-[1.75rem] bg-ink text-ink-foreground">
            <div className="flex items-center gap-2 py-5 pl-3 pr-[42%] sm:gap-5 sm:py-8 sm:pl-8 sm:pr-[44%]">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground sm:h-16 sm:w-16">
                <Play className="ml-0.5 h-4 w-4 fill-current sm:h-7 sm:w-7" />
              </span>
              <div className="min-w-0">
                <h2 className="whitespace-nowrap text-[clamp(11px,3.6vw,30px)] font-extrabold leading-tight">{t.reelsTitle}</h2>
                <p className="mt-0.5 text-[clamp(9px,2.3vw,16px)] leading-snug opacity-90 sm:whitespace-nowrap">{t.reelsSub}</p>
              </div>
            </div>
            <svg viewBox="0 0 30 24" aria-hidden="true" className="absolute -top-3 right-[5%] h-5 w-6 sm:h-8 sm:w-10">
              <path d="M4 22 L9 8 M14 20 L22 4 M18 23 L28 16" className="fill-none stroke-primary" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <img
              src={reelsPhones}
              alt="Product reels showing sneakers, a red dress and headphones"
              loading="lazy"
              width={1024}
              height={768}
              className="absolute -top-5 right-[4%] h-[135%] w-auto max-w-[42%] -rotate-3 object-contain sm:-top-8 sm:max-w-[50%]"
            />
            <Link
              to="/discover"
              className="absolute -bottom-1 right-3 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10px] font-extrabold text-primary-foreground shadow-panel sm:bottom-4 sm:right-6 sm:px-5 sm:py-2.5 sm:text-sm"
            >
              {t.reelsCta} <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4" />
            </Link>
          </div>
        </div>
      </section>

      <BottomNav labels={t.tabs} />
    </div>
  );
}
