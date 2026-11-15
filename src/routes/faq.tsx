import { createFileRoute } from "@tanstack/react-router";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { InfoPage } from "@/components/site/InfoPage";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Questions about Beez voice shopping and merchant stores" },
      { name: "description", content: "Answers about ordering by voice, supported languages, opening a Beez store, the AI business assistant, WhatsApp selling and Low-Data Mode." },
      { property: "og:title", content: "Beez FAQ" },
      { property: "og:description", content: "Everything you want to know about shopping and selling with Beez." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FaqPage,
});

const sections: { title: string; faqs: [string, string][] }[] = [
  {
    title: "Shopping",
    faqs: [
      ["Do I have to type to place an order?", "No. You can order simply by speaking. The Beez voice assistant understands your request, helps you find products and turns what you said into a shopping list."],
      ["Which languages does Beez understand?", "English, French, Swahili, Haitian Creole and other local languages."],
      ["How do I find sellers near me?", "Beez shows merchants based on their physical location, so you can find shops and market vendors close to you and watch their video profiles."],
      ["Will I get updates about my order?", "Yes. Order confirmations and delivery updates can be sent to you on WhatsApp."],
      ["What if my internet is slow or expensive?", "Turn on Low-Data Mode. It keeps Beez usable on limited or expensive connections."],
    ],
  },
  {
    title: "Selling",
    faqs: [
      ["Who can open a store on Beez?", "Anyone. Registration has no complicated requirements, and street vendors and informal sellers can get their own online storefront."],
      ["Can I manage my store by voice?", "Yes. You can manage orders, products and prices with voice commands, and update product availability in real time."],
      ["Can I sell through WhatsApp?", "Yes. Share your store and products on WhatsApp with shareable links, and turn WhatsApp questions into Beez orders."],
      ["What does the AI business assistant do?", "It tracks your daily, weekly and monthly sales, calculates profit, monitors stock and alerts you when items run low, tracks expenses, forecasts demand, suggests prices, gives practical business advice and creates simple reports."],
      ["Can I ask about my business out loud?", "Yes. Ask questions like how your sales went this week and Beez gives you a spoken answer."],
    ],
  },
];

function FaqPage() {
  return (
    <InfoPage
      eyebrow="FAQ"
      title={<>Questions? <span className="text-primary text-stroke-ink">We've got answers.</span></>}
      intro="Quick answers about shopping and selling with Beez."
    >
      <div className="mt-10 grid gap-10 md:grid-cols-2">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="mb-3 text-2xl font-extrabold">{s.title}</h2>
            <Accordion type="single" collapsible className="space-y-2">
              {s.faqs.map(([q, a], i) => (
                <AccordionItem key={q} value={`${s.title}-${i}`} className="rounded-2xl border border-border/60 bg-card px-4 shadow-panel">
                  <AccordionTrigger className="text-left text-base font-extrabold hover:no-underline">{q}</AccordionTrigger>
                  <AccordionContent className="text-[15px] leading-relaxed text-muted-foreground">{a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        ))}
      </div>
    </InfoPage>
  );
}
