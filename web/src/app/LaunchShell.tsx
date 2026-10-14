const launchTabs = ["Discover", "Track", "Sell", "Ride"] as const;

export default function LaunchShell() {
  return (
    <main className="min-h-screen bg-background px-6 py-12 text-foreground">
      <section className="mx-auto max-w-lg text-center">
        <img className="mx-auto h-16 w-16" src="/beez-logo.png" alt="Beez" />
        <h1 className="mt-6 text-3xl font-semibold">The Beez app is being built.</h1>
        <p className="mt-3 text-muted-foreground">
          The product screens and backend services are not available yet.
        </p>
        <nav aria-label="Planned app sections" className="mt-8 grid grid-cols-2 gap-3">
          {launchTabs.map((tab) => (
            <span
              key={tab}
              aria-disabled="true"
              className="rounded-lg border border-border px-4 py-3 text-sm text-muted-foreground"
            >
              {tab}
            </span>
          ))}
        </nav>
      </section>
    </main>
  );
}
