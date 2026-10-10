import PilotMapSection from "./PilotMapSection";

const stages = [
  {
    number: "01",
    title: "Commerce:",
    description:
      "Merchants sell by voice. Customers order and pay with M-Pesa. Riders deliver.",
    icon: "store",
  },
  {
    number: "02",
    title: "Transactions:",
    description:
      "Every order, payment, and delivery is recorded digitally for the first time.",
    icon: "record",
  },
  {
    number: "03",
    title: "Data:",
    description:
      "A clear, unvarnished picture of what inventory sells, when, and to whom.",
    icon: "data",
  },
  {
    number: "04",
    title: "Trust:",
    description:
      "An immutable, verified track record proving a merchant consistently gets paid.",
    icon: "trust",
  },
  {
    number: "05",
    title: "Financial Services:",
    description: "Digital wallets and savings tools unlocked by history.",
    icon: "wallet",
  },
  {
    number: "06",
    title: "Credit:",
    description:
      "Fair, algorithmic lending and micro-capital for businesses banks rejected.",
    icon: "credit",
  },
  {
    number: "07",
    title: "More Commerce:",
    description:
      "Injected capital fuels inventory expansion, feeding the loop.",
    icon: "loop",
  },
];

const icons: Record<string, string> = {
  store: "M4 10 6 4h12l2 6M5 10v10h14V10M4 10c0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0M8 15h3v5M14 14h3v3h-3z",
  record:
    "M7 3h10a2 2 0 0 1 2 2v16H5V5a2 2 0 0 1 2-2Zm1 5 1.5 1.5L12 7m2 2h2m-8 4 1.5 1.5L12 12m2 2h2m-8 4 1.5 1.5L12 17m2 2h2",
  data: "M4 19V5m0 14h17M7 16v-5h3v5m2 0V8h3v8m2 0V4h3v12",
  trust: "M12 3 20 6v6c0 5-3.4 8-8 10-4.6-2-8-5-8-10V6l8-3Zm-4 9 3 3 5-6",
  wallet: "M4 6h15v14H4zM4 9h15m-1 4h3v4h-3a2 2 0 1 1 0-4ZM7 4h10",
  credit: "M12 20V5m-6 6 6-6 6 6M5 20h14",
  loop: "M19 7V3l-4 4 4 4V7a8 8 0 1 0 1 9M5 17v4l4-4-4-4v4",
};

function StageIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={icons[name]} />
    </svg>
  );
}

export default function VisionSection() {
  return (
    <section className="vision-page" id="vision">
      <header className="section-heading vision-heading">
        <h2>
          One loop. <span>An economy-sized idea.</span>
        </h2>
        <p>
          Beez starts with commerce because it needs no history and no capital.
          <br />
          Everything else is built on top, in this order.
        </p>
      </header>

      <h3 className="flywheel-title">The 7-Step Compounding Flywheel Grid</h3>
      <div className="flywheel">
        <div className="flywheel-track" aria-hidden="true">
          {stages.map((stage) => (
            <i key={stage.number} />
          ))}
          <span>→</span>
        </div>
        <div className="stage-grid">
          {stages.map((stage) => (
            <article className="stage-card" key={stage.number}>
              <span className="stage-number">{stage.number}</span>
              <StageIcon name={stage.icon} />
              <h4>{stage.title}</h4>
              <p>{stage.description}</p>
            </article>
          ))}
        </div>
      </div>

      <PilotMapSection />
    </section>
  );
}
