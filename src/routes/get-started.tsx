import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Store, Bike, Check, ArrowRight, Globe, ChevronDown } from "lucide-react";
import merchant from "@/assets/hero-vendor.jpg";
import rider from "@/assets/rider.jpg";
import beezMark from "@/assets/beez-mark.png.asset.json";

export const Route = createFileRoute("/get-started")({
  head: () => ({
    meta: [
      { title: "Get started — Choose your role | Beez" },
      { name: "description", content: "Join Beez as a merchant or a rider. Sell by voice or deliver and earn daily." },
      { property: "og:title", content: "Get started with Beez" },
      { property: "og:description", content: "Choose your role: merchant or rider." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GetStarted,
});

type Lang = "en" | "sw" | "fr" | "de";
const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "sw", label: "Kiswahili" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
];

const T = {
  en: {
    badge: "GET STARTED", h1a: "Choose your role", h1b: "and", h1c: "get going with Beez",
    sub1: "Whether you sell, deliver or both — Beez is built for you.", sub2: "Pick your role to continue.",
    cont: "Continue as", footer: "Together we power local commerce",
    roles: [
      { t: "Merchant", d: "Sell your products, receive payments via M-Pesa, and grow your business with Beez.", pts: ["Voice ordering", "M-Pesa payments", "Delivery & tracking", "Business insights"] },
      { t: "Rider", d: "Pick up orders, deliver to customers, and earn with Beez. Flexible, simple and rewarding.", pts: ["Get assigned deliveries", "Track orders in real-time", "Earn daily", "Be your own boss"] },
    ],
  },
  sw: {
    badge: "ANZA SASA", h1a: "Chagua nafasi yako", h1b: "na", h1c: "anza na Beez",
    sub1: "Iwe unauza, unasafirisha au vyote — Beez imejengwa kwa ajili yako.", sub2: "Chagua nafasi yako ili kuendelea.",
    cont: "Endelea kama", footer: "Pamoja tunaendesha biashara za mtaani",
    roles: [
      { t: "Mfanyabiashara", d: "Uza bidhaa zako, pokea malipo kupitia M-Pesa, na kukuza biashara yako na Beez.", pts: ["Kuagiza kwa sauti", "Malipo ya M-Pesa", "Usafirishaji na ufuatiliaji", "Takwimu za biashara"] },
      { t: "Msafirishaji", d: "Chukua oda, wafikishie wateja, na upate kipato na Beez. Rahisi na yenye manufaa.", pts: ["Pata oda za kusafirisha", "Fuatilia oda moja kwa moja", "Pata kipato kila siku", "Kuwa bosi wako mwenyewe"] },
    ],
  },
  fr: {
    badge: "COMMENCER", h1a: "Choisissez votre rôle", h1b: "et", h1c: "lancez-vous avec Beez",
    sub1: "Que vous vendiez, livriez ou les deux — Beez est fait pour vous.", sub2: "Choisissez votre rôle pour continuer.",
    cont: "Continuer en tant que", footer: "Ensemble, nous dynamisons le commerce local",
    roles: [
      { t: "Commerçant", d: "Vendez vos produits, recevez des paiements via M-Pesa et développez votre activité avec Beez.", pts: ["Commande vocale", "Paiements M-Pesa", "Livraison et suivi", "Statistiques commerciales"] },
      { t: "Livreur", d: "Récupérez des commandes, livrez les clients et gagnez avec Beez. Flexible, simple et gratifiant.", pts: ["Recevez des livraisons", "Suivi en temps réel", "Gagnez chaque jour", "Soyez votre propre patron"] },
    ],
  },
  de: {
    badge: "LOSLEGEN", h1a: "Wähle deine Rolle", h1b: "und", h1c: "starte mit Beez",
    sub1: "Ob du verkaufst, lieferst oder beides — Beez ist für dich gemacht.", sub2: "Wähle deine Rolle, um fortzufahren.",
    cont: "Weiter als", footer: "Gemeinsam stärken wir den lokalen Handel",
    roles: [
      { t: "Händler", d: "Verkaufe deine Produkte, erhalte Zahlungen über M-Pesa und lass dein Geschäft mit Beez wachsen.", pts: ["Sprachbestellung", "M-Pesa-Zahlungen", "Lieferung & Verfolgung", "Geschäftseinblicke"] },
      { t: "Fahrer", d: "Hole Bestellungen ab, liefere an Kunden und verdiene mit Beez. Flexibel, einfach und lohnend.", pts: ["Lieferungen zugewiesen bekommen", "Bestellungen live verfolgen", "Täglich verdienen", "Sei dein eigener Chef"] },
    ],
  },
} as const;

const roleMeta = [
  { img: merchant, icon: Store, to: "/onboarding/merchant" as const },
  { img: rider, icon: Bike, to: "/onboarding/rider" as const },
];

function GetStarted() {
  const [lang, setLang] = useState<Lang>("en");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("beez-lang") as Lang | null;
    if (saved && saved in T) setLang(saved);
  }, []);
  const choose = (l: Lang) => { setLang(l); localStorage.setItem("beez-lang", l); setOpen(false); };
  const t = T[lang];

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-5xl px-6 py-6">
        <header className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-foreground"><img src={beezMark.url} alt="Beez logo" className="h-8 w-8 object-contain" /></span>
            <span className="text-3xl font-extrabold">Bee<span className="text-primary">z</span></span>
          </Link>
          <div className="relative">
            <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full border border-primary/60 px-4 py-2 text-sm">
              <Globe className="h-4 w-4" /> {LANGS.find((l) => l.code === lang)?.label} <ChevronDown className="h-4 w-4" />
            </button>
            {open && (
              <ul className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-border bg-popover py-1 shadow-lg">
                {LANGS.map((l) => (
                  <li key={l.code}>
                    <button onClick={() => choose(l.code)} className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-secondary">
                      {l.label} {lang === l.code && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </header>

        <div className="mt-8 text-center">
          <span className="rounded-full bg-primary/15 px-5 py-2 text-sm font-bold text-primary">{t.badge}</span>
          <h1 className="mt-8 text-4xl font-extrabold leading-tight md:text-5xl">
            {t.h1a}<br />{t.h1b} <span className="text-primary">{t.h1c}</span>
          </h1>
          <p className="mt-5 text-muted-foreground">{t.sub1}<br />{t.sub2}</p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {t.roles.map(({ t: title, d, pts }, i) => {
            const { img, icon: I, to } = roleMeta[i]!;
            return (
              <div key={i} className="overflow-hidden rounded-2xl border border-primary/40 bg-card transition hover:border-primary">
                <div className="relative">
                  <img src={img} alt={title} loading="lazy" className="h-64 w-full object-cover [clip-path:polygon(0_0,100%_0,100%_88%,0_100%)]" />
                  <span className="absolute -bottom-8 left-8 grid h-20 w-20 place-items-center rounded-full border border-primary/50 bg-background">
                    <I className="h-9 w-9 text-primary" />
                  </span>
                </div>
                <div className="p-8 pt-12">
                  <h2 className="text-3xl font-extrabold">{title}</h2>
                  <p className="mt-3 text-muted-foreground">{d}</p>
                  <ul className="mt-5 space-y-2 text-sm">
                    {pts.map((p) => <li key={p} className="flex gap-3"><Check className="h-4 w-4 text-primary" />{p}</li>)}
                  </ul>
                  <Link to={to} className="mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-4 font-bold text-primary-foreground transition hover:scale-[1.02]">
                    {t.cont} {title} <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-10 text-center text-sm text-muted-foreground">Already have an account? <Link to="/login" className="font-semibold text-primary">Sign in</Link></p>
        <div className="mt-6 flex items-center justify-center gap-6 text-sm">
          <span className="h-px w-20 bg-border" /> {t.footer} <span className="h-px w-20 bg-border" />
        </div>
        <img src={beezMark.url} alt="" className="mt-2 inline-block h-9 w-9 rounded-xl bg-foreground p-1.5" />
      </div>
    </div>
  );
}
