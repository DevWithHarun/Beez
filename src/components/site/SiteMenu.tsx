import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, LayoutGrid, Route as RouteIcon, CircleHelp, ChevronRight, House } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import beezMark from "@/assets/beez-mark.png";

const items = [
  { to: "/features", label: "Features", hint: "Everything Beez can do", icon: LayoutGrid },
  { to: "/how-it-works", label: "How it works", hint: "Shop or sell in a few steps", icon: RouteIcon },
  { to: "/faq", label: "FAQ", hint: "Answers to common questions", icon: CircleHelp },
] as const;

export function SiteMenu() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open menu"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-card text-foreground shadow-panel transition hover:scale-105 sm:h-11 sm:w-11"
      >
        <Menu className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.4} />
      </SheetTrigger>
      <SheetContent side="left" className="landing flex w-[82%] max-w-xs flex-col gap-0 p-0">
        <div className="flex items-center gap-2 border-b border-border bg-primary/15 px-5 pb-5 pt-6">
          <img src={beezMark} alt="" width={512} height={512} className="h-12 w-12 object-contain" />
          <div>
            <SheetTitle className="text-2xl font-extrabold leading-none">
              B<span className="text-primary text-stroke-ink">eez</span>
            </SheetTitle>
            <SheetDescription className="mt-1 text-[10px] font-bold tracking-[0.12em] text-foreground">
              SMART TOOLS. REAL GROWTH.
            </SheetDescription>
          </div>
        </div>
        <nav aria-label="Site" className="flex-1 px-3 py-4">
          <ul className="space-y-1.5">
            <li>
              <Link
                to="/"
                onClick={() => setOpen(false)}
                activeOptions={{ exact: true }}
                activeProps={{ className: "bg-primary/20" }}
                className="flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-secondary"
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-secondary"><House className="h-5 w-5" /></span>
                <span className="flex-1 font-extrabold">Home</span>
              </Link>
            </li>
            {items.map(({ to, label, hint, icon: I }) => (
              <li key={to}>
                <Link
                  to={to}
                  onClick={() => setOpen(false)}
                  activeProps={{ className: "bg-primary/20" }}
                  className="group flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-secondary"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground"><I className="h-5 w-5" /></span>
                  <span className="flex-1">
                    <span className="block font-extrabold leading-tight">{label}</span>
                    <span className="block text-xs text-muted-foreground">{hint}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-border p-4">
          <Link
            to="/get-started"
            onClick={() => setOpen(false)}
            className="block rounded-full bg-primary py-3 text-center font-extrabold text-primary-foreground shadow-panel"
          >
            Get Started
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
