const safeguards = [
  {
    title: "Payments confirmed first",
    description: "An order counts only after the payment is verified.",
    status: "SECURED",
    art: "payment",
  },
  {
    title: "Right order, right person",
    description: "A 4-digit delivery code confirms the handover.",
    status: "MATCHED",
    art: "delivery",
  },
  {
    title: "Approved riders",
    description: "The Beez team reviews riders before they take any job.",
    status: "VERIFIED",
    art: "rider",
  },
  {
    title: "Only what is needed",
    description:
      "We collect phone numbers, location and shop media only to run orders and deliveries.",
    status: "PRIVATE",
    art: "privacy",
  },
];

function SafeguardArt({ type }: { type: string }) {
  if (type === "payment") {
    return (
      <svg viewBox="0 0 300 115" role="img" aria-label="Verified payment">
        <g className="trust-rings">
          <circle cx="65" cy="57" r="39" />
          <circle cx="65" cy="57" r="30" />
        </g>
        <g className="trust-icon">
          <rect x="34" y="43" width="44" height="27" rx="5" />
          <path d="M41 51h15m-15 8h8" />
          <circle cx="88" cy="37" r="13" />
          <path d="m82 37 4 4 8-9m-6 38a12 12 0 1 0 24 0 12 12 0 1 0-24 0Zm6 0 4 4 8-9" />
          <path d="M8 52h7m-7 7h11m-11-14h10m96 8h10m-10 7h14m-14-14h10" />
        </g>
        <g className="trust-icon trust-currency">
          <rect x="190" y="31" width="35" height="62" rx="6" />
          <path d="M202 40h11m-7 10c8-5 12 4 3 8-8 4-4 12 4 8m-5-19v20m-6 9h12" />
          <rect x="231" y="38" width="28" height="54" rx="5" />
          <path d="M239 48h12m-12 8h12" />
        </g>
      </svg>
    );
  }
  if (type === "delivery") {
    return (
      <svg viewBox="0 0 300 115" role="img" aria-label="Verified delivery code">
        <g className="trust-rings">
          <circle cx="69" cy="58" r="41" />
          <circle cx="69" cy="58" r="31" />
        </g>
        <g className="trust-icon">
          <rect x="31" y="42" width="78" height="32" rx="6" />
          <path d="M43 50h7v16h-7zm15 0h7v16h-7zm15 0h7v16h-7zm15 0h7v16h-7z" />
          <path d="M185 76 174 54m9 4 7-15 15 2 8 22m-24-9 13 9h22m-42-5a8 8 0 1 0 16 0 8 8 0 1 0-16 0m30 5a8 8 0 1 0 16 0 8 8 0 1 0-16 0" />
          <path d="M232 21c0-8 6-14 14-14s14 6 14 14c0 12-14 27-14 27s-14-15-14-27Zm9 0a5 5 0 1 0 10 0 5 5 0 1 0-10 0" />
          <path d="m138 53 15 7m-14 8 11 2" />
        </g>
      </svg>
    );
  }
  if (type === "rider") {
    return (
      <svg viewBox="0 0 300 115" role="img" aria-label="Approved delivery riders">
        <g className="trust-rings">
          <circle cx="70" cy="58" r="42" />
          <circle cx="70" cy="58" r="31" />
        </g>
        <g className="trust-icon">
          <path d="m39 61 10-21 18-4 17 15 8 20H68m-9-27-7 20m21-14h20m-33 25a11 11 0 1 0 22 0 11 11 0 1 0-22 0m47 0a11 11 0 1 0 22 0 11 11 0 1 0-22 0m-22 0h22" />
          <path d="M58 38c-1-11 10-17 19-12l6 8-14 5" />
          <path d="M190 43a19 19 0 0 1 36 0m-31-4 13 7 13-7m-31 25a19 19 0 0 0 35 0m-27 8 11-9 11 9" />
          <path d="m245 54 8 8 17-19m-25 23h24" />
        </g>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 300 115" role="img" aria-label="Private, minimal data collection">
      <g className="trust-rings">
        <circle cx="67" cy="58" r="42" />
        <circle cx="67" cy="58" r="31" />
      </g>
      <g className="trust-icon">
        <path d="M67 25 94 36v20c0 20-12 31-27 39C52 87 40 76 40 56V36l27-11Z" />
        <rect x="58" y="53" width="18" height="16" rx="3" />
        <path d="M62 53v-5a5 5 0 0 1 10 0v5m-5 6v4" />
        <rect x="148" y="36" width="21" height="43" rx="4" />
        <path d="M154 42h9m-8 30h7m58-24c0-11 8-19 18-19s18 8 18 19c0 14-18 34-18 34s-18-20-18-34Zm12 0a6 6 0 1 0 12 0 6 6 0 1 0-12 0m50-9h26v20h-26z" />
        <path d="m254 52 8 8 15-17" />
      </g>
    </svg>
  );
}

export default function TrustSection() {
  return (
    <section className="trust-page" id="trust">
      <header className="section-heading trust-heading">
        <h2>Safe by design.</h2>
        <p>When money and deliveries are involved, trust is the product.</p>
      </header>

      <div className="trust-grid">
        {safeguards.map((item) => (
          <article className="trust-card" key={item.title}>
            <span className="status-pill">
              {item.status} <i />
            </span>
            <SafeguardArt type={item.art} />
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </article>
        ))}
      </div>

      <p className="section-target">
        The target: every informal merchant, counted.
      </p>
    </section>
  );
}
