// Analytics tab: every figure comes from merchantAnalytics() over the shop's saved records.
import { useMemo, useState, type ReactNode } from "react";
import {
  Wallet,
  ShoppingBag,
  Coins,
  Users,
  Download,
  Clock3,
  CircleDollarSign,
  Truck,
  XCircle,
  UserRound,
  Smartphone,
  PackageOpen,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import {
  ANALYTICS_PERIODS,
  hourLabel,
  merchantAnalytics,
  ordersCsv,
  type AnalyticsPeriod,
} from "@/lib/merchant-analytics";
import { money, type MerchantItem, type MerchantOrder, type MerchantProduct } from "@/lib/merchant-data";

type Props = {
  orders: MerchantOrder[];
  items: MerchantItem[];
  products: MerchantProduct[];
};

export function MerchantAnalyticsTab({ orders, items, products }: Props) {
  const [period, setPeriod] = useState<AnalyticsPeriod>("Today");
  const a = useMemo(() => merchantAnalytics(period, orders, items, products), [period, orders, items, products]);
  const compare = a.window.compareLabel;

  const download = () => {
    const csv = ordersCsv([...a.periodOrders].sort((x, y) => y.created_at.localeCompare(x.created_at)));
    // The BOM makes Excel read KES amounts and names correctly.
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
    link.href = url;
    link.download = `beez-orders-${period.toLowerCase().replace(/\s+/g, "-")}-${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const liveCount = a.newCustomers + a.returningCustomers;

  return (
    <div className="analytics">
      <div className="analytics-toolbar">
        <div className="analytics-periods" role="group" aria-label="Choose period">
          {ANALYTICS_PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={period === p}
              className={period === p ? "active" : ""}
              onClick={() => setPeriod(p)}
            >
              {p}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="view-btn analytics-download"
          onClick={download}
          disabled={!a.periodOrders.length}
          title={a.periodOrders.length ? undefined : "No orders in this period"}
        >
          <Download size={14} /> Download orders
        </button>
      </div>

      <div className="metrics">
        <TrendCard
          icon={Wallet}
          title="Paid sales"
          value={money(a.revenue)}
          change={a.revenueChange}
          compare={compare}
          points={a.series.map((s) => s.revenue)}
          tone="yellow"
        />
        <TrendCard
          icon={ShoppingBag}
          title="Orders"
          value={String(a.orders)}
          change={a.ordersChange}
          compare={compare}
          points={a.series.map((s) => s.orders)}
          tone="green"
        />
        <TrendCard
          icon={Coins}
          title="Average order"
          value={money(a.average)}
          change={a.averageChange}
          compare={compare}
          points={a.series.map((s) => s.average)}
          tone="yellow"
        />
        <TrendCard
          icon={Users}
          title="Customers"
          value={String(a.customers)}
          change={a.customersChange}
          compare={compare}
          points={a.series.map((s) => s.customers)}
          tone="purple"
        />
      </div>

      <div className="middle-grid">
        <div className="card sales-card">
          <div className="card-title">
            <h2>Paid sales · {period}</h2>
            <span className="analytics-muted">{a.paidOrders} paid orders</span>
          </div>
          <div className="analytics-chart">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={a.series} margin={{ top: 10, right: 4, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="#152b3d" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#b5c5d8", fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={8} />
                <YAxis tick={{ fill: "#b5c5d8", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  formatter={(value) => [money(Number(value)), "Paid sales"]}
                  contentStyle={{ background: "#071521", border: "1px solid #274056", borderRadius: 10, color: "#fff" }}
                  cursor={{ fill: "#142637" }}
                />
                <Bar dataKey="revenue" fill="#ffc928" radius={[3, 3, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card products-card">
          <div className="card-title">
            <h2>Top products</h2>
            <span className="analytics-muted">paid orders</span>
          </div>
          {a.topProducts.map((p) => (
            <div className="product-row" key={p.key}>
              <ProductThumb name={p.name} url={p.imageUrl} />
              <div className="product-info">
                <b>{p.name}</b>
                <small>{p.sold} sold</small>
              </div>
              <strong>{money(p.revenue)}</strong>
            </div>
          ))}
          {!a.topProducts.length && <div className="empty">No paid product sales in this period.</div>}
        </div>
      </div>

      <div className="analytics-stats">
        <Stat icon={UserRound} title="New vs returning">
          <strong>
            {a.newCustomers} new · {a.returningCustomers} returning
          </strong>
          <Split left={a.newCustomers} right={a.returningCustomers} />
          <small>{liveCount ? `${Math.round((a.returningCustomers / liveCount) * 100)}% came back` : "No customers yet"}</small>
        </Stat>
        <Stat icon={Smartphone} title="How you were paid">
          <strong>
            M-Pesa {money(a.mpesa.revenue)} · Cash {money(a.cash.revenue)}
          </strong>
          <Split left={a.mpesa.revenue} right={a.cash.revenue} />
          <small>
            {a.mpesa.count} M-Pesa · {a.cash.count} cash paid orders
          </small>
        </Stat>
        <Stat icon={Truck} title="Delivery or pickup">
          <strong>
            {a.delivery} delivery · {a.pickup} pickup
          </strong>
          <Split left={a.delivery} right={a.pickup} />
          <small>orders not cancelled</small>
        </Stat>
        <Stat icon={CircleDollarSign} title="Still waiting to be paid">
          <strong>{money(a.awaitingValue)}</strong>
          <small>
            {a.awaitingCount} {a.awaitingCount === 1 ? "order" : "orders"} not paid yet
          </small>
        </Stat>
        <Stat icon={XCircle} title="Cancelled orders">
          <strong>{a.cancelled}</strong>
          <small>{a.cancelRate}% of orders in this period</small>
        </Stat>
        <Stat icon={Clock3} title="Busiest hour">
          <strong>{a.busiestHour === null ? "—" : hourLabel(a.busiestHour)}</strong>
          <small>
            {a.busiestHour === null
              ? "No orders yet"
              : `${a.busiestHourOrders} ${a.busiestHourOrders === 1 ? "order" : "orders"} in that hour`}
          </small>
        </Stat>
      </div>

      <div className="card products-card analytics-low">
        <div className="card-title">
          <h2>
            <PackageOpen size={15} /> Running low
          </h2>
          <span className="analytics-muted">5 or fewer left</span>
        </div>
        {a.lowStock.map((p) => (
          <div className="product-row" key={p.id}>
            <ProductThumb name={p.name} url={p.image_url} />
            <div className="product-info">
              <b>{p.name}</b>
              <small>{money(p.price_kes)}</small>
            </div>
            <strong className={p.stock === 0 ? "analytics-out" : "analytics-few"}>
              {p.stock === 0 ? "Sold out" : `${p.stock} left`}
            </strong>
          </div>
        ))}
        {!a.lowStock.length && <div className="empty">All listed products have more than 5 in stock.</div>}
      </div>

      <p className="analytics-note">
        Paid sales count only paid orders that weren't cancelled, and leave out delivery and service fees.
        Periods follow Nairobi time.
      </p>
    </div>
  );
}

function TrendCard({
  icon: Icon,
  title,
  value,
  change,
  compare,
  points,
  tone,
}: {
  icon: typeof Wallet;
  title: string;
  value: string;
  change: number | null;
  compare: string;
  points: number[];
  tone: "yellow" | "green" | "purple";
}) {
  return (
    <div className="metric-card">
      <div className="metric-heading">
        <span className="metric-icon">
          <Icon size={20} />
        </span>
        <span>{title}</span>
      </div>
      <strong>{value}</strong>
      <div className="growth">
        {!compare ? (
          "since you started"
        ) : change === null ? (
          `nothing to compare ${compare.replace(/^vs /, "with ")}`
        ) : (
          <>
            <span className={change < 0 ? "analytics-down" : ""}>
              {change > 0 ? "+" : ""}
              {change}%
            </span>
            {compare}
          </>
        )}
      </div>
      <Sparkline points={points} tone={tone} />
    </div>
  );
}

/** Draws the period's real per-hour / per-day values; nothing is drawn without at least two points. */
export function Sparkline({ points, tone }: { points: number[]; tone: string }) {
  if (points.length < 2) return null;
  const max = Math.max(...points);
  const d = points
    .map((v, i) => {
      const x = 2 + (i / (points.length - 1)) * 176;
      const y = max > 0 ? 33 - (v / max) * 30 : 33;
      return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg className={`sparkline ${tone}`} viewBox="0 0 180 36" preserveAspectRatio="none" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function ProductThumb({ name, url }: { name: string; url: string | null }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="product-image analytics-thumb">
      {url && !broken ? (
        <img src={url} alt={name} loading="lazy" onError={() => setBroken(true)} />
      ) : (
        <span aria-hidden="true">{name.trim().charAt(0).toUpperCase() || "?"}</span>
      )}
    </div>
  );
}

function Stat({ icon: Icon, title, children }: { icon: typeof Wallet; title: string; children: ReactNode }) {
  return (
    <div className="card analytics-stat">
      <div className="metric-heading">
        <span className="metric-icon">
          <Icon size={18} />
        </span>
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Split({ left, right }: { left: number; right: number }) {
  const total = left + right;
  const pct = total ? Math.round((left / total) * 100) : 0;
  return (
    <div className="analytics-split" aria-hidden="true">
      <span style={{ width: total ? `${pct}%` : "0%" }} />
    </div>
  );
}
