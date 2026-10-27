import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { ShoppingBag, Users, Store, Bike, Package, BarChart3, Headphones, Cog, ArrowUp, ArrowDown, ArrowRight, CircleDollarSign, MapPin, CalendarDays, type LucideIcon } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { LiveMap } from "@/components/marketplace/LiveMap";
import {
  useTable, kes, timeAgo, inLastDays, pctChange, revenueOf, statusCounts, ordersPerDay, topMerchants, customersFromOrders, pillClass,
  type AdminOrder, type Merchant, type Rider, type Ticket,
} from "@/lib/admin-data";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Admin dashboard | Beez" },
      { name: "description", content: "Beez admin overview: orders, revenue, riders, merchants and live deliveries." },
      { property: "og:title", content: "Beez admin dashboard" },
      { property: "og:description", content: "Monitor every order, rider and merchant on Beez in real time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" }],
  }),
  component: AdminDashboard,
});

const legendColors = { Delivered: "#ffc61a", "In Transit": "#2f8cff", Pending: "#ff8a1f", Cancelled: "#ff4d4d" };
const quick = [[Store, "Add Merchant", "/admin/merchants"], [Package, "Add Product", "/admin/products"], [Bike, "Manage Riders", "/admin/riders"], [BarChart3, "View Reports", "/admin/reports"], [Headphones, "Resolve Tickets", "/admin/support"], [Cog, "Settings", "/admin/settings"]] as const;
type AdminPath = "/admin/orders" | "/admin/merchants" | "/admin/customers" | "/admin/support";

function Delta({ v }: { v: number | null }) {
  if (v == null) return <span className="ad-muted xs">new</span>;
  return v >= 0 ? <span className="ad-up"><ArrowUp size={12} />{v}%</span> : <span className="ad-down"><ArrowDown size={12} />{Math.abs(v)}%</span>;
}
function Stat({ icon: I, label, value, delta }: { icon: LucideIcon; label: string; value: string | number; delta: number | null }) {
  return (
    <div className="ad-card ad-stat">
      <div className="ad-stat-ic"><I size={26} /></div>
      <div><p className="ad-muted">{label}</p><div className="ad-stat-row"><b>{value}</b><Delta v={delta} /></div><p className="ad-muted">vs. previous 7 days</p></div>
    </div>
  );
}
function Head({ title, to, extra }: { title: string; to?: AdminPath; extra?: ReactNode }) {
  return <div className="ad-head"><h3>{title}</h3>{extra}{to && <Link to={to} className="ad-view">View all <ArrowRight size={13} /></Link>}</div>;
}

