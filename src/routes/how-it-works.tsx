import { createFileRoute } from "@tanstack/react-router";
import { Mic, ListChecks, MapPin, MessageCircleMore, UserPlus, AudioLines, Share2, TrendingUp, ShoppingBag, Store, type LucideIcon } from "lucide-react";
import { InfoPage } from "@/components/site/InfoPage";
import voiceImg from "@/assets/feature-voice-shopping.jpg";
import storeImg from "@/assets/feature-merchant-store.jpg";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How Beez works — shop by voice, sell from your phone" },
      { name: "description", content: "See how shoppers order by speaking in their own language and how merchants open a store, sell on WhatsApp and track profits with Beez." },
      { property: "og:title", content: "How Beez works" },
      { property: "og:description", content: "Speak your order, find nearby merchants, and get updates on WhatsApp. Merchants open a store in minutes and grow with AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HowItWorksPage,
});

type Step = { icon: LucideIcon; title: string; desc: string };

const tracks: { id: string; icon: LucideIcon; who: string; title: string; image: string; alt: string; steps: Step[] }[] = [
  {
    id: "shoppers",
    icon: ShoppingBag,
    who: "For shoppers",
    title: "Just say what you need",
    image: voiceImg,
    alt: "Shopper speaking her order into her phone at the market",
    steps: [
      { icon: Mic, title: "Speak your order", desc: "Tap Talk to Beez and say what you want — in English, French, Swahili, Haitian Creole or another local language." },
      { icon: ListChecks, title: "Beez builds your list", desc: "The AI assistant understands your request and turns it into a clear shopping list." },
      { icon: MapPin, title: "Pick a merchant near you", desc: "Find sellers close to you by location, watch their video profiles and see what's available right now." },
      { icon: MessageCircleMore, title: "Get updates on WhatsApp", desc: "Receive your order confirmation and delivery updates straight to WhatsApp." },
    ],
  },
  {
    id: "merchants",
    icon: Store,
    who: "For merchants",
    title: "Open your store and grow",
    image: storeImg,
    alt: "Market vendor showing her Beez store on her phone",
    steps: [
      { icon: UserPlus, title: "Register in minutes", desc: "Create your digital store without complicated requirements — street vendors and informal sellers welcome." },
      { icon: AudioLines, title: "Manage by voice", desc: "Add products, change prices, update stock and handle orders using voice commands." },
      { icon: Share2, title: "Share on WhatsApp", desc: "Send your store or product links to customers and turn WhatsApp questions into Beez orders." },
      { icon: TrendingUp, title: "Track and improve", desc: "Your AI business assistant tracks sales, profits and stock, gives advice, and answers your questions out loud." },
    ],
  },
];

function HowItWorksPage() {
  return (
    <InfoPage
      eyebrow="How it works"
      title={<>Shop or sell in <span className="text-primary text-stroke-ink">four simple steps</span>.</>}
      intro="Whether you're buying groceries or running a market stall, Beez works by voice, in your language, and even on low data."
    >
      <div className="mt-10 space-y-16 sm:space-y-24">
        {tracks.map((t, ti) => (
          <section key={t.id} aria-labelledby={`${t.id}-title`} className="grid gap-8 md:grid-cols-[0.9fr_1.1fr] md:items-start md:gap-12">
            <div className={"md:sticky md:top-24 " + (ti % 2 ? "md:order-2" : "")}>
              <span className="inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1 text-sm font-bold text-ink-foreground">
                <t.icon className="h-4 w-4" /> {t.who}
              </span>
              <h2 id={`${t.id}-title`} className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">{t.title}</h2>
              <img src={t.image} alt={t.alt} loading={ti === 0 ? "eager" : "lazy"} width={1024} height={768} className="mt-5 aspect-[4/3] w-full rounded-[1.75rem] object-cover shadow-panel" />
            </div>
            <ol className="relative space-y-4">
              <span aria-hidden="true" className="absolute bottom-6 left-6 top-6 w-0.5 bg-primary/40" />
              {t.steps.map(({ icon: I, title, desc }, i) => (
                <li key={title} className="relative flex gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-panel sm:p-5">
                  <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                    <I className="h-5 w-5" />
                    <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-ink text-[11px] font-extrabold text-ink-foreground">{i + 1}</span>
                  </span>
                  <div>
                    <h3 className="text-lg font-extrabold leading-tight">{title}</h3>
                    <p className="mt-1 leading-snug text-muted-foreground">{desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </InfoPage>
  );
}
