import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  CloudOff,
  Home,
  LogOut,
  MapPin,
  Menu,
  Navigation,
  Package,
  Settings,
  ShieldCheck,
  Sun,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { saveRider } from "@/lib/rider.functions";
import { requestRiderPayout } from "@/lib/payouts.functions";
import { requireWorkspace } from "@/lib/workspace-guard";
import {
  acceptOrder,
  advanceOrderStatus,
  setRiderOnline,
  useRiderDashboardHome,
  type DbOrder,
} from "@/lib/live-orders";
import { useCourierLocationPing, type PingState } from "@/lib/use-courier-location-ping";
import { useHandoverQueue, type ScanResult } from "@/lib/use-handover-queue";
import {
  VEHICLE_TYPES,
  nairobiDay,
  newOfferIds,
  openOffers,
  readyRiderOffers,
  shiftDuration,
  trackOfferSightings,
  walletLedger,
} from "@/lib/rider-jobs";
import type { HandoverKind } from "@/lib/handover";
import { playOfferChime, unlockRiderSound } from "@/lib/rider-alert";
import { supabase } from "@/integrations/supabase/client";
import { JobOffers, type OfferOrder } from "@/components/rider/JobOffers";
import { DeliveryNavigator } from "@/components/rider/DeliveryNavigator";
import { HandoverScanner } from "@/components/rider/HandoverScanner";
import { WalletTab } from "@/components/rider/WalletTab";
import { TodayTab } from "@/components/rider/TodayTab";
import { formatKes, formatTime } from "@/components/rider/format";
import beezMark from "@/assets/beez-mark.png";
import "./-rider-dashboard.css";
import "./-rider-app.css";

