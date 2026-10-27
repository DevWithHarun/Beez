import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Headphones,
  Home,
  LogOut,
  MapPin,
  Menu,
  Navigation,
  Package,
  Pause,
  Settings,
  ShieldCheck,
  Star,
  Sun,
  TrendingUp,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { saveRider } from "@/lib/rider.functions";
import {
  acceptOrder,
  advanceOrderStatus,
  setRiderOnline,
  useRiderDashboardHome,
  type DbOrder,
  type RiderPayoutRequest,
} from "@/lib/live-orders";
import { LiveMap } from "@/components/marketplace/LiveMap";
import { supabase } from "@/integrations/supabase/client";
import beezMark from "@/assets/beez-mark.png.asset.json";
import "./-rider-dashboard.css";

export const Route = createFileRoute("/rider/dashboard")({
  head: () => ({
    meta: [
      { title: "Rider dashboard | Beez" },
      {
        name: "description",
        content: "Your Beez rider dashboard: deliveries, earnings, profile and availability.",
      },
      { property: "og:title", content: "Beez rider dashboard" },
      { property: "og:description", content: "Manage Beez deliveries and track rider earnings." },
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
const tabs: { label: DashboardTab; icon: LucideIcon }[] = [
  { label: "Home", icon: Home },
  { label: "Deliveries", icon: Package },
  { label: "Wallet", icon: Wallet },
  { label: "Today", icon: CalendarDays },
  { label: "Profile", icon: UserRound },
  { label: "Settings", icon: Settings },
];
type DashboardTab = "Home" | "Deliveries" | "Wallet" | "Today" | "Profile" | "Settings";

function nairobiDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-KE", {
    timeZone: "Africa/Nairobi",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatKes(amount: number) {
  return `KES ${amount.toLocaleString("en-KE")}`;
}

function isToday(order: DbOrder) {
  const today = nairobiDateKey(new Date());
  return (
    nairobiDateKey(order.created_at) === today ||
    (order.delivered_at !== null && nairobiDateKey(order.delivered_at) === today)
  );
}

function App() {
  const navigate = useNavigate();
  const { rider, orders, availableOrders, payouts, loaded, error, refresh } =
    useRiderDashboardHome();
  const [tab, setTab] = useState<DashboardTab>("Home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [actionError, setActionError] = useState("");
  const [workingOrder, setWorkingOrder] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");

  useEffect(() => {
    setProfileName(rider?.full_name ?? "");
    setProfilePhone(rider?.phone ?? "");
  }, [rider?.id, rider?.full_name, rider?.phone]);

  const activeOrders = useMemo(
    () => orders.filter((order) => ACTIVE_STATUSES.includes(order.status)),
    [orders],
  );
  const todayOrders = useMemo(() => orders.filter(isToday), [orders]);
  const deliveredOrders = useMemo(
    () => orders.filter((order) => order.status === "Delivered"),
    [orders],
  );
  const deliveredToday = todayOrders.filter((order) => order.status === "Delivered");
  const earningsToday = deliveredToday.reduce((sum, order) => sum + order.rider_earning_kes, 0);
  const totalEarnings = deliveredOrders.reduce((sum, order) => sum + order.rider_earning_kes, 0);
  const monthEarnings = deliveredOrders
    .filter(
      (order) =>
        nairobiDateKey(order.delivered_at ?? order.created_at).slice(0, 7) ===
        nairobiDateKey(new Date()).slice(0, 7),
    )
    .reduce((sum, order) => sum + order.rider_earning_kes, 0);
  const onTimeRate = todayOrders.length
    ? Math.round((deliveredToday.length / todayOrders.length) * 100)
    : 0;
  const riderName = rider?.full_name.trim() || "Rider";
  const initials =
    riderName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "R";

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  const handleAvailability = async () => {
    if (!rider) {
      setActionError("Your rider profile is not available. Complete rider onboarding first.");
      return;
    }
    setActionError("");
    try {
      await setRiderOnline(!rider.online);
      await refresh();
      notify(rider.online ? "You are now offline." : "You are now online.");
    } catch (caughtError) {
      setActionError(
        caughtError instanceof Error ? caughtError.message : "Availability could not be updated.",
      );
    }
  };

  const handleAccept = async (order: DbOrder) => {
    setWorkingOrder(order.id);
    setActionError("");
    try {
      await acceptOrder(order.id);
      await refresh();
      notify(`Delivery ${order.id} accepted.`);
    } catch (caughtError) {
      setActionError(
        caughtError instanceof Error ? caughtError.message : "The delivery could not be accepted.",
      );
    } finally {
      setWorkingOrder(null);
    }
  };

  const handleAdvance = async (order: DbOrder) => {
    setWorkingOrder(order.id);
    setActionError("");
    try {
      await advanceOrderStatus(order.id);
      await refresh();
      notify(`Delivery ${order.id} updated.`);
    } catch (caughtError) {
      setActionError(
        caughtError instanceof Error
          ? caughtError.message
          : "The delivery status could not be updated.",
      );
    } finally {
      setWorkingOrder(null);
    }
  };

  const handleSaveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingProfile(true);
    setActionError("");
    try {
      await saveRider({ data: { full_name: profileName.trim(), phone: profilePhone.trim() } });
      await refresh();
      notify("Rider profile saved.");
    } catch (caughtError) {
      setActionError(
        caughtError instanceof Error
          ? caughtError.message
          : "The rider profile could not be saved.",
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    setActionError("");
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw new Error(signOutError.message);
      await navigate({ to: "/login" });
    } catch (caughtError) {
      setActionError(
        caughtError instanceof Error ? caughtError.message : "You could not be signed out.",
      );
    } finally {
      setSigningOut(false);
    }
  };

  const handlePayoutRequest = async (amountKes: number) => {
    setActionError("");
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("rider-mpesa-payout", {
        body: { amount_kes: amountKes, idempotency_key: crypto.randomUUID() },
      });
      if (invokeError) {
        let message = invokeError.message;
        if (invokeError.context instanceof Response) {
          try {
            const result = (await invokeError.context.clone().json()) as { error?: string };
            message = result.error ?? message;
          } catch {
            message = invokeError.message;
          }
        }
        throw new Error(message);
      }
      await refresh();
      notify(
        data?.payout?.status === "Review"
          ? "Payout status needs confirmation. Contact support before retrying."
          : "M-Pesa payout request submitted. It will update when Safaricom confirms the result.",
      );
    } catch (caughtError) {
      setActionError(
        caughtError instanceof Error ? caughtError.message : "M-Pesa payout request failed.",
      );
    }
  };

  return (
    <div className="beez-rd">
      <div className="app">
        <aside className={menuOpen ? "sidebar open" : "sidebar"}>
          <div className="brand">
            <span>
              <img src={beezMark.url} alt="Beez" className="block h-6 w-6 object-contain" />
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
                onClick={() => {
                  setTab(label);
                  setMenuOpen(false);
                  setActionError("");
                }}
              >
                <Icon size={19} />
                {label}
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

        <main>
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
              <button className={rider?.online ? "online" : "offline"} onClick={handleAvailability}>
                <i /> {rider?.online ? "Online" : "Offline"} <ChevronDown size={15} />
              </button>
              <button
                className="bell"
                aria-label={`${activeOrders.length} active deliveries`}
                onClick={() => setTab("Deliveries")}
              >
                <Bell />
                <em>{activeOrders.length}</em>
              </button>
              <button className="user" onClick={() => setTab("Profile")}>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20 font-bold text-amber-700">
                  {initials}
                </span>
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
              <b>{error ? "Dashboard data unavailable" : "Action could not be completed"}</b>
              <span>{actionError || error}</span>
              {error && <button onClick={() => void refresh()}>Retry</button>}
            </div>
          )}

          {tab === "Home" && (
            <HomeTab
              todayOrders={todayOrders}
              deliveredToday={deliveredToday.length}
              earningsToday={earningsToday}
              onTimeRate={onTimeRate}
              activeOrder={activeOrders[0] ?? null}
              orders={orders.slice(0, 5)}
              rider={rider}
              onAvailability={handleAvailability}
              onTab={setTab}
            />
          )}
          {tab === "Deliveries" && (
            <DeliveriesTab
              orders={orders}
              availableOrders={availableOrders}
              online={rider?.online ?? false}
              workingOrder={workingOrder}
              onAccept={handleAccept}
              onAdvance={handleAdvance}
              onAvailability={handleAvailability}
            />
          )}
          {tab === "Wallet" && (
            <WalletTab
              deliveredOrders={deliveredOrders}
              monthEarnings={monthEarnings}
              totalEarnings={totalEarnings}
              payouts={payouts}
              phone={rider?.phone ?? ""}
              onRequestPayout={handlePayoutRequest}
            />
          )}
          {tab === "Today" && <TodayTab orders={todayOrders} earnings={earningsToday} />}
          {tab === "Profile" && (
            <ProfileTab
              name={profileName}
              phone={profilePhone}
              saving={savingProfile}
              onNameChange={setProfileName}
              onPhoneChange={setProfilePhone}
              onSubmit={handleSaveProfile}
            />
          )}
          {tab === "Settings" && (
            <SettingsTab
              rider={rider}
              onAvailability={handleAvailability}
              onProfile={() => setTab("Profile")}
              onSignOut={handleSignOut}
              signingOut={signingOut}
            />
          )}

          <footer>
            © Beez Rider <span>Made for local delivery in Kenya</span>
            <span>
              <ShieldCheck size={13} /> Secure rider workspace
            </span>
          </footer>
        </main>
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
  todayOrders,
  deliveredToday,
  earningsToday,
  onTimeRate,
  activeOrder,
  orders,
  rider,
  onAvailability,
  onTab,
}: {
  todayOrders: DbOrder[];
  deliveredToday: number;
  earningsToday: number;
  onTimeRate: number;
  activeOrder: DbOrder | null;
  orders: DbOrder[];
  rider: ReturnType<typeof useRiderDashboardHome>["rider"];
  onAvailability: () => void;
  onTab: (tab: DashboardTab) => void;
}) {
  return (
    <div className="layout">
      <section className="center">
        <div className="stats">
          <Stat
            icon={BriefcaseBusiness}
            label="Today’s Deliveries"
            value={String(todayOrders.length)}
            foot={`${deliveredToday} completed`}
          />
          <Stat
            icon={Wallet}
            label="Today’s Earnings"
            value={formatKes(earningsToday)}
            foot="Completed delivery earnings"
            good
          />
          <Stat
            icon={Clock3}
            label="Completion Rate"
            value={`${onTimeRate}%`}
            foot="Completed today"
            good
          />
          <Stat
            icon={Star}
            label="Availability"
            value={rider?.online ? "Online" : "Offline"}
            foot={rider?.online ? "Ready for orders" : "Not accepting orders"}
          />
        </div>

        <section className="panel active">
          <div className="pickup">
            <div className="sectiontitle">
              <i /> <b>Active Delivery</b>
              <span className="pill transit">{activeOrder?.status ?? "None"}</span>
            </div>
            {activeOrder ? (
              <>
                <div className="stop">
                  <MapPin />
                  <div>
                    <small>Pick up from</small>
                    <b>{activeOrder.merchant_name}</b>
                    <p>{activeOrder.pickup_area}</p>
                  </div>
                </div>
                <div className="stop">
                  <MapPin />
                  <div>
                    <small>Deliver to</small>
                    <b>{activeOrder.customer_area}</b>
                    <p>{activeOrder.items_summary}</p>
                  </div>
                </div>
                <div className="text-sm text-slate-300">
                  {activeOrder.id} · {formatKes(activeOrder.total_kes)}
                </div>
              </>
            ) : (
              <p className="text-slate-300">No active delivery assigned.</p>
            )}
          </div>
          {activeOrder ? (
            <div className="timeline">
              <div className="orderhead">
                <span>▣</span>
                <div>
                  <small>Order #{activeOrder.id}</small>
                  <b>{activeOrder.status}</b>
                </div>
              </div>
              {["Assigned", "In Transit", "Out for Delivery", "Delivered"].map((status, index) => {
                const statusIndex = ACTIVE_STATUSES.indexOf(activeOrder.status);
                const complete = activeOrder.status === "Delivered" || index <= statusIndex;
                return (
                  <div
                    className={`step ${complete ? "done" : index === statusIndex + 1 ? "current" : ""}`}
                    key={status}
                  >
                    <i>{complete ? <Check size={12} /> : ""}</i>
                    <div>
                      {status}
                      {status === "Assigned" && activeOrder.assigned_at && (
                        <small>{formatTime(activeOrder.assigned_at)}</small>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="timeline flex items-center justify-center text-center text-sm text-slate-400">
              Accepted deliveries will appear here.
            </div>
          )}
        </section>

        <section className="map livemap">
          <LiveMap orders={activeOrder ? [activeOrder] : []} />
          <div className="eta">
            <Navigation />
            <span>
              <small>{activeOrder ? "Delivery status" : "No active delivery"}</small>
              <b>{activeOrder?.status ?? "—"}</b>
            </span>
          </div>
          <small className="mapnote">Live map · OpenStreetMap</small>
        </section>

        <section className="panel deliveries">
          <div className="secthead">
            <b>Recent Deliveries</b>
            <button onClick={() => onTab("Deliveries")}>View all ›</button>
          </div>
          <div className="ordergrid">
            {orders.length ? (
              orders.map((order) => <OrderCard key={order.id} order={order} />)
            ) : (
              <Empty>No deliveries have been assigned to your account yet.</Empty>
            )}
          </div>
        </section>
      </section>

      <aside className="right">
        <div className={`onlinecard ${rider?.online ? "" : "off"}`}>
          <span className="shield">
            <ShieldCheck />
          </span>
          <div>
            <b>{rider?.online ? "You’re Online" : "You’re Offline"}</b>
            <small>
              {rider?.online ? "Ready to receive deliveries" : "You will not receive offers"}
            </small>
          </div>
          <button
            className={`toggle ${rider?.online ? "on" : ""}`}
            aria-label="Toggle rider availability"
            onClick={onAvailability}
          >
            <i />
          </button>
        </div>
        <section className="panel goal">
          <b>Today’s Summary</b>
          <div className="goalrow">
            <div className="donut">
              <span>
                <b>{deliveredToday}</b>
                <small>completed</small>
              </span>
            </div>
            <div>
              <strong>{formatKes(earningsToday)}</strong>
              <small>earned today</small>
              <div className="progress">
                <i style={{ width: `${onTimeRate}%` }} />
              </div>
            </div>
          </div>
        </section>
        <section className="panel quick">
          <b>Quick Actions</b>
          <button className="yellow" onClick={onAvailability}>
            <Pause size={17} /> {rider?.online ? "Go Offline" : "Go Online"}
          </button>
          <Action icon={Wallet} label="View Earnings" click={() => onTab("Wallet")} />
          <Action icon={Headphones} label="Support" click={() => onTab("Settings")} />
          <Action icon={CircleHelp} label="Help and FAQ" click={() => onTab("Settings")} />
        </section>
        <section className="panel activity">
          <div className="secthead">
            <b>Recent Activity</b>
            <button onClick={() => onTab("Deliveries")}>View All</button>
          </div>
          {orders.slice(0, 4).map((order) => (
            <div className="activityrow" key={order.id}>
              <span>
                <Check size={16} />
              </span>
              <div>
                <b>Order {order.id}</b>
                <small>
                  {order.status} · {formatKes(order.rider_earning_kes)}
                </small>
              </div>
              <time>{formatTime(order.created_at)}</time>
            </div>
          ))}
          {!orders.length && <Empty>No delivery activity yet.</Empty>}
        </section>
        <div className="earn">
          <div>
            <b>Earn more with Beez</b>
            <p>
              Your completed delivery earnings
              <br />
              are tracked in Wallet.
            </p>
          </div>
          <span>
            🐝
            <TrendingUp size={48} />
          </span>
        </div>
      </aside>
    </div>
  );
}

function DeliveriesTab({
  orders,
  availableOrders,
  online,
  workingOrder,
  onAccept,
  onAdvance,
  onAvailability,
}: {
  orders: DbOrder[];
  availableOrders: DbOrder[];
  online: boolean;
  workingOrder: string | null;
  onAccept: (order: DbOrder) => void;
  onAdvance: (order: DbOrder) => void;
  onAvailability: () => void;
}) {
  const active = orders.filter((order) => ACTIVE_STATUSES.includes(order.status));
  const history = orders.filter((order) => !ACTIVE_STATUSES.includes(order.status));
  return (
    <div className="center">
      <section className="panel">
        <div className="secthead">
          <b>Active deliveries</b>
          <span>{active.length} in progress</span>
        </div>
        {active.length ? (
          active.map((order) => (
            <div className="border-b border-slate-700/70 py-4 last:border-0" key={order.id}>
              <OrderCard order={order} />
              <button
                className="yellow mt-3"
                disabled={workingOrder === order.id}
                onClick={() => onAdvance(order)}
              >
                {workingOrder === order.id ? "Updating…" : nextOrderAction(order.status)}{" "}
                <ArrowRight size={16} />
              </button>
            </div>
          ))
        ) : (
          <Empty>You have no active deliveries.</Empty>
        )}
      </section>

      <section className="panel">
        <div className="secthead">
          <b>Available deliveries</b>
          <span>{availableOrders.length} offers</span>
        </div>
        {!online && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
            Go online to accept a delivery offer. Availability is saved to your rider profile.
          </div>
        )}
        {availableOrders.length ? (
          availableOrders.map((order) => (
            <div className="border-b border-slate-700/70 py-4 last:border-0" key={order.id}>
              <OrderCard order={order} />
              <button
                className="yellow mt-3"
                disabled={!online || workingOrder === order.id}
                onClick={() => onAccept(order)}
              >
                {workingOrder === order.id ? "Accepting…" : "Accept delivery"}{" "}
                <ArrowRight size={16} />
              </button>
            </div>
          ))
        ) : (
          <Empty>No unassigned orders are available right now.</Empty>
        )}
      </section>

      <section className="panel">
        <div className="secthead">
          <b>Delivery history</b>
          <span>{history.length} deliveries</span>
        </div>
        {history.length ? (
          <div className="ordergrid">
            {history.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        ) : (
          <Empty>Completed and past deliveries will appear here.</Empty>
        )}
      </section>
      <button className="action w-fit" onClick={onAvailability}>
        <span>{online ? "Go offline" : "Go online"}</span>
        <ArrowRight className="arr" size={14} />
      </button>
    </div>
  );
}

function WalletTab({
  deliveredOrders,
  monthEarnings,
  totalEarnings,
  payouts,
  phone,
  onRequestPayout,
}: {
  deliveredOrders: DbOrder[];
  monthEarnings: number;
  totalEarnings: number;
  payouts: RiderPayoutRequest[];
  phone: string;
  onRequestPayout: (amountKes: number) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const reservedEarnings = payouts
    .filter((payout) => ["Requested", "Processing", "Review", "Paid"].includes(payout.status))
    .reduce((sum, payout) => sum + payout.amount_kes, 0);
  const availableBalance = Math.max(0, totalEarnings - reservedEarnings);
  const requestedAmount = Number(amount);
  const validAmount =
    Number.isSafeInteger(requestedAmount) &&
    requestedAmount > 0 &&
    requestedAmount <= availableBalance &&
    requestedAmount <= 250000;
  const sortedOrders = [...deliveredOrders].sort((a, b) =>
    (b.delivered_at ?? b.created_at).localeCompare(a.delivered_at ?? a.created_at),
  );
  const sortedPayouts = [...payouts].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <div className="center">
      <div className="stats">
        <Stat
          icon={Wallet}
          label="All recorded earnings"
          value={formatKes(totalEarnings)}
          foot={`${deliveredOrders.length} completed deliveries`}
          good
        />
        <Stat
          icon={CalendarDays}
          label="This month"
          value={formatKes(monthEarnings)}
          foot="Based on delivery completion date"
        />
        <Stat
          icon={Wallet}
          label="Available to withdraw"
          value={formatKes(availableBalance)}
          foot="Paid and pending requests are reserved"
          good
        />
      </div>
      <section className="panel max-w-2xl">
        <div className="secthead">
          <b>Withdraw to M-Pesa</b>
          <span>Daraja B2C</span>
        </div>
        <p className="mb-4 text-sm text-slate-300">
          Payouts are sent to the M-Pesa number on your rider profile:{" "}
          <b>{phone || "Add a number in Profile"}</b>. Requests are capped at KES 250,000 each.
        </p>
        <form
          className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!validAmount) return;
            setSubmitting(true);
            try {
              await onRequestPayout(requestedAmount);
              setAmount("");
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <label className="grid gap-2 text-sm text-slate-300">
            Amount (KES)
            <input
              className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-3 text-white"
              type="number"
              min={1}
              max={Math.min(availableBalance, 250000)}
              step={1}
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Enter whole KES amount"
              required
            />
          </label>
          <button
            className="yellow self-end"
            type="submit"
            disabled={!validAmount || !phone || submitting}
          >
            {submitting ? "Submitting…" : "Request payout"} <ArrowRight size={16} />
          </button>
        </form>
        {!phone && (
          <p className="mt-3 text-sm text-amber-200">
            Add a valid Kenyan M-Pesa number to your profile before requesting a payout.
          </p>
        )}
        <p className="mt-3 text-xs text-slate-400">
          Your balance is reserved when the request is accepted. Safaricom must confirm the
          transaction before it is marked paid.
        </p>
      </section>
      <section className="panel">
        <div className="secthead">
          <b>M-Pesa payout history</b>
          <span>{sortedPayouts.length} requests</span>
        </div>
        {sortedPayouts.length ? (
          sortedPayouts.map((payout) => (
            <div className="activityrow" key={payout.id}>
              <span>{payout.status === "Paid" ? <Check size={16} /> : <Wallet size={16} />}</span>
              <div>
                <b>
                  {formatKes(payout.amount_kes)} · {payout.status}
                </b>
                <small>
                  {payout.destination_phone}
                  {payout.failure_reason ? ` · ${payout.failure_reason}` : ""}
                </small>
              </div>
              <time>{formatTime(payout.created_at)}</time>
            </div>
          ))
        ) : (
          <Empty>Your M-Pesa payout requests will appear here.</Empty>
        )}
      </section>
      <section className="panel">
        <div className="secthead">
          <b>Earning history</b>
          <span>Completed deliveries</span>
        </div>
        <p className="mb-4 text-sm text-slate-300">
          Earnings are calculated from completed deliveries recorded in the database.
        </p>
        {sortedOrders.length ? (
          sortedOrders.map((order) => (
            <div className="activityrow" key={order.id}>
              <span>
                <Check size={16} />
              </span>
              <div>
                <b>Delivery {order.id}</b>
                <small>
                  {order.merchant_name} · {order.customer_area}
                </small>
              </div>
              <time>
                {formatKes(order.rider_earning_kes)}
                <br />
                {formatTime(order.delivered_at ?? order.created_at)}
              </time>
            </div>
          ))
        ) : (
          <Empty>Completed delivery earnings will appear here.</Empty>
        )}
      </section>
    </div>
  );
}

function TodayTab({ orders, earnings }: { orders: DbOrder[]; earnings: number }) {
  const delivered = orders.filter((order) => order.status === "Delivered").length;
  return (
    <div className="center">
      <div className="stats">
        <Stat
          icon={Package}
          label="Deliveries today"
          value={String(orders.length)}
          foot={`${delivered} completed`}
        />
        <Stat
          icon={Wallet}
          label="Earnings today"
          value={formatKes(earnings)}
          foot="Completed delivery earnings"
          good
        />
      </div>
      <section className="panel">
        <div className="secthead">
          <b>Today’s deliveries</b>
          <span>{nairobiDateKey(new Date())} · Nairobi time</span>
        </div>
        {orders.length ? (
          <div className="ordergrid">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        ) : (
          <Empty>No deliveries are recorded for today yet.</Empty>
        )}
      </section>
    </div>
  );
}

function ProfileTab({
  name,
  phone,
  saving,
  onNameChange,
  onPhoneChange,
  onSubmit,
}: {
  name: string;
  phone: string;
  saving: boolean;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="center">
      <section className="panel max-w-2xl">
        <div className="secthead">
          <b>Rider profile</b>
          <span>Saved to your Beez account</span>
        </div>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <label className="grid gap-2 text-sm text-slate-300">
            Full name
            <input
              className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-3 text-white"
              value={name}
              maxLength={120}
              required
              onChange={(event) => onNameChange(event.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm text-slate-300">
            Phone number
            <input
              className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-3 text-white"
              type="tel"
              value={phone}
              maxLength={30}
              onChange={(event) => onPhoneChange(event.target.value)}
            />
          </label>
          <p className="text-xs text-slate-400">
            Only your name and phone number can be updated here; verification documents are not
            stored in the rider profile table.
          </p>
          <button className="yellow w-fit" type="submit" disabled={saving || !name.trim()}>
            {saving ? "Saving…" : "Save profile"} <Check size={16} />
          </button>
        </form>
      </section>
    </div>
  );
}

function SettingsTab({
  rider,
  onAvailability,
  onProfile,
  onSignOut,
  signingOut,
}: {
  rider: ReturnType<typeof useRiderDashboardHome>["rider"];
  onAvailability: () => void;
  onProfile: () => void;
  onSignOut: () => void;
  signingOut: boolean;
}) {
  return (
    <div className="center">
      <section className="panel max-w-2xl">
        <div className="secthead">
          <b>Rider settings</b>
          <span>Saved account controls</span>
        </div>
        <div className="activityrow">
          <span>
            <ShieldCheck size={16} />
          </span>
          <div>
            <b>Delivery availability</b>
            <small>
              {rider?.online
                ? "Online — eligible for new delivery offers"
                : "Offline — new delivery offers are paused"}
            </small>
          </div>
          <button className="yellow" onClick={onAvailability}>
            {rider?.online ? "Go offline" : "Go online"}
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
          <button className="action" onClick={onSignOut} disabled={signingOut}>
            <span>{signingOut ? "Signing out…" : "Sign out"}</span>
            <ArrowRight className="arr" size={14} />
          </button>
        </div>
        <div className="activityrow">
          <span>
            <UserRound size={16} />
          </span>
          <div>
            <b>Personal details</b>
            <small>Update the name and phone number on your rider profile</small>
          </div>
          <button className="action" onClick={onProfile}>
            <span>Edit profile</span>
            <ArrowRight className="arr" size={14} />
          </button>
        </div>
        <p className="mt-4 text-sm text-slate-400">
          Notification and payout preferences are not currently stored for rider accounts, so this
          page only shows settings supported by your account data.
        </p>
      </section>
    </div>
  );
}

function OrderCard({ order }: { order: DbOrder }) {
  return (
    <article className="order">
      <b>{order.id}</b>
      <span className={`pill ${order.status === "Delivered" ? "delivered" : "transit"}`}>
        {order.status}
      </span>
      <small>
        {order.merchant_name} → {order.customer_area}
      </small>
      <strong>{formatKes(order.rider_earning_kes)}</strong>
      <small>
        {formatTime(order.created_at)}{" "}
        <i>
          <ArrowRight size={13} />
        </i>
      </small>
    </article>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  foot,
  good = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  foot: string;
  good?: boolean;
}) {
  return (
    <div className="stat">
      <span className={good ? "greenicon" : "icon"}>
        <Icon />
      </span>
      <small>{label}</small>
      <strong>{value}</strong>
      <em className={good ? "good" : ""}>{foot}</em>
    </div>
  );
}

function Action({
  icon: Icon,
  label,
  click,
}: {
  icon: LucideIcon;
  label: string;
  click: () => void;
}) {
  return (
    <button className="action" onClick={click}>
      <Icon />
      <span>{label}</span>
      <ArrowRight className="arr" size={14} />
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-5 text-sm text-slate-400">{children}</p>;
}

function nextOrderAction(status: string) {
  if (status === "Assigned") return "Mark in transit";
  if (status === "In Transit") return "Mark out for delivery";
  return "Complete delivery";
}
