import { createFileRoute } from "@tanstack/react-router";
import {
  Mic, Bot, Languages, Store, ListChecks, MessagesSquare, UserPlus, ShoppingBasket, MapPin, Video,
  PackageCheck, Share2, Signal, TrendingUp, Calculator, Boxes, BellRing, Lightbulb, LineChart, Tags,
  Wallet, FileText, AudioLines, Link2, Search, Truck, MessageCircleMore, Smartphone, type LucideIcon,
} from "lucide-react";
import { InfoPage } from "@/components/site/InfoPage";
import voiceImg from "@/assets/feature-voice-shopping.jpg";
import storeImg from "@/assets/feature-merchant-store.jpg";
import assistantImg from "@/assets/feature-business-assistant.jpg";
import whatsappImg from "@/assets/feature-whatsapp-commerce.jpg";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — Beez voice commerce, merchant stores & AI assistant" },
      { name: "description", content: "Voice shopping in local languages, digital stores for street vendors, an AI business assistant and WhatsApp selling — all in Beez." },
      { property: "og:title", content: "Beez Features — Smart tools. Real growth." },
      { property: "og:description", content: "Order by voice, open a store in minutes, track sales and profits with AI, and sell through WhatsApp." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FeaturesPage,
});

type Item = { icon: LucideIcon; title: string; desc: string };
type Group = { id: string; label: string; title: string; intro: string; image: string; alt: string; badge?: string; tint: string; items: Item[] };

const groups: Group[] = [
  {
    id: "voice",
    label: "01",
    title: "AI-Powered Voice Commerce",
    intro: "Shop by talking — no typing needed.",
    image: voiceImg,
    alt: "Woman at a market ordering groceries by speaking into her phone",
    tint: "bg-tint-amber",
    items: [
      { icon: Mic, title: "Voice Shopping", desc: "Customers can order products simply by speaking instead of typing." },
      { icon: Bot, title: "AI Voice Assistant", desc: "Understands customer requests and helps them find products." },
      { icon: Languages, title: "Multilingual Voice Support", desc: "Supports English, French, Swahili, Haitian Creole, and other local languages." },
      { icon: Store, title: "Voice Merchant Management", desc: "Merchants can manage orders, products, and prices through voice commands." },
      { icon: ListChecks, title: "AI Order Processing", desc: "Automatically converts voice requests into structured shopping lists." },
      { icon: MessagesSquare, title: "Conversational Shopping", desc: "Talk to Beez as if you were speaking to a personal shopping assistant." },
    ],
  },
  {
    id: "stores",
    label: "02",
    title: "Smart Merchant Digital Stores",
    intro: "Every seller deserves a storefront — even at the roadside.",
    image: storeImg,
    alt: "Market vendor at her fruit stall showing her online store on a phone",
    tint: "bg-tint-mint",
    items: [
      { icon: UserPlus, title: "Easy Merchant Registration", desc: "Anyone can create a digital store without complicated requirements." },
      { icon: ShoppingBasket, title: "Street Vendor Stores", desc: "Market vendors and informal sellers get their own online storefronts." },
      { icon: MapPin, title: "GPS Merchant Discovery", desc: "Customers find merchants based on their physical location." },
      { icon: Video, title: "Merchant Video Profiles", desc: "Merchants introduce themselves and their businesses on video." },
      { icon: PackageCheck, title: "Real-Time Product Availability", desc: "Merchants update what's in stock easily, any time." },
      { icon: Share2, title: "WhatsApp Store Sharing", desc: "Share your Beez store directly through WhatsApp." },
      { icon: Signal, title: "Low-Data Mode", desc: "Beez stays usable on limited or expensive internet connections." },
    ],
  },
  {
    id: "assistant",
    label: "03",
    title: "AI Merchant Business Assistant",
    intro: "Know your numbers and grow — just ask.",
    image: assistantImg,
    alt: "Shop owner reviewing sales charts and low-stock alerts on a tablet",
    badge: "Standout feature",
    tint: "bg-tint-violet",
    items: [
      { icon: TrendingUp, title: "Sales Tracking", desc: "Automatically track daily, weekly, and monthly sales." },
      { icon: Calculator, title: "Profit Calculator", desc: "Understand your actual profits." },
      { icon: Boxes, title: "Inventory Management", desc: "Monitor available products and stock levels." },
      { icon: BellRing, title: "Stock Alerts", desc: "Get notified when products are running low." },
      { icon: Lightbulb, title: "AI Business Advice", desc: "Practical recommendations to improve business performance." },
      { icon: LineChart, title: "Sales Forecasting", desc: "Predict potential future demand." },
      { icon: Tags, title: "Smart Pricing", desc: "Price suggestions based on purchase costs, expenses, and market information." },
      { icon: Wallet, title: "Expense Tracking", desc: "Record and understand your expenses." },
      { icon: FileText, title: "Business Reports", desc: "Simple financial and commercial reports." },
      { icon: AudioLines, title: "Voice-Based Business Reports", desc: "Ask questions about your business and hear spoken answers." },
    ],
  },
  {
    id: "whatsapp",
    label: "04",
    title: "WhatsApp Commerce Integration",
    intro: "Sell where your customers already chat.",
    image: whatsappImg,
    alt: "Merchant's phone showing a chat with a customer and an order confirmation",
    tint: "bg-tint-blue",
    items: [
      { icon: Share2, title: "Share Products on WhatsApp", desc: "Send products directly to customers through WhatsApp." },
      { icon: Link2, title: "Shareable Product Links", desc: "Generate links to any product in your store." },
      { icon: Search, title: "Discovery via WhatsApp", desc: "Customers can discover Beez products through WhatsApp." },
      { icon: Truck, title: "Order & Delivery Updates", desc: "Order confirmations and delivery updates sent on WhatsApp." },
      { icon: MessageCircleMore, title: "Inquiries into Orders", desc: "Turn WhatsApp questions into Beez orders." },
      { icon: Smartphone, title: "WhatsApp Business Connection", desc: "Link WhatsApp Business chats with your storefront where technically possible." },
    ],
  },
];