export const Route = createFileRoute("/rider/dashboard")({
  ssr: false,
  // Only signed-in riders get in: others go to sign-in or rider registration.
  beforeLoad: () => requireWorkspace("rider"),
  pendingComponent: () => (
    <div className="beez-rd" style={{ padding: 40, textAlign: "center" }}>
      Opening your dashboard…
    </div>
  ),
  head: () => ({
    meta: [
      { title: "Rider dashboard | Beez" },
      {
        name: "description",
        content: "Your Beez rider app: nearby jobs, QR handovers, wallet and today's timeline.",
      },
      { property: "og:title", content: "Beez rider dashboard" },
      {
        property: "og:description",
        content: "Take nearby Beez jobs, scan handovers and track your earnings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  component: App,
});

const ACTIVE_STATUSES = ["Assigned", "In Transit", "Out for Delivery"];
type DashboardTab = "Home" | "Delivery" | "Wallet" | "Today" | "Profile" | "Settings";
const tabs: { label: DashboardTab; icon: LucideIcon; bottom: boolean }[] = [
  { label: "Home", icon: Home, bottom: true },
  { label: "Delivery", icon: Package, bottom: true },
  { label: "Wallet", icon: Wallet, bottom: true },
  { label: "Today", icon: CalendarDays, bottom: true },
  { label: "Profile", icon: UserRound, bottom: true },
  { label: "Settings", icon: Settings, bottom: false },
];
const SKIPPED_KEY = "beez:rider-skipped-offers";

function useNow(active: boolean, ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [active, ms]);
  return now;
}

function App() {
  const navigate = useNavigate();
  const requestPayout = useServerFn(requestRiderPayout);
  const {
    rider,
    orders,
    availableOrders,
    payouts,
    settlements,
    loaded,
    error,
    refresh,
    refreshAvailable,
  } = useRiderDashboardHome();
  const [tab, setTab] = useState<DashboardTab>("Home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [actionError, setActionError] = useState("");
  const [workingOrder, setWorkingOrder] = useState<string | null>(null);
  const [scan, setScan] = useState<{ orderId: string; kind: HandoverKind } | null>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }, []);
  const fail = (caught: unknown, fallback: string) =>
    setActionError(caught instanceof Error ? caught.message : fallback);

  const activeOrders = useMemo(
    () => orders.filter((o) => ACTIVE_STATUSES.includes(o.status)),
    [orders],
  );
  const activeOrder = activeOrders[0] ?? null;
  const gps = useCourierLocationPing(rider?.online ?? false, activeOrders.length > 0);

  const queue = useHandoverQueue(
    (orderId, status) => {
      void refresh();
      notify(
        status === "Delivered"
          ? `Saved scan sent — ${orderId} delivered.`
          : `Saved scan sent — ${orderId} picked up.`,
      );
    },
    (orderId, message) => setActionError(`Saved scan for ${orderId} wasn't accepted: ${message}`),
  );

  // ----- Job offers: 45s each, chime + vibration on new ones -----
  const readyAvailableOrders = readyRiderOffers(availableOrders);
  const offersEligible = !!rider?.online && !activeOrder;
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    try {
      setSkipped(
        new Set(JSON.parse(window.sessionStorage.getItem(SKIPPED_KEY) ?? "[]") as string[]),
      );
    } catch {
      /* ignore broken storage */
    }
  }, []);
  const seenRef = useRef<Record<string, number>>({});
  const seen = useMemo(() => {
    seenRef.current = trackOfferSightings(
      seenRef.current,
      offersEligible ? readyAvailableOrders : [],
      Date.now(),
    );
    return seenRef.current;
  }, [readyAvailableOrders, offersEligible]);
  const now = useNow(offersEligible && readyAvailableOrders.length > 0, 1000);
  const slowNow = useNow(true, 30_000);
  const offers = offersEligible
    ? openOffers(
        readyAvailableOrders as OfferOrder[],
        seen,
        skipped,
        Math.max(now, Date.now() - 1000),
      )
    : [];
  const offerKey = offers.map((o) => o.offer.id).join(",");
  const chimed = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!offerKey) return;
    const fresh = newOfferIds(
      chimed.current,
      offers.map((o) => o.offer),
    );
    if (fresh.length) {
      playOfferChime();
      fresh.forEach((id) => chimed.current.add(id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerKey]);

  const skipOffer = (orderId: string) => {
    setSkipped((current) => {
      const next = new Set(current).add(orderId);
      try {
        window.sessionStorage.setItem(SKIPPED_KEY, JSON.stringify([...next].slice(-100)));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  // ----- Actions -----
  const handleAvailability = async () => {
    if (!rider)
      return setActionError(
        "Your rider profile is not available. Complete rider onboarding first.",
      );
    setActionError("");
    try {
      await setRiderOnline(!rider.online);
      await refresh();
      notify(
        rider.online ? "You are now offline." : "You're online — jobs within 3 km will ring here.",
      );
    } catch (caught) {
      fail(caught, "Availability could not be updated.");
    }
  };

  const handleAccept = async (order: DbOrder) => {
    setWorkingOrder(order.id);
    setActionError("");
    try {
      await acceptOrder(order.id);
      await refresh();
      setTab("Delivery");
      notify(`Job ${order.id} is yours. Head to ${order.merchant_name}.`);
    } catch (caught) {
      fail(caught, "The job could not be accepted.");
      void refreshAvailable();
    } finally {
      setWorkingOrder(null);
    }
  };

  const handleArriving = async (order: DbOrder) => {
    setWorkingOrder(order.id);
    setActionError("");
    try {
      await advanceOrderStatus(order.id);
      await refresh();
      notify("The customer knows you're arriving.");
    } catch (caught) {
      fail(caught, "The delivery could not be updated.");
    } finally {
      setWorkingOrder(null);
    }
  };

  const handleScanDone = (result: ScanResult) => {
    setScan(null);
    void refresh();
    if (result.kind === "saved") notify("Scan saved. It will send when you have signal.");
    else if (result.status === "Delivered") {
      notify("Delivered! Your earning is in Wallet.");
    } else notify("Pickup confirmed. Head to the customer.");
  };

  const handlePayoutRequest = async (amountKes: number) => {
    setActionError("");
    try {
      const result = await requestPayout({
        data: { amountKes, idempotencyKey: crypto.randomUUID() },
      });
      await refresh();
      notify(
        result.status === "Review"
          ? "Payout status needs confirmation. Contact support before retrying."
          : "M-Pesa payout sent. It updates when Safaricom confirms.",
      );
    } catch (caught) {
      fail(caught, "M-Pesa payout request failed.");
    }
  };

  const handleSignOut = async () => {
    setActionError("");
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw new Error(signOutError.message);
      await navigate({ to: "/login" });
    } catch (caught) {
      fail(caught, "You could not be signed out.");
    }
  };

  const riderName = rider?.full_name.trim() || "Rider";
  const initials =
    riderName
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "R";
  const pendingFor = (orderId: string) => queue.queue.some((q) => q.orderId === orderId);
  const goTab = (t: DashboardTab) => {
    setTab(t);
    setMenuOpen(false);
    setActionError("");
  };

  return (
    <div className="beez-rd" onPointerDown={unlockRiderSound}>
      <div className="app">
        <aside className={menuOpen ? "sidebar open" : "sidebar"}>
          <div className="brand">
            <span>
              <img src={beezMark} alt="Beez" className="block h-6 w-6 object-contain" />
            </span>
            Bee<span>z</span>
          </div>
          <button
            className="close"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
          >
            <X />
          </button>
          <nav aria-label="Rider dashboard">
            {tabs.map(({ label, icon: Icon }) => (
              <button
                key={label}
                className={tab === label ? "selected" : ""}
                aria-current={tab === label ? "page" : undefined}
                onClick={() => goTab(label)}
              >
                <Icon size={19} />
                {label}
                {label === "Delivery" && activeOrder && (
                  <em className="navdot" aria-label="Active delivery" />
                )}
              </button>
            ))}
          </nav>
          <div className="motto">
            🐝
            <b>
              Small
              <br />
              deliveries.
              <br />
              Big dreams.
            </b>
            <i />
          </div>
          <div className="rider-art">🏍️</div>
        </aside>

        <main className="rider-main">
          <header>
            <button className="hamb" aria-label="Open navigation" onClick={() => setMenuOpen(true)}>
              <Menu />
            </button>
            <div className="heading">
              <Sun />
              <div>
                <h1>{tab}</h1>
                <p>{loaded ? `Welcome, ${riderName}.` : "Loading your rider dashboard…"}</p>
              </div>
            </div>
            <div className="headright">
              <GpsChip state={gps} />
              <button className={rider?.online ? "online" : "offline"} onClick={handleAvailability}>
                <i /> {rider?.online ? "Online" : "Offline"} <ChevronDown size={15} />
              </button>
              <button
                className="bell"
                aria-label={`${offers.length} job offers`}
                onClick={() => goTab("Home")}
              >
                <Bell />
                <em>{offers.length}</em>
              </button>
              <button className="user" onClick={() => goTab("Profile")}>
                <span className="avatar-chip">{initials}</span>
                <span>
                  <b>{riderName}</b>
                  <small>Rider</small>
                </span>
                <ChevronDown size={15} />
              </button>
            </div>
          </header>

          {(error || actionError) && (
            <div className="notice" role="alert">
              <b>{error ? "Dashboard data unavailable" : "That didn't work"}</b>
              <span>{actionError || error}</span>
              {error ? (
                <button onClick={() => void refresh()}>Retry</button>
              ) : (
                <button onClick={() => setActionError("")}>Dismiss</button>
              )}
            </div>
          )}

          {queue.queue.length > 0 && (
            <div className="queue-bar" role="status">
              <CloudOff size={16} />
              <span>
                {queue.queue.length === 1 ? "1 scan" : `${queue.queue.length} scans`} waiting for
                signal
              </span>
              <button onClick={() => void queue.flush()}>Send now</button>
            </div>
          )}

          {(tab === "Home" || tab === "Delivery") && (
            <JobOffers
              offers={offers}
              working={workingOrder}
              onAccept={handleAccept}
              onSkip={skipOffer}
            />
          )}

          {tab === "Home" && (
            <HomeTab
              online={!!rider?.online}
              onlineSince={rider?.online_since ?? null}
              now={slowNow}
              orders={orders}
              settlements={settlements}
              payouts={payouts}
              activeOrder={activeOrder}
              offersCount={offers.length}
              onAvailability={handleAvailability}
              onTab={goTab}
            />
          )}
          {tab === "Delivery" &&
            (activeOrder ? (
              <DeliveryNavigator
                order={activeOrder}
                pendingScan={pendingFor(activeOrder.id)}
                working={workingOrder === activeOrder.id}
                onScan={(kind) => setScan({ orderId: activeOrder.id, kind })}
                onArriving={() => void handleArriving(activeOrder)}
              />
            ) : (
              <NoDelivery
                online={!!rider?.online}
                offers={offers.length}
                onAvailability={handleAvailability}
                history={orders.filter((o) => !ACTIVE_STATUSES.includes(o.status))}
              />
            ))}
          {tab === "Wallet" && (
            <WalletTab
              settlements={settlements}
              payouts={payouts}
              phone={rider?.phone ?? ""}
              onRequestPayout={handlePayoutRequest}
            />
          )}
          {tab === "Today" && (
            <TodayTab
              orders={orders}
              settlements={settlements}
              onlineSince={rider?.online ? (rider.online_since ?? null) : null}
              now={slowNow}
            />
          )}
          {tab === "Profile" && rider !== undefined && (
            <ProfileTab
              rider={rider}
              onSaved={async () => {
                await refresh();
                notify("Profile saved.");
              }}
              onError={(m) => setActionError(m)}
            />
          )}
          {tab === "Settings" && (
            <SettingsTab
              online={!!rider?.online}
              onAvailability={handleAvailability}
              onProfile={() => goTab("Profile")}
              onSignOut={handleSignOut}
            />
          )}

          <footer>
            © Beez Rider <span>Made for local delivery in Kenya</span>
            <span>
              <ShieldCheck size={13} /> Secure rider workspace
            </span>
          </footer>
        </main>

        <nav className="tabbar" aria-label="Rider tabs">
          {tabs
            .filter((t) => t.bottom)
            .map(({ label, icon: Icon }) => (
              <button
                key={label}
                className={tab === label ? "on" : ""}
                aria-current={tab === label ? "page" : undefined}
                onClick={() => goTab(label)}
              >
                <Icon size={21} />
                <span>{label}</span>
                {label === "Delivery" && activeOrder && <em aria-label="Active delivery" />}
                {label === "Home" && offers.length > 0 && (
                  <em aria-label={`${offers.length} job offers`} />
                )}
              </button>
            ))}
        </nav>

        {scan && (
          <HandoverScanner
            orderId={scan.orderId}
            kind={scan.kind}
            onClose={() => setScan(null)}
            onSubmit={(input) => queue.submit(scan.orderId, input)}
            onDone={handleScanDone}
          />
        )}
        {toast && (
          <div className="toast" role="status">
            <Check />
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

function HomeTab({
  online,
  onlineSince,
  now,
  orders,
  settlements,
  payouts,
  activeOrder,
  offersCount,
  onAvailability,
  onTab,
}: {
  online: boolean;
  onlineSince: string | null;
  now: number;
  orders: DbOrder[];
  settlements: ReturnType<typeof useRiderDashboardHome>["settlements"];
  payouts: ReturnType<typeof useRiderDashboardHome>["payouts"];
  activeOrder: DbOrder | null;
  offersCount: number;
  onAvailability: () => void;
  onTab: (tab: DashboardTab) => void;
}) {
  const today = nairobiDay(now);
  const settledToday = settlements.filter((s) => nairobiDay(s.settled_at) === today);
  const earnedToday = settledToday.reduce((sum, s) => sum + s.rider_amount_kes, 0);
  const wallet = walletLedger(settlements, payouts);
  const shift = online ? shiftDuration(onlineSince, now) : null;

  return (
    <div className="center home-snap">
      <section className={`shift-card ${online ? "" : "off"}`}>
        <div>
          <small>{online ? "You're online" : "You're offline"}</small>
          <b>{online ? (shift ? `On shift ${shift}` : "On shift") : "Go online to get jobs"}</b>
          <p>
            {online
              ? activeOrder
                ? "Finish your delivery to get new jobs."
                : offersCount
                  ? `${offersCount} job${offersCount === 1 ? "" : "s"} nearby`
                  : "Waiting for jobs within 3 km…"
              : "Jobs within 3 km ring here with a chime."}
          </p>
        </div>
        <button
          className={`toggle ${online ? "on" : ""}`}
          aria-label={online ? "Go offline" : "Go online"}
          onClick={onAvailability}
        >
          <i />
        </button>
      </section>

      <div className="stats snap-stats">
        <SnapStat icon={Wallet} label="Earned today" value={formatKes(earnedToday)} good />
        <SnapStat icon={Package} label="Delivered today" value={String(settledToday.length)} />
        <SnapStat
          icon={Wallet}
          label="Wallet"
          value={formatKes(wallet.availableKes)}
          click={() => onTab("Wallet")}
        />
        <SnapStat icon={Clock3} label="Shift" value={shift ?? "—"} click={() => onTab("Today")} />
      </div>

      {activeOrder ? (
        <button className="panel active-mini" onClick={() => onTab("Delivery")}>
          <span className="pill transit">{activeOrder.status}</span>
          <b>
            {activeOrder.status === "Assigned"
              ? `Pick up at ${activeOrder.merchant_name}`
              : `Deliver to ${activeOrder.customer_area}`}
          </b>
          <small>
            <MapPin size={13} />{" "}
            {activeOrder.status === "Assigned"
              ? activeOrder.pickup_area
              : activeOrder.customer_area}{" "}
            · {activeOrder.id}
          </small>
          <span className="active-mini-go">
            <Navigation size={16} /> Open delivery <ArrowRight size={14} />
          </span>
        </button>
      ) : null}

      <section className="panel">
        <div className="secthead">
          <b>Recent deliveries</b>
          <button onClick={() => onTab("Today")}>Today ›</button>
        </div>
        {orders.length ? (
          <ul className="recent">
            {orders.slice(0, 5).map((o) => (
              <li key={o.id}>
                <span className={`pill ${o.status === "Delivered" ? "delivered" : "transit"}`}>
                  {o.status}
                </span>
                <div>
                  <b>
                    {o.merchant_name} → {o.customer_area}
                  </b>
                  <small>
                    {o.id} · {formatTime(o.delivered_at ?? o.created_at)}
                  </small>
                </div>
                <strong>{formatKes(o.rider_earning_kes)}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-note">Your deliveries will appear here.</p>
        )}
      </section>
    </div>
  );
}

function SnapStat({
  icon: Icon,
  label,
  value,
  good = false,
  click,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  good?: boolean;
  click?: () => void;
}) {
  const body = (
    <>
      <span className={good ? "greenicon" : "icon"}>
        <Icon />
      </span>
      <small>{label}</small>
      <strong>{value}</strong>
    </>
  );
  return click ? (
    <button className="stat mini" onClick={click}>
      {body}
    </button>
  ) : (
    <div className="stat mini">{body}</div>
  );
}

function NoDelivery({
  online,
  offers,
  onAvailability,
  history,
}: {
  online: boolean;
  offers: number;
  onAvailability: () => void;
  history: DbOrder[];
}) {
  return (
    <div className="center">
      <section className="panel nav-empty">
        <Package />
        <b>No active delivery</b>
        <p>
          {online
            ? offers
              ? "Accept a job above to start navigating."
              : "New jobs within 3 km will ring here."
            : "Go online to receive jobs near you."}
        </p>
        {!online && (
          <button className="yellow" onClick={onAvailability}>
            Go online <ArrowRight size={16} />
          </button>
        )}
      </section>
      <section className="panel">
        <div className="secthead">
          <b>Past deliveries</b>
          <span>{history.length}</span>
        </div>
        {history.length ? (
          <ul className="recent">
            {history.slice(0, 20).map((o) => (
              <li key={o.id}>
                <span className={`pill ${o.status === "Delivered" ? "delivered" : "transit"}`}>
                  {o.status}
                </span>
                <div>
                  <b>
                    {o.merchant_name} → {o.customer_area}
                  </b>
                  <small>
                    {o.id} · {formatTime(o.delivered_at ?? o.created_at)}
                  </small>
                </div>
                <strong>{formatKes(o.rider_earning_kes)}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-note">Completed deliveries will appear here.</p>
        )}
      </section>
    </div>
  );
}

function ProfileTab({
  rider,
  onSaved,
  onError,
}: {
  rider: ReturnType<typeof useRiderDashboardHome>["rider"];
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const save = useServerFn(saveRider);
  const [name, setName] = useState(rider?.full_name ?? "");
  const [phone, setPhone] = useState(rider?.phone ?? "");
  const [vehicle, setVehicle] = useState(rider?.vehicle_type ?? "");
  const [plate, setPlate] = useState(rider?.plate ?? "");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setName(rider?.full_name ?? "");
    setPhone(rider?.phone ?? "");
    setVehicle(rider?.vehicle_type ?? "");
    setPlate(rider?.plate ?? "");
  }, [rider?.id, rider?.full_name, rider?.phone, rider?.vehicle_type, rider?.plate]);
  const needsPlate = vehicle !== "Bicycle" && vehicle !== "On foot";

  return (
    <div className="center">
      <section className="panel max-w-2xl">
        <div className="secthead">
          <b>Rider profile</b>
          <span>Shops and customers see your name, vehicle and plate</span>
        </div>
        <form
          className="profile-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            try {
              await save({
                data: {
                  full_name: name.trim(),
                  phone: phone.trim(),
                  vehicle_type: (vehicle || null) as (typeof VEHICLE_TYPES)[number] | null,
                  plate: needsPlate ? plate.trim() || null : null,
                },
              });
              await onSaved();
            } catch (caught) {
              onError(
                caught instanceof Error ? caught.message : "The rider profile could not be saved.",
              );
            } finally {
              setSaving(false);
            }
          }}
        >
          <label>
            Full name
            <input
              value={name}
              maxLength={120}
              required
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            M-Pesa phone number
            <input
              type="tel"
              value={phone}
              maxLength={30}
              placeholder="07XX XXX XXX"
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <label>
            Vehicle
            <select value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
              <option value="">Choose…</option>
              {VEHICLE_TYPES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          {needsPlate && (
            <label>
              Number plate
              <input
                value={plate}
                maxLength={20}
                placeholder="KMFA 123B"
                autoCapitalize="characters"
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
              />
            </label>
          )}
          <button className="yellow w-fit" type="submit" disabled={saving || !name.trim()}>
            {saving ? "Saving…" : "Save profile"} <Check size={16} />
          </button>
        </form>
      </section>
    </div>
  );
}

function SettingsTab({
  online,
  onAvailability,
  onProfile,
  onSignOut,
}: {
  online: boolean;
  onAvailability: () => void;
  onProfile: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="center">
      <section className="panel max-w-2xl">
        <div className="secthead">
          <b>Rider settings</b>
          <span>Account controls</span>
        </div>
        <div className="activityrow">
          <span>
            <ShieldCheck size={16} />
          </span>
          <div>
            <b>Delivery availability</b>
            <small>
              {online ? "Online — receiving jobs within 3 km" : "Offline — job offers are paused"}
            </small>
          </div>
          <button className="yellow" onClick={onAvailability}>
            {online ? "Go offline" : "Go online"}
          </button>
        </div>
        <div className="activityrow">
          <span>
            <UserRound size={16} />
          </span>
          <div>
            <b>Personal details</b>
            <small>Name, M-Pesa number, vehicle and plate</small>
          </div>
          <button className="action" onClick={onProfile}>
            <span>Edit profile</span>
            <ArrowRight className="arr" size={14} />
          </button>
        </div>
        <div className="activityrow">
          <span>
            <LogOut size={16} />
          </span>
          <div>
            <b>Sign out</b>
            <small>End your Beez rider session on this device</small>
          </div>
          <button className="action" onClick={onSignOut}>
            <span>Sign out</span>
            <ArrowRight className="arr" size={14} />
          </button>
        </div>
      </section>
    </div>
  );
}

function GpsChip({ state }: { state: PingState }) {
  if (state.kind === "off") return null;
  const [tone, label, detail] =
    state.kind === "sending"
      ? ["live", "GPS on", "Customers can see you move on their map"]
      : state.kind === "starting"
        ? ["warn", "Finding GPS", "Waiting for your phone's location"]
        : state.kind === "blocked"
          ? ["error", "GPS blocked", "Allow location for this site in your browser settings"]
          : state.kind === "unsupported"
            ? ["error", "No GPS", "This phone or browser can't share location"]
            : ["warn", "GPS retrying", state.message];
  return (
    <span
      className="rider-gps"
      data-state={tone}
      role="status"
      title={detail}
      aria-label={`${label}: ${detail}`}
    >
      <i /> {label}
    </span>
  );
}
