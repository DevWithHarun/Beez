import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Mic, Smartphone, Truck, Heart, BarChart3, ArrowRight, PlayCircle, Users,
  ChevronLeft, ChevronRight, Star, CheckCircle2, AudioLines,
  Compass, Navigation, Store, Facebook, Instagram, Youtube,
} from "lucide-react";

function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
import hero from "@/assets/hero-vendor.jpg";
import vendorMan from "@/assets/vendor-man.jpg";
import amina from "@/assets/avatar-amina.jpg";
import peter from "@/assets/avatar-peter.jpg";
import beezMark from "@/assets/beez-mark.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Beez — Voice-first commerce for street vendors" },
      { name: "description", content: "Beez helps street vendors in Kenya sell, get paid via M-Pesa and get counted — just by speaking." },
      { property: "og:title", content: "Beez — Voice-first commerce for street vendors" },
      { property: "og:description", content: "Sell, get paid and get counted, by voice. M-Pesa payments and delivery for the informal economy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const nav = ["Home", "Features", "How It Works", "About", "FAQ"];

const bottomTabs = [
  { icon: Compass, label: "Discover" },
  { icon: Navigation, label: "Track" },
  { icon: Store, label: "Sell" },
  { icon: Truck, label: "Delivery" },
];

function BottomNav() {
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur-md">
      <ul className="mx-auto flex max-w-3xl items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {bottomTabs.map(({ icon: I, label }, i) => (
          <li key={label} className="flex-1">
            <button
              type="button"
              aria-current={i === 0 ? "page" : undefined}
              className={
                "flex w-full flex-col items-center gap-1 py-3 text-[11px] font-semibold transition " +
                (i === 0 ? "text-primary" : "text-muted-foreground")
              }
            >
              <I className="h-5 w-5" />
              {label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Logo({ sub }: { sub?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <img src={beezMark.url} alt="Beez logo" className="h-9 w-9 rounded-full bg-foreground object-contain p-1" />
      <div>
        <div className="text-2xl font-extrabold leading-none">Beez</div>
        {sub && <div className="text-xs opacity-80">Voice. Payments. Progress.</div>}
      </div>
    </div>
  );
}

const features = [
  { icon: Mic, t: "Voice First", d: "No typing. Just speak and sell. Simple, fast and easy." },
  { icon: Smartphone, t: "M-Pesa Payments", d: "Secure and instant payments via M-Pesa. No cash, no stress." },
  { icon: Truck, t: "Delivery & Tracking", d: "Get your products delivered and track every order in real-time." },
  { icon: BarChart3, t: "Get Counted", d: "Track your sales, customers and growth. Your business matters." },
];
const steps = [
  ["Speak", "Tell Beez what you want to sell, check prices or get updates."],
  ["Pay", "Customers pay via M-Pesa. You get the money instantly."],
  ["Deliver", "We help with delivery and tracking, so you don't have to worry."],
  ["Grow", "Track your sales, customers and progress. Get counted."],
];
const stats = [
  { icon: Users, v: "10,000+", l: "Active Vendors", s: "From street corners to local markets." },
  { icon: Smartphone, v: "KES 12M+", l: "Processed Payments", s: "Through M-Pesa." },
  { icon: Truck, v: "8,500+", l: "Orders Delivered", s: "Across Nairobi and beyond." },
  { icon: BarChart3, v: "95%", l: "Vendor Satisfaction", s: "Real people. Real impact." },
];
const stories = [
  { img: amina, q: "Now I sell more, get paid faster and I don't waste time with cash.", n: "Amina Wanjiku", r: "Vegetable Vendor – Nairobi" },
  { img: peter, q: "The voice orders are so easy. Even my customers love it.", n: "Peter Kamau", r: "Phone Accessories – Eastleigh" },
  { img: amina, q: "I can track my sales and know what to restock. Beez is a game changer!", n: "Grace Muthoni", r: "Food Vendor – Mathare" },
];

function Index() {
  return (
    <div className="min-h-screen pb-20">
      {/* Hero */}
      <section id="home" className="relative overflow-hidden">
        <img src={hero} alt="Street vendor using Beez by voice" width={1280} height={832}
          className="absolute inset-y-0 right-0 h-full w-full object-cover md:w-[65%]" />
        <div className="absolute inset-0 hero-fade" />
        <div className="relative mx-auto max-w-7xl px-6">
          <header className="flex items-center justify-between py-5">
            <Logo />
            <nav className="hidden gap-8 text-sm md:flex">
              {nav.map((n, i) => (
                <a key={n} href={`#${n.toLowerCase().replace(/ /g, "-")}`}
                  className={i === 0 ? "border-b-2 border-primary pb-1 text-primary" : "hover:text-primary"}>{n}</a>
              ))}
            </nav>
            <div className="flex gap-3">
              <Link to="/get-started" className="rounded-full border px-4 py-2 text-sm hover:border-primary">Login</Link>
              <Link to="/get-started" className="whitespace-nowrap rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Get Started</Link>
            </div>
          </header>

          <div className="grid items-center gap-8 py-16 md:grid-cols-2 md:py-24">
            <div>
              <p className="text-sm font-semibold tracking-widest">VOICE-FIRST COMMERCE</p>
              <h1 className="mt-4 text-4xl font-extrabold leading-tight md:text-6xl">
                Helping street vendors <span className="text-primary">sell, get paid</span> and <span className="text-primary">get counted</span>, by voice.
              </h1>
              <p className="mt-6 max-w-lg text-muted-foreground">
                Beez helps <b className="text-foreground">street vendors</b> sell, get paid and get counted, just by speaking. Voice-first commerce, <b className="text-foreground">M-Pesa payments</b> and delivery for the informal economy.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link to="/get-started" className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground transition hover:scale-105">
                  <Mic className="h-4 w-4" /> Start Selling Now <ArrowRight className="h-4 w-4" />
                </Link>
                <a href="#how-it-works" className="flex items-center gap-2 rounded-full border-2 border-primary px-6 py-3 font-semibold">
                  <PlayCircle className="h-4 w-4" /> Watch How It Works
                </a>
              </div>
              <div className="mt-10 flex flex-wrap gap-6 text-sm">
                {[[Mic, "Voice Orders"], [Smartphone, "M-Pesa Payments"], [Truck, "Delivery & Tracking"], [Heart, "Built for Kenya"]].map(([I, l]) => {
                  const Icon = I as typeof Mic;
                  return <span key={l as string} className="flex items-center gap-2"><Icon className="h-4 w-4" />{l as string}</span>;
                })}
              </div>
            </div>
            <div className="relative hidden h-[420px] md:block">
              <div className="glass absolute left-4 top-0 flex items-center gap-3 rounded-xl px-4 py-3 text-xs">
                <AudioLines className="h-6 w-6 text-primary" /> "I want to sell 2 tomatoes<br />for 50 shillings"
              </div>
              <div className="glass absolute right-0 top-6 rounded-xl px-5 py-4 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
                <div className="mt-2 text-xs text-muted-foreground">Payment received</div>
                <div className="text-lg font-bold">KES 50</div>
                <div className="text-xs">M-Pesa</div>
              </div>
              <div className="glass absolute bottom-6 right-0 w-64 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3 text-xs"><Truck className="h-6 w-6 text-primary" />
                  <div>Order delivered<br />#BEEZ7384</div></div>
                <div className="mt-3 h-1 rounded bg-primary" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why */}
      <section id="features" className="border-t">
        <div className="relative mx-auto max-w-7xl px-6 py-16">
          <p className="text-xs font-bold tracking-widest text-primary">WHY BEEZ?</p>
          <h2 className="mt-2 text-3xl font-extrabold md:text-4xl">Built for the <span className="text-primary">real economy.</span></h2>
          <p className="mt-3 max-w-md text-muted-foreground">We understand <b className="text-foreground">the hustle</b>. Beez is designed for street vendors, small businesses and informal traders — simple, <b className="text-foreground">affordable</b> and built for everyday life.</p>
          <p className="absolute right-6 top-14 hidden -rotate-6 font-script text-4xl leading-none text-primary lg:block">Small<br />vendors.<br />Big dreams.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: I, t, d }) => (
              <div key={t} className="rounded-2xl border bg-card p-6 transition hover:border-primary">
                <span className="grid h-12 w-12 place-items-center rounded-full border border-primary/40"><I className="h-6 w-6 text-primary" /></span>
                <h3 className="mt-5 font-bold">{t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How */}
      <section id="how-it-works" className="border-t">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div className="relative h-[380px]">
              <img src={vendorMan} alt="Vendor checking a Beez order" loading="lazy" width={896} height={1024}
                className="absolute right-0 top-4 h-[320px] w-[70%] rounded-2xl object-cover" />
              <div className="absolute left-0 top-0 w-48 rounded-[2rem] border-4 border-secondary bg-background p-4 text-center shadow-2xl">
                <div className="flex items-center gap-1.5 text-left text-sm font-bold"><img src={beezMark.url} alt="" className="h-5 w-5 rounded-md bg-foreground p-0.5" /> Beez</div>
                <Mic className="mx-auto mt-4 h-8 w-8 text-primary" />
                <AudioLines className="mx-auto mt-2 h-8 w-16 text-primary" />
                <p className="text-xs">Listening...</p>
                <p className="mt-1 text-xs">"I want to sell 3 kg of onions for 150"</p>
                <div className="mt-4 rounded-lg bg-card p-2 text-left text-xs">
                  <div className="flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-success" /> Order confirmed</div>
                  <div>KES 150 · M-Pesa</div>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold tracking-widest text-primary">HOW IT WORKS</p>
              <h2 className="mt-2 text-3xl font-extrabold">From voice to value<br />in 4 simple steps.</h2>
              <ol className="mt-8 space-y-6">
                {steps.map(([t, d], i) => (
                  <li key={t} className="flex gap-5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary font-bold text-primary-foreground">{i + 1}</span>
                    <div><h3 className="font-bold">{t}</h3><p className="text-sm text-muted-foreground">{d}</p></div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="mt-14 grid gap-6 rounded-2xl border bg-card p-6 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map(({ icon: I, v, l, s }) => (
              <div key={l} className="flex gap-4">
                <I className="h-8 w-8 shrink-0 text-primary" />
                <div><div className="text-xl font-extrabold">{v}</div><div className="text-sm">{l}</div><div className="mt-1 text-xs text-muted-foreground">{s}</div></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stories */}
      <section id="about" className="mx-auto grid max-w-7xl items-center gap-8 px-6 pb-16 lg:grid-cols-[1fr_2.5fr]">
        <div>
          <p className="text-xs font-bold tracking-widest text-primary">REAL STORIES</p>
          <h2 className="mt-2 text-3xl font-extrabold">"Beez changed <span className="text-primary">my life."</span></h2>
          <p className="mt-2 text-sm text-muted-foreground">See what our vendors have to say about Beez.</p>
        </div>
        <div className="flex items-center gap-3">
          <ChevronLeft className="hidden h-6 w-6 shrink-0 sm:block" />
          <div className="grid flex-1 gap-4 md:grid-cols-3">
            {stories.map((s) => (
              <figure key={s.n} className="rounded-2xl border bg-card p-5">
                <div className="flex gap-3">
                  <img src={s.img} alt={s.n} loading="lazy" width={816} height={816} className="h-14 w-14 rounded-full object-cover" />
                  <blockquote className="text-xs">"{s.q}"</blockquote>
                </div>
                <figcaption className="mt-4 text-sm font-bold">{s.n}<div className="text-xs font-normal text-muted-foreground">{s.r}</div></figcaption>
                <div className="mt-1 flex text-primary">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-3 w-3 fill-current" />)}</div>
              </figure>
            ))}
          </div>
          <ChevronRight className="hidden h-6 w-6 shrink-0 sm:block" />
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 py-10 md:flex-row">
          <Logo sub />
          <div className="text-center">
            <h2 className="text-2xl font-extrabold">Join thousands of vendors<br />already using Beez.</h2>
            <p className="mt-2 text-sm">It's simple. It's secure. It's made for you.</p>
          </div>
          <div className="text-center">
            <Link to="/get-started" className="flex items-center gap-2 rounded-full bg-background px-8 py-3 font-semibold text-foreground">Get Started Now <ArrowRight className="h-4 w-4" /></Link>
            <p className="mt-2 text-xs">No credit card required.</p>
          </div>
        </div>
      </section>

      <footer id="faq" className="border-t">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="grid gap-8 border-b pb-8 text-center md:grid-cols-[1fr_auto_1fr] md:items-center md:text-left">
            <div className="flex justify-center md:justify-start"><Logo sub /></div>
            <nav className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm">
              {nav.map((n) => (
                <a key={n} href={`#${n.toLowerCase().replace(/ /g, "-")}`} className="text-muted-foreground transition hover:text-primary">{n}</a>
              ))}
            </nav>
            <div className="flex justify-center gap-3 md:justify-end">
              {([["X", XIcon], ["Facebook", Facebook], ["Instagram", Instagram], ["YouTube", Youtube]] as const).map(([label, Icon]) => (
                <a key={label} href="#" aria-label={label}
                  className="grid h-9 w-9 place-items-center rounded-full border transition hover:border-primary hover:text-primary">
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>
          <div className="mt-6 flex flex-col items-center gap-2 text-xs text-muted-foreground md:flex-row md:justify-between">
            <span>© 2025 Beez. All rights reserved.</span>
            <span>Proudly built in Kenya 🇰🇪 · For the hustlers.</span>
          </div>
        </div>
      </footer>

      <BottomNav />
    </div>
  );
}