function FeaturesPage() {
  return (
    <InfoPage
      eyebrow="Features"
      title={<>Smart tools for <span className="text-primary text-stroke-ink">shoppers</span> and sellers.</>}
      intro="Beez brings voice shopping, digital storefronts, an AI business assistant and WhatsApp selling together — built for local markets."
    >
      <nav aria-label="Feature groups" className="mt-6 flex flex-wrap gap-2">
        {groups.map((g) => (
          <a key={g.id} href={`#${g.id}`} className="rounded-full border border-border bg-card px-4 py-2 text-sm font-bold shadow-panel transition hover:bg-primary/20">
            {g.title}
          </a>
        ))}
      </nav>

      <div className="mt-10 space-y-16 sm:space-y-24">
        {groups.map((g, gi) => (
          <section key={g.id} id={g.id} className="scroll-mt-24">
            <div className={"grid items-center gap-6 md:grid-cols-2 md:gap-12 " + (gi % 2 ? "md:[&>*:first-child]:order-2" : "")}>
              <div className="relative">
                <img src={g.image} alt={g.alt} loading={gi === 0 ? "eager" : "lazy"} width={1024} height={768} className="aspect-[4/3] w-full rounded-[1.75rem] object-cover shadow-panel" />
                <span className="absolute -top-3 left-4 rounded-full bg-primary px-3 py-1 text-sm font-extrabold text-primary-foreground shadow-panel">{g.label}</span>
              </div>
              <div>
                {g.badge && <span className="mb-3 inline-block rounded-md bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground">{g.badge}</span>}
                <h2 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{g.title}</h2>
                <p className="mt-2 text-lg text-muted-foreground">{g.intro}</p>
              </div>
            </div>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map(({ icon: I, title, desc }) => (
                <li key={title} className={"flex gap-3 rounded-2xl border border-border/60 p-4 " + g.tint}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"><I className="h-5 w-5" /></span>
                  <div>
                    <h3 className="font-extrabold leading-tight">{title}</h3>
                    <p className="mt-1 text-sm leading-snug text-foreground/80">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </InfoPage>
  );
}
