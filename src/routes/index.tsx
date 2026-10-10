import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import Navigation from "@/components/beez/Navigation";
import HeroSection from "@/components/beez/HeroSection";
import OfferSection from "@/components/beez/OfferSection";
import ProblemSection from "@/components/beez/ProblemSection";
import VisionSection from "@/components/beez/VisionSection";
import FeaturesSection from "@/components/beez/FeaturesSection";
import TrustSection from "@/components/beez/TrustSection";
import BuiltOnSection from "@/components/beez/BuiltOnSection";
import FAQSection from "@/components/beez/FAQSection";
import FinalCallToAction from "@/components/beez/FinalCallToAction";
import SiteFooter from "@/components/beez/SiteFooter";

const TITLE = "Beez: The financial system never saw them. Beez does.";
const DESC = "Beez gives small businesses smart tools for real growth.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#fffdf7" },
    ],
  }),
  component: App,
});

type Page = "home" | "offer" | "vision" | "features" | "faq" | "trust" | "built-on" | "problem";
const pages: Page[] = ["home", "offer", "vision", "features", "faq", "trust", "built-on", "problem"];

function currentPage(): Page {
  const h = window.location.hash;
  const page = h.startsWith("#/") ? h.slice(2) : h.slice(1);
  return pages.includes(page as Page) ? (page as Page) : "home";
}

function App() {
  const [page, setPage] = useState<Page>("home");

  useEffect(() => {
    setPage(currentPage());
    const update = () => {
      setPage(currentPage());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);

  return (
    <div className="w">
      <Navigation />
      <main>
        {page === "home" && <HeroSection />}
        {page === "offer" && <OfferSection />}
        {page === "vision" && <VisionSection />}
        {page === "features" && <FeaturesSection />}
        {page === "faq" && <FAQSection />}
        {page === "trust" && <TrustSection />}
        {page === "built-on" && <BuiltOnSection />}
        {page === "problem" && (
          <>
            <FinalCallToAction />
            <ProblemSection />
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
