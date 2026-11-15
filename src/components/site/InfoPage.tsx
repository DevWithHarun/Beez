import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { SiteMenu } from "./SiteMenu";
import { BrandLogo } from "./BrandLogo";

export function InfoPage({ eyebrow, title, intro, children }: { eyebrow: string; title: ReactNode; intro: string; children: ReactNode }) {
  return (
    <div className="landing min-h-screen pb-16">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-8">
          <div className="flex items-center gap-2 sm:gap-3">
            <SiteMenu />
            <BrandLogo size="sm" />
          </div>
          <Link
            to="/get-started"
            className="whitespace-nowrap rounded-full bg-primary px-4 py-2 text-sm font-extrabold text-primary-foreground shadow-panel transition hover:scale-105"
          >
            Get Started
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-8 sm:pt-14">
        <p className="inline-block rounded-full bg-primary/20 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.14em]">{eyebrow}</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">{title}</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">{intro}</p>
      </section>

      <main className="mx-auto max-w-6xl px-4 sm:px-8">{children}</main>

      <section className="mx-auto mt-14 max-w-6xl px-4 sm:px-8">
        <div className="flex flex-col items-start gap-4 rounded-[1.75rem] bg-ink p-6 text-ink-foreground sm:flex-row sm:items-center sm:justify-between sm:p-10">
          <div>
            <h2 className="text-2xl font-extrabold sm:text-3xl">Ready to try Beez?</h2>
            <p className="mt-1 opacity-85">Shop by voice or open your digital store today.</p>
          </div>
          <Link
            to="/get-started"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-extrabold text-primary-foreground transition hover:scale-105"
          >
            Get Started <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
