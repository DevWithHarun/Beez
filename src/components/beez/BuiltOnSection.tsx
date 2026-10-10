const tools = [
  {
    title: "Mobile payments",
    description: "Pay securely using your local mobile money or digital wallets.",
    status: "(P) Active",
    icon: "payments",
    className: "payment-tool",
  },
  {
    title: "SMS alerts",
    description: "Reaches phones with no data.",
    status: "(P) Active",
    icon: "sms",
    className: "",
  },
  {
    title: "GPS and maps",
    description: "Delivery pins and landmarks.",
    status: "LIVE",
    icon: "maps",
    className: "",
  },
  {
    title: "Push notifications",
    description: "Order alerts straight to the browser.",
    status: "LIVE",
    icon: "push",
    className: "",
  },
  {
    title: "Multi-language support",
    description:
      "The full app and voice interface, available in multiple local, national, and international languages to match how your market speaks.",
    status: "",
    icon: "languages",
    className: "language-tool",
  },
];

const toolPaths: Record<string, string> = {
  payments:
    "M6 5h6v14H6zM8 8h2m-1 2v4m-2-3h4m7-5h3v11h-3m-4-8 4 4m0-4-4 4",
  sms: "M4 5h16v12H9l-5 4V5Zm4 4h8m-8 4h5",
  maps: "M12 3a7 7 0 0 0-7 7c0 5 7 12 7 12s7-7 7-12a7 7 0 0 0-7-7Zm0 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm-8 13h6m7 0h5",
  push: "M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Zm-8 12a2 2 0 0 0 4 0",
  languages:
    "M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0Zm1 0h16M12 3c3 3 3 15 0 18m0-18c-3 3-3 15 0 18m-3-11h8m-8 4h6",
};

function ToolIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={toolPaths[name]} />
    </svg>
  );
}

export default function BuiltOnSection() {
  return (
    <section className="built-page" id="built-on">
      <header className="section-heading built-heading">
        <h2>Built on what people already use.</h2>
        <p>
          No new hardware and nothing to download. Beez runs in the browser on
          the phones people already carry.
        </p>
      </header>

      <div className="built-grid">
        {tools.map((tool) => (
          <article
            className={`built-card ${tool.className}`}
            key={tool.title}
          >
            <div className="built-card-top">
              <ToolIcon name={tool.icon} />
              {tool.status && (
                <span className="status-pill">
                  {tool.status} <i />
                </span>
              )}
              {tool.icon === "payments" && (
                <div className="payment-brands" aria-label="Payment providers">
                  <span className="brand-wave">w</span>
                  <span className="brand-orange">O!</span>
                  <span className="brand-mpesa">M</span>
                </div>
              )}
            </div>
            <h3>{tool.title}</h3>
            <p>{tool.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