function AdminDashboard() {
  const { rows: orders, loaded: ordersLoaded, error: ordersError, reload: reloadOrders } = useTable<AdminOrder>("orders");
  const { rows: merchants, loaded: merchantsLoaded, error: merchantsError, reload: reloadMerchants } = useTable<Merchant>("merchants");
  const { rows: tickets, loaded: ticketsLoaded, error: ticketsError, reload: reloadTickets } = useTable<Ticket>("support_tickets");
  const { rows: riders, loaded: ridersLoaded, error: ridersError, reload: reloadRiders } = useTable<Rider>("riders");
  const [refreshing, setRefreshing] = useState(false);

  const week = inLastDays(orders, 7), prev = inLastDays(orders, 7, Date.now(), 7);
  const custWeek = customersFromOrders(week).length, custPrev = customersFromOrders(prev).length;
  const rev = revenueOf(week), revPrev = revenueOf(prev);
  const counts = statusCounts(week);
  const totalWeek = week.length || 1;
  const chart = ordersPerDay(orders, 7);
  const activeMerchants = merchants.filter((m) => m.active).length;
  const onlineRiders = riders.filter((r) => r.online).length;
  const active = orders.filter((o) => o.rider_lat != null && ["In Transit", "Out for Delivery"].includes(o.status));
  const liveOrders = orders.filter((o) => !["Delivered", "Cancelled"].includes(o.status));
  const revRows: [string, number, string][] = [["Products", rev.products, "#ffc61a"], ["Delivery Fees", rev.delivery, "#c9d3e0"], ["Service Fees", rev.service, "#6f8296"]];
  const donutRows: [string, number, string][] = rev.total ? revRows : [["", 0, "#1c3346"]];
  const range = `${new Date(Date.now() - 6 * 864e5).toLocaleDateString("en-KE", { month: "short", day: "numeric" })} – ${new Date().toLocaleDateString("en-KE", { month: "short", day: "numeric", year: "numeric" })}`;
  const dataErrors = [ordersError, merchantsError, ticketsError, ridersError].filter((error): error is string => Boolean(error));
  const loaded = ordersLoaded && merchantsLoaded && ticketsLoaded && ridersLoaded;
  const refreshDashboard = async () => {
    setRefreshing(true);
    try {
      await Promise.all([reloadOrders(), reloadMerchants(), reloadTickets(), reloadRiders()]);
    } finally {
      setRefreshing(false);
    }
  };

  const activity: { I: LucideIcon; c: string; t: string; d: string; at: string }[] = [
    ...orders.slice(0, 6).map((o) => ({ I: ShoppingBag, c: "yellow", t: `Order #${o.id} · ${o.status}`, d: `${kes(o.total_kes)} • ${o.customer_area}`, at: o.updated_at })),
    ...tickets.slice(0, 3).map((t) => ({ I: Headphones, c: "pink", t: `Ticket #TKT-${t.ticket_no}`, d: `${t.subject} • ${t.status}`, at: t.created_at })),
    ...merchants.slice(0, 3).map((m) => ({ I: Store, c: "purple", t: "Merchant added", d: m.name, at: m.created_at })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 6);

  return (
    <>
      <div className="ad-welcome">
        <div><h1>Welcome back, <span>Admin</span> 👋</h1><p>Here's what's happening with Beez this week.</p></div>
        <div className="ad-date"><span><CalendarDays size={16} />{range}</span><button className="ad-select" onClick={() => void refreshDashboard()} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh data"}</button></div>
      </div>
      {!loaded && <p className="ad-muted" role="status">Loading dashboard data…</p>}
      {dataErrors.length > 0 && <div className="ad-card" role="alert"><b>Some dashboard data could not be loaded.</b><p className="ad-muted">{dataErrors.join(" ")}</p><button className="ad-select" onClick={() => void refreshDashboard()} disabled={refreshing}>Retry</button></div>}
      <div className="ad-grid">
        <div className="ad-left">
          <div className="ad-stats">
            <Stat icon={ShoppingBag} label="Orders (7 days)" value={week.length.toLocaleString()} delta={pctChange(week.length, prev.length)} />
            <Stat icon={Users} label="Customers (7 days)" value={custWeek.toLocaleString()} delta={pctChange(custWeek, custPrev)} />
            <Stat icon={Store} label="Active Merchants" value={activeMerchants} delta={null} />
            <div className="ad-card ad-stat2">
              <div className="ad-split"><div className="ad-stat-ic"><Bike size={24} /></div><div><p className="ad-muted">Riders online</p><b>{onlineRiders}</b><p className="ad-muted xs">of {riders.length} registered</p></div></div>
              <div className="ad-split"><div><CircleDollarSign className="ad-coin" size={24} /><p className="ad-muted">Revenue (7 days)</p><b>{kes(rev.total)}</b><p><Delta v={pctChange(rev.total, revPrev.total)} /></p></div></div>
            </div>
          </div>
          <div className="ad-row2">
            <div className="ad-card ad-overview">
              <div className="ad-head"><h3>Orders Overview</h3><span className="ad-select">Last 7 days</span></div>
              <div className="ad-ov">
                <div className="ad-chart">
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={chart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs><linearGradient id="adg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffc61a" stopOpacity={0.35} /><stop offset="100%" stopColor="#ffc61a" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid stroke="#1c3346" vertical={false} />
                      <XAxis dataKey="d" tick={{ fill: "#c5d2df", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fill: "#c5d2df", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Area type="linear" dataKey="v" stroke="#ffc61a" strokeWidth={2} fill="url(#adg)" dot={{ r: 4, fill: "#ffc61a", stroke: "#ffc61a" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="ad-legend">{Object.entries(counts).map(([n, v]) => <div key={n}><p><i style={{ background: legendColors[n as keyof typeof legendColors] }} />{n}</p><div><b>{v}</b><span>{Math.round((v / totalWeek) * 100)}%</span></div></div>)}</div>
              </div>
            </div>
            <div className="ad-card ad-rev">
              <h3>Revenue Breakdown</h3>
              <div className="ad-donut">
                <ResponsiveContainer width="100%" height={130}>
                  <PieChart><Pie data={rev.total ? revRows.map((r) => ({ v: r[1] })) : [{ v: 1 }]} dataKey="v" innerRadius={47} outerRadius={60} startAngle={90} endAngle={-270} stroke="none">{donutRows.map((r, i) => <Cell key={i} fill={r[2]} />)}</Pie></PieChart>
                </ResponsiveContainer>
                <div className="ad-donut-c"><p>KES</p><b>{rev.total.toLocaleString()}</b><span>7-day revenue</span></div>
              </div>
              {revRows.map(([n, v, c]) => <div key={n} className="ad-rev-row"><span><i style={{ background: c }} />{n}</span><span>{rev.total ? Math.round((v / rev.total) * 100) : 0}%</span><span>{kes(v)}</span></div>)}
            </div>
          </div>
          <div className="ad-row3">
            <div className="ad-card">
              <Head title="Recent Orders" to="/admin/orders" />
              <table className="ad-table"><thead><tr><th>ID</th><th>Customer</th><th>Items</th><th>Amount</th><th>Status</th><th>Time</th></tr></thead>
                <tbody>{orders.slice(0, 5).map((o) => <tr key={o.id}><td><span className="ad-dot" />#{o.id}</td><td>{o.customer_name || o.customer_area}</td><td>{o.items_summary}</td><td>{kes(o.total_kes)}</td><td><span className={`ad-pill ${pillClass(o.status)}`}>{o.status}</span></td><td>{timeAgo(o.created_at)}</td></tr>)}
                  {loaded && !orders.length && <tr><td colSpan={6} className="ad-muted">No orders yet.</td></tr>}</tbody></table>
            </div>
            <div className="ad-card ad-live-del">
              <Head title="Live Deliveries" extra={<span className="ad-muted xs">{active.length} active deliveries reporting rider locations</span>} />
              <div className="ad-map ad-map-live"><LiveMap orders={liveOrders} /></div>
              <div className="ad-map-leg"><span><MapPin size={14} className="y" />Rider</span><span><MapPin size={14} className="g" />Customer</span><span><Store size={14} className="o" />Merchant</span></div>
            </div>
          </div>
        </div>
        <div className="ad-right">
          <div className="ad-card ad-activity">
            <div className="ad-head"><h3>Live Activity</h3><span className="ad-rt"><i />Real-time</span></div>
            {activity.map((a, i) => <div key={i} className="ad-act"><span className={`ad-act-ic ${a.c}`}><a.I size={20} /></span><div><b>{a.t}</b><p>{a.d}</p></div><time>{timeAgo(a.at)}</time></div>)}
            {!activity.length && <p className="ad-muted">No activity yet.</p>}
          </div>
          <div className="ad-card ad-quick"><h3>Quick Actions</h3><div>{quick.map(([I, n, to]) => <Link key={n} to={to}><I size={20} />{n}</Link>)}</div></div>
        </div>
      </div>
      <div className="ad-bottom">
        <div className="ad-card"><Head title="Top Performing Merchants" to="/admin/merchants" />
          <table className="ad-table sm"><thead><tr><th>#</th><th>Merchant</th><th>Orders</th><th>Revenue</th></tr></thead>
            <tbody>{topMerchants(orders).map((m, i) => <tr key={m.name}><td><span className={`ad-rank r${i}`}>{i + 1}</span></td><td><span className="ad-mlogo">🏪</span>{m.name}</td><td>{m.orders}</td><td>{kes(m.revenue)}</td></tr>)}</tbody></table></div>
        <div className="ad-card"><Head title="Recent Customers" to="/admin/customers" />
          <table className="ad-table sm"><thead><tr><th>Name</th><th>Phone</th><th>Orders</th><th>Last Order</th></tr></thead>
            <tbody>{customersFromOrders(orders).slice(0, 5).map((c) => <tr key={c.key}><td><span className="ad-av-txt sm">{c.name.slice(0, 1)}</span>{c.name}</td><td>{c.phone || "—"}</td><td>{c.orders}</td><td>{timeAgo(c.last)}</td></tr>)}</tbody></table></div>
        <div className="ad-card"><Head title="Support Tickets" to="/admin/support" />
          <table className="ad-table sm"><thead><tr><th>ID</th><th>Subject</th><th>Priority</th><th>Status</th><th>Time</th></tr></thead>
            <tbody>{tickets.slice(0, 5).map((t) => <tr key={t.id}><td>#TKT-{t.ticket_no}</td><td>{t.subject}</td><td><span className={`ad-tag ${t.priority.toLowerCase()}`}>{t.priority}</span></td><td><span className={`ad-tag ${t.status.toLowerCase().replace(/\s/g, "")}`}>{t.status}</span></td><td>{timeAgo(t.created_at)}</td></tr>)}
              {ticketsLoaded && !tickets.length && <tr><td colSpan={5} className="ad-muted">No tickets.</td></tr>}</tbody></table></div>
      </div>
      <footer className="ad-foot"><span>© {new Date().getFullYear()} Beez. All rights reserved.</span><span><i />{dataErrors.length ? "Data needs attention" : loaded ? "Dashboard data loaded" : "Loading dashboard data"}</span></footer>
    </>
  );
}
