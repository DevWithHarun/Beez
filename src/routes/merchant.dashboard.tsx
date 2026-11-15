// @ts-nocheck
import { HandoverCodeButton } from "@/components/handover/HandoverCodeDialog";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Home,
  ShoppingBag,
  Package,
  Users,
  Wallet,
  ChartNoAxesCombined,
  Megaphone,
  Settings,
  Search,
  Bell,
  ChevronDown,
  Sun,
  Hand,
  Plus,
  ArrowUpRight,
  CalendarDays,
  ArrowRight,
  CreditCard,
  Share2,
  Link as LinkIcon,
  Coins,
  ClipboardList,
  CircleDollarSign,
  TrendingUp,
  Clock3,
  Star,
  UserRound,
  CheckCircle2,
  Box,
  Eye,
  Menu,
  X,
  Store,
  ShieldCheck,
  Mic,
  Clapperboard,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import beezMark from "@/assets/beez-mark.png";
import "./-merchant-dashboard.css";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { merchantQuery } from "@/lib/merchant-query";
import { requireWorkspace } from "@/lib/workspace-guard";
import {
  money,
  confirmed,
  merchantCustomers,
  merchantPaymentSummary,
} from "@/lib/merchant-data";
import {
  saveMerchantProduct,
  prepareMerchantOrder,
  saveMerchant,
  saveMerchantCampaign,
  requestMerchantPayout,
} from "@/lib/merchant.functions";
import { supabase } from "@/integrations/supabase/client";
import { VoiceProductCreator } from "@/components/VoiceProductCreator";
import { ProductPhotoStudio } from "@/components/photo-studio/ProductPhotoStudio";
import { MerchantAnalyticsTab, ProductThumb, Sparkline } from "@/components/merchant/MerchantAnalyticsTab";
import { merchantAnalytics } from "@/lib/merchant-analytics";
import { MyStoreVideoCard } from "@/components/merchant-video/MyStoreVideoCard";
import { MerchantVideosTab, productClipsQuery } from "@/components/merchant-video/MerchantVideosTab";
import { introReviewState, productReelStatus, setupChecklist } from "@/lib/reel-video";
import type { StudioSelection } from "@/components/photo-studio/ProductPhotoStudio";
import { OrderAgent, orderAgentQuery } from "@/components/order-agent/OrderAgent";
import { respondToOrder } from "@/lib/order-agent.functions";
import type { VoiceProductDraft } from "@/lib/voice-product";

function ago(iso) {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return m < 60
    ? `${Math.max(m, 0)} min ago`
    : m < 1440
      ? `${Math.round(m / 60)} hr ago`
      : `${Math.round(m / 1440)} d ago`;
}

function dateTimeInput(value) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export const Route = createFileRoute("/merchant/dashboard")({
  ssr: false,
  // Only signed-in merchants get in: others go to sign-in or business setup.
  beforeLoad: () => requireWorkspace("merchant"),
  validateSearch: (search) => (typeof search.tab === "string" && TABS.includes(search.tab) ? { tab: search.tab } : {}),
  pendingComponent: () => (
    <div className="beez-md">
      <div className="empty" style={{ padding: 40 }}>Opening your dashboard…</div>
    </div>
  ),
  head: () => ({
    meta: [
      { title: "Merchant dashboard | Beez" },
      {
        name: "description",
        content: "Your Beez merchant dashboard: sales, orders, top products and payouts.",
      },
      { property: "og:title", content: "Beez merchant dashboard" },
      { property: "og:description", content: "Manage orders, payments and customers on Beez." },
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

const nav = [
  [Home, "Home"],
  [ShoppingBag, "Orders"],
  [Package, "Products"],
  [Clapperboard, "Videos"],
  [Users, "Customers"],
  [Wallet, "Payments"],
  [ChartNoAxesCombined, "Analytics"],
  [Megaphone, "Marketing"],
  [Wallet, "Wallet"],
  [Settings, "Settings"],
];

const TABS = ["Home", "Orders", "Products", "Videos", "Customers", "Payments", "Analytics", "Marketing", "Wallet", "Settings"];

function App() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery(merchantQuery);
  const search = Route.useSearch();
  const [active, setActive] = useState(search.tab ?? "Home");
  const [productForm, setProductForm] = useState(null);
  const [productImagePreview, setProductImagePreview] = useState("");
  const [productImageError, setProductImageError] = useState("");
  const [voiceProductOpen, setVoiceProductOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [range, setRange] = useState("Today");
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [notice, setNotice] = useState("");
  const [ordersFilter, setOrdersFilter] = useState("All");
  const [campaignForm, setCampaignForm] = useState(null);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [settingsForm, setSettingsForm] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [requestingPayout, setRequestingPayout] = useState(false);
  const merchant = data?.merchant;
  const merchantId = merchant?.id;
  const clipsQuery = useQuery({ ...productClipsQuery(merchantId ?? ""), enabled: !!merchantId });
  const clips = clipsQuery.data?.clips ?? new Map();
  useEffect(() => {
    if (!productForm?.imageFile) {
      setProductImagePreview("");
      return;
    }
    const previewUrl = URL.createObjectURL(productForm.imageFile);
    setProductImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [productForm?.imageFile]);
  const closeProductForm = () => {
    setProductForm(null);
    setProductImageError("");
  };
  const action = (msg) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(""), 2600);
  };
  useEffect(() => {
    if (!merchant) return;
    setSettingsForm({
      name: merchant.name,
      area: merchant.area,
      phone: merchant.phone,
      category: merchant.category,
      business_type: merchant.business_type,
    });
  }, [merchant]);
  useEffect(() => {
    if (!merchantId) return;
    const channel = supabase
      .channel(`merchant-dashboard-${merchantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `merchant_id=eq.${merchantId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: merchantQuery.queryKey });
          void qc.invalidateQueries({ queryKey: orderAgentQuery.queryKey });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
          filter: `merchant_id=eq.${merchantId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: merchantQuery.queryKey });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "merchant_campaigns",
          filter: `merchant_id=eq.${merchantId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: merchantQuery.queryKey });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "merchant_campaign_redemptions",
          filter: `merchant_id=eq.${merchantId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: merchantQuery.queryKey });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "merchant_payout_requests",
          filter: `merchant_id=eq.${merchantId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: merchantQuery.queryKey });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "merchants",
          filter: `id=eq.${merchantId}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: merchantQuery.queryKey });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [merchantId, qc]);
  if (isLoading)
    return (
      <div className="beez-md">
        <div className="empty" style={{ padding: 40 }}>
          Loading your business…
        </div>
      </div>
    );
  if (error || !data?.merchant)
    return (
      <div className="beez-md">
        <div className="empty" style={{ padding: 40 }}>
          {error
            ? "Please sign in with your phone number to open your dashboard."
            : "Set up your business to start using the dashboard."}{" "}
          <Link to={error ? "/login" : "/onboarding/merchant"}>Continue</Link>
        </div>
      </div>
    );
  const m = data.merchant;
  // Home uses the same calculations as the Analytics tab so both always agree.
  const home = merchantAnalytics(range, data.orders, data.items, data.products);
  const sum = {
    sales: home.revenue,
    count: home.orders,
    customers: home.customers,
    average: home.average,
    chart: home.series.map((s) => ({ time: s.label, sales: s.revenue })),
  };
  const itemCount = (id) =>
    data.items.filter((i) => i.order_id === id).reduce((n, i) => n + i.quantity, 0);
  const statusOf = (o) =>
    o.status === "Delivered" || o.status === "Cancelled" || o.status === "Ready for Pickup"
      ? o.status
      : confirmed(o)
        ? "Paid"
        : "Pending";
  const orders = data.orders.map((o) => ({
    id: o.id,
    raw: o,
    name: o.customer_name || o.id,
    phone: o.customer_phone || "—",
    items: `${itemCount(o.id) || "—"} items`,
    amount: money(o.total_kes),
    payment: o.payment_method,
    status: statusOf(o),
    time: ago(o.created_at),
    avatar: "🧑🏽",
  }));
  const products = home.topProducts;
  const customers = merchantCustomers(data.orders);
  const paymentSummary = merchantPaymentSummary(data.orders);
  const availableBalance = Math.max(
    0,
    data.orders
      .filter((o) => o.status === "Delivered" && o.payment_status === "Paid")
      .reduce(
        (total, o) => total + Math.max(0, o.total_kes - o.delivery_fee_kes - o.service_fee_kes),
        0,
      ) -
      data.payouts
        .filter((p) => ["Requested", "Processing", "Paid"].includes(p.status))
        .reduce((total, p) => total + p.amount_kes, 0),
  );
  const activity = orders.slice(0, 5);
  const pendingCount = data.orders.filter((o) =>
    ["Pending", "Preparing"].includes(o.status),
  ).length;
  const hour = Number(
    new Date().toLocaleString("en-US", {
      timeZone: "Africa/Nairobi",
      hour: "numeric",
      hour12: false,
    }),
  );
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const saveProduct = async () => {
    setBusy(true);
    let uploadedPath = null;
    try {
      const { imageFile, media_id, studioUrl, unit, originalUnit, ...productValues } = productForm;
      let imageUrl = productForm.image_url || null;
      if (imageFile) {
        uploadedPath = `${merchantId}/${crypto.randomUUID()}-${imageFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(uploadedPath, imageFile, {
            cacheControl: "3600",
            contentType: imageFile.type,
            upsert: false,
          });
        if (uploadError) throw new Error(`Product image upload failed: ${uploadError.message}`);
        imageUrl = supabase.storage.from("product-images").getPublicUrl(uploadedPath)
          .data.publicUrl;
      }
      await saveMerchantProduct({
        data: {
          ...productValues,
          ...(productForm.id ? { id: productForm.id } : {}),
          image_url: imageUrl,
          description: productForm.description?.trim() || null,
          media_id: media_id || null,
          // Only send the unit when one is set or being cleared.
          ...((unit ?? "").trim() || originalUnit ? { unit: (unit ?? "").trim() } : {}),
          price_kes: Number(productForm.price_kes) || 0,
          stock: Number(productForm.stock) || 0,
        },
      });
      await qc.invalidateQueries({ queryKey: merchantQuery.queryKey });
      closeProductForm();
      action("Product saved");
    } catch (e) {
      if (uploadedPath) {
        const { error: removeError } = await supabase.storage
          .from("product-images")
          .remove([uploadedPath]);
        if (removeError)
          console.error("Could not clean up the failed product image upload", removeError);
      }
      action(e.message);
    } finally {
      setBusy(false);
    }
  };
  const publishVoiceProduct = async (draft: VoiceProductDraft, photo: StudioSelection | null) => {
    if (!draft.name?.trim() || !draft.category?.trim() || draft.price_kes === null || draft.stock === null) {
      throw new Error("Confirm the product name, category, price, and quantity before publishing.");
    }
    await saveMerchantProduct({
      data: {
        name: draft.name.trim(),
        category: draft.category.trim(),
        price_kes: draft.price_kes,
        stock: draft.stock,
        active: true,
        image_url: photo?.url ?? null,
        media_id: photo?.id ?? null,
      },
    });
    await qc.invalidateQueries({ queryKey: merchantQuery.queryKey });
    action("Product published");
  };
  const prepare = async (id, status) => {
    try {
      await prepareMerchantOrder({ data: { id, status } });
      await qc.invalidateQueries({ queryKey: merchantQuery.queryKey });
      action(status === "Cancelled" ? "Order cancelled" : "Marked ready for pickup");
    } catch (e) {
      action(e.message);
    }
  };
  const respond = async (id, decision) => {
    try {
      const result = await respondToOrder({
        data: { orderId: id, decision, channel: "touch", requestId: crypto.randomUUID() },
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: merchantQuery.queryKey }),
        qc.invalidateQueries({ queryKey: orderAgentQuery.queryKey }),
      ]);
      action(
        result.outcome === "accepted"
          ? "Order accepted — please prepare it"
          : result.outcome === "declined"
            ? "Order declined"
            : result.outcome === "expired"
              ? "Too late — this order has expired"
              : "This order is no longer waiting for a response",
      );
    } catch (e) {
      action(e.message);
    }
  };
  const newProduct = () =>
    setProductForm({
      name: "",
      category: m.category || "",
      price_kes: "",
      stock: "",
      active: true,
      image_url: null,
      description: "",
      imageFile: null,
      media_id: null,
    });
  const openCampaignForm = (campaign = null) => {
    const startsAt = campaign?.starts_at ?? new Date().toISOString();
    setCampaignForm({
      ...(campaign ?? {}),
      name: campaign?.name ?? "",
      code: campaign?.code ?? "",
      discount_type: campaign?.discount_type ?? "percent",
      discount_value: campaign?.discount_value ?? "",
      minimum_order_kes: campaign?.minimum_order_kes ?? 0,
      maximum_discount_kes: campaign?.maximum_discount_kes ?? "",
      starts_at: dateTimeInput(startsAt),
      ends_at: campaign?.ends_at
        ? dateTimeInput(campaign.ends_at)
        : dateTimeInput(Date.now() + 7 * 86400000),
      usage_limit: campaign?.usage_limit ?? "",
      active: campaign?.active ?? true,
    });
  };
  const saveCampaign = async () => {
    setSavingCampaign(true);
    try {
      await saveMerchantCampaign({
        data: {
          ...campaignForm,
          code: campaignForm.code.toUpperCase().trim(),
          discount_value: Number(campaignForm.discount_value),
          minimum_order_kes: Number(campaignForm.minimum_order_kes) || 0,
          maximum_discount_kes: campaignForm.maximum_discount_kes
            ? Number(campaignForm.maximum_discount_kes)
            : null,
          usage_limit: campaignForm.usage_limit ? Number(campaignForm.usage_limit) : null,
          starts_at: new Date(campaignForm.starts_at).toISOString(),
          ends_at: new Date(campaignForm.ends_at).toISOString(),
        },
      });
      await qc.invalidateQueries({ queryKey: merchantQuery.queryKey });
      setCampaignForm(null);
      action("Campaign saved");
    } catch (e) {
      action(e.message);
    } finally {
      setSavingCampaign(false);
    }
  };
  const saveSettings = async (event) => {
    event.preventDefault();
    setSavingSettings(true);
    try {
      await saveMerchant({ data: settingsForm });
      await qc.invalidateQueries({ queryKey: merchantQuery.queryKey });
      action("Business settings saved");
    } catch (e) {
      action(e.message);
    } finally {
      setSavingSettings(false);
    }
  };
  const submitPayout = async (event) => {
    event.preventDefault();
    const amount = Number(payoutAmount);
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > availableBalance) return;
    setRequestingPayout(true);
    try {
      await requestMerchantPayout({
        data: { amount_kes: amount, idempotency_key: crypto.randomUUID() },
      });
      setPayoutAmount("");
      await qc.invalidateQueries({ queryKey: merchantQuery.queryKey });
      action("Payout request recorded");
    } catch (e) {
      action(e.message);
    } finally {
      setRequestingPayout(false);
    }
  };
  const filteredOrders = orders.filter(
    (o) =>
      `${o.id} ${o.phone} ${o.status}`.toLowerCase().includes(query.toLowerCase()) &&
      (ordersFilter === "All" || o.status === ordersFilter),
  );
  const currentTitle = active === "Home" ? "Home" : active;
  return (
    <div className="beez-md">
      <div className="app-shell">
        <aside className={`sidebar ${mobileMenu ? "open" : ""}`}>
          <div className="logo">
            <div className="bee-mark">
              <img src={beezMark} alt="Beez" className="h-full w-full object-contain p-1.5" />
            </div>
            <span>
              Bee<span>z</span>
            </span>
            <button className="mobile-close" onClick={() => setMobileMenu(false)}>
              <X />
            </button>
          </div>
          <nav>
            {nav.map(([Icon, label]) => (
              <button
                key={label}
                className={`nav-item ${active === label ? "active" : ""}`}
                onClick={() => {
                  setActive(label);
                  setMobileMenu(false);
                }}
              >
                <Icon size={20} />
                <span>{label}</span>
                {label === "Orders" && pendingCount > 0 && <b className="count">{pendingCount}</b>}
              </button>
            ))}
          </nav>
          <div className="sidebar-promo">
            <div className="promo-bee">🐝</div>
            <h3>
              Grow your business
              <br />
              with <em>Beez</em>
            </h3>
            <p>
              More customers. More sales.
              <br />
              More growth.
            </p>
            <button onClick={() => setActive("Analytics")}>
              View Insights <ArrowRight size={15} />
            </button>
          </div>
          <div className="copyright">© {new Date().getFullYear()} Beez. All rights reserved.</div>
        </aside>
        {mobileMenu && <div className="scrim" onClick={() => setMobileMenu(false)} />}
        <div className="main-area">
          <header className="topbar">
            <button className="hamburger" onClick={() => setMobileMenu(!mobileMenu)}>
              <Menu />
            </button>
            <div className="search">
              <Search size={18} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search orders, products, or customers..."
              />
            </div>
            <div className="top-right">
              <button
                className="icon-button bell"
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <Bell size={21} />
                {pendingCount > 0 && <i>{pendingCount}</i>}
              </button>
              {showNotifications && (
                <div className="notification-pop">
                  <strong>Notifications</strong>
                  {activity.length ? (
                    activity.slice(0, 3).map((o) => (
                      <p key={o.id}>
                        Order #{o.id} · {o.amount} · {o.status}
                      </p>
                    ))
                  ) : (
                    <p>No new activity.</p>
                  )}
                </div>
              )}
              <div className="top-divider" />
              <button className="profile" onClick={() => setActive("Settings")}>
                <div className="avatar owner">👨🏽</div>
                <span>
                  <b>{m.name}</b>
                  <small>Merchant</small>
                </span>
                <ChevronDown size={17} />
              </button>
            </div>
          </header>
          <main className="content">
            <section className="greeting">
              <div>
                <h1>
                  {active === "Home" ? (
                    <>
                      <span className="wave">👋</span> {greet}, <em>{m.name}</em>
                    </>
                  ) : (
                    <>
                      <span className="wave">✦</span> {currentTitle}
                    </>
                  )}
                </h1>
                <p>
                  {active === "Home"
                    ? "Here's what's happening with your business today."
                    : `Manage your ${active.toLowerCase()} and keep your business moving.`}
                </p>
              </div>
              <button className="add-product" onClick={() => newProduct()}>
                <Plus size={18} /> Add Product
              </button>
            </section>
            {active === "Home" ? (
              <>
                <section className="metrics">
                  <Metric
                    icon={Wallet}
                    title={`Sales · ${range}`}
                    value={money(sum.sales)}
                    note="confirmed payments"
                    chart="yellow"
                    points={home.series.map((s) => s.revenue)}
                  />
                  <Metric
                    icon={ShoppingBag}
                    title="Orders"
                    value={sum.count}
                    note={range.toLowerCase()}
                    chart="green"
                    points={home.series.map((s) => s.orders)}
                  />
                  <Metric
                    icon={Users}
                    title="Customers"
                    value={sum.customers}
                    note={range.toLowerCase()}
                    chart="purple"
                    points={home.series.map((s) => s.customers)}
                  />
                  <Metric
                    icon={Coins}
                    title="Average order"
                    value={money(sum.average)}
                    note="paid orders"
                    chart="yellow"
                    points={home.series.map((s) => s.average)}
                  />
                </section>
                {(() => {
                  const list = setupChecklist({
                    intro: introReviewState(m),
                    isOpen: m.is_open !== false,
                    products: data.products.map((p) => productReelStatus(p, clips.get(p.id))),
                  });
                  if (list.every((item) => item.done)) return null;
                  return (
                    <section className="card p-5 mb-4">
                      <div className="card-title">
                        <h2>Get your shop into the reel</h2>
                        <button className="text-link" onClick={() => setActive("Videos")}>
                          Videos <ArrowRight size={14} />
                        </button>
                      </div>
                      <ul className="grid gap-2 sm:grid-cols-3">
                        {list.map((item) => (
                          <li key={item.key} className="flex items-center gap-2 text-sm">
                            {item.done ? <CheckCircle2 size={18} className="text-emerald-400" aria-label="Done" /> : <span aria-label="Not done yet" className="h-[18px] w-[18px] rounded-full border-2 border-slate-400" />}
                            <span><b>{item.label}</b><small className="block text-slate-400">{item.detail}</small></span>
                          </li>
                        ))}
                      </ul>
                      <Link to="/m/video" search={{ new: "1", start: "record" }} className="add-product mt-4 w-full py-3 text-base">
                        <Clapperboard size={20} /> New product reel
                      </Link>
                    </section>
                  );
                })()}
                <section className="middle-grid">
                  <div className="card sales-card">
                    <div className="card-title">
                      <h2>Sales Overview</h2>
                      <label className="range-select">
                        <CalendarDays size={16} />
                        <select value={range} onChange={(e) => setRange(e.target.value)}>
                          <option>Today</option>
                          <option>This week</option>
                          <option>This month</option>
                        </select>
                        <ChevronDown size={14} />
                      </label>
                    </div>
                    <div className="sales-content">
                      <div className="chart">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={sum.chart}
                            margin={{ top: 10, right: 4, left: -20, bottom: 0 }}
                          >
                            <CartesianGrid stroke="#152b3d" vertical={false} />
                            <XAxis
                              dataKey="time"
                              tick={{ fill: "#b5c5d8", fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              tick={{ fill: "#b5c5d8", fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip
                              contentStyle={{
                                background: "#071521",
                                border: "1px solid #274056",
                                borderRadius: 10,
                                color: "#fff",
                              }}
                              cursor={{ fill: "#142637" }}
                            />
                            <Bar
                              dataKey="sales"
                              fill="#ffc928"
                              radius={[1, 1, 0, 0]}
                              maxBarSize={19}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="sales-stats">
                        <div>
                          <small>Total Sales</small>
                          <strong>{money(sum.sales)}</strong>
                        </div>
                        <div>
                          <small>Total Orders</small>
                          <strong>{sum.count}</strong>
                        </div>
                        <div>
                          <small>Average Order Value</small>
                          <strong>{money(sum.average)}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="card products-card">
                    <div className="card-title">
                      <h2>Top Products</h2>
                      <button className="text-link" onClick={() => setActive("Products")}>
                        View All <ArrowRight size={14} />
                      </button>
                    </div>
                    {products.map((p) => (
                      <div className="product-row" key={p.key}>
                        <ProductThumb name={p.name} url={p.imageUrl} />
                        <div className="product-info">
                          <b>{p.name}</b>
                          <small>{p.sold} sold</small>
                        </div>
                        <strong>{money(p.revenue)}</strong>
                      </div>
                    ))}
                    {!products.length && <div className="empty">No paid sales in this period.</div>}
                  </div>
                </section>
                <section className="card orders-card">
                  <div className="card-title">
                    <h2>Recent Orders</h2>
                    <button className="text-link" onClick={() => setActive("Orders")}>
                      View All <ArrowRight size={14} />
                    </button>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Customer</th>
                          <th>Items</th>
                          <th>Amount</th>
                          <th>Payment</th>
                          <th>Status</th>
                          <th>Time</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrders.map((o) => (
                          <tr key={o.id}>
                            <td className="expand">›</td>
                            <td>
                              <div className="customer">
                                <span className="avatar">{o.avatar}</span>
                                <span>
                                  {o.name}
                                  <small>{o.phone}</small>
                                </span>
                              </div>
                            </td>
                            <td>{o.items}</td>
                            <td>{o.amount}</td>
                            <td>
                              <span className="mpesa">▣</span> {o.payment}
                            </td>
                            <td>
                              <Status status={o.status} />
                            </td>
                            <td>{o.time}</td>
                            <td>
                              <button
                                className="view-btn"
                                onClick={() => action(`Opened order ${o.id}`)}
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredOrders.length === 0 && (
                      <div className="empty">
                        {orders.length ? "No matching orders found." : "No orders yet."}
                      </div>
                    )}
                  </div>
                </section>
              </>
            ) : (
              <MerchantTab
                active={active}
                query={query}
                data={data}
                orders={orders}
                filteredOrders={filteredOrders}
                ordersFilter={ordersFilter}
                onOrdersFilter={setOrdersFilter}
                onPrepare={prepare}
                onRespond={respond}
                onProductEdit={setProductForm}
                onAddProduct={newProduct}
                onVoiceCreate={() => setVoiceProductOpen(true)}
                customers={customers}
                paymentSummary={paymentSummary}
                availableBalance={availableBalance}
                payoutAmount={payoutAmount}
                onPayoutAmount={setPayoutAmount}
                onPayout={submitPayout}
                requestingPayout={requestingPayout}
                campaignForm={campaignForm}
                onOpenCampaign={openCampaignForm}
                onCampaignForm={setCampaignForm}
                onSaveCampaign={saveCampaign}
                savingCampaign={savingCampaign}
                settingsForm={settingsForm}
                onSettingsForm={setSettingsForm}
                onSaveSettings={saveSettings}
                savingSettings={savingSettings}
                onNotice={action}
                clips={clips}
                onSignOut={async () => {
                  const { error: signOutError } = await supabase.auth.signOut();
                  if (signOutError) action(signOutError.message);
                  else window.location.assign("/login");
                }}
              />
            )}
          </main>
        </div>
        <aside className="rightbar">
          <div className="right-top-space">
            <div className="decor-strip"></div>
            <button className="add-product" onClick={() => newProduct()}>
              <Plus size={18} /> Add Product
            </button>
          </div>
          <div className="card quick-card">
            <h2>Quick Actions</h2>
            <div className="quick-grid">
              <Quick icon={Box} label="Add Product" onClick={() => newProduct()} />
              <Quick icon={ClipboardList} label="View Orders" onClick={() => setActive("Orders")} />
              <Quick icon={Store} label="Manage Products" onClick={() => setActive("Products")} />
              <Quick icon={LinkIcon} label="View Payments" onClick={() => setActive("Payments")} />
              <Quick icon={Clapperboard} label="Videos" onClick={() => setActive("Videos")} />
            </div>
          </div>
          <div className="card activity-card">
            <div className="card-title">
              <h2>Recent Activity</h2>
              <button className="text-link" onClick={() => setActive("Orders")}>
                View All <ArrowRight size={14} />
              </button>
            </div>
            {activity.map((a) => (
              <div className="activity-row" key={a.id}>
                <div className="activity-icon green">
                  <ShoppingBag size={17} />
                </div>
                <div className="activity-copy">
                  <b>Order #{a.id}</b>
                  <small>
                    {a.amount} · {a.time}
                  </small>
                </div>
                <Status status={a.status} />
              </div>
            ))}
            {!activity.length && <div className="empty">No activity yet.</div>}
          </div>
          <div className="merchant-ad">
            <div className="ad-photo">
              <span>🌿</span>
              <span>🥬</span>
              <span>🍅</span>
            </div>
            <div className="ad-content">
              <div className="ad-brand">
                <span>🐝</span> Beez
              </div>
              <h2>
                More sales,
                <br />
                <em>less hassle.</em>
              </h2>
              <p>Get paid instantly, track your orders and grow your business with Beez.</p>
              <button onClick={() => setActive("Analytics")}>
                Learn More <ArrowRight size={15} />
              </button>
            </div>
          </div>
          <div className="right-footer">
            <a onClick={() => action("Help center opened")}>Help</a>
            <span>|</span>
            <a onClick={() => action("Terms opened")}>Terms</a>
            <span>|</span>
            <a onClick={() => action("Privacy opened")}>Privacy</a>
          </div>
        </aside>
        {notice && (
          <div className="toast">
            <CheckCircle2 size={18} />
            {notice}
          </div>
        )}
        <OrderAgent
          onChanged={() => void qc.invalidateQueries({ queryKey: merchantQuery.queryKey })}
        />
        {voiceProductOpen && (
          <VoiceProductCreator
            merchantId={merchantId}
            onClose={() => setVoiceProductOpen(false)}
            onPublish={publishVoiceProduct}
          />
        )}
        {productForm && (
          <div className="modal-backdrop" onClick={closeProductForm}>
            <div className="withdraw-modal product-modal" onClick={(e) => e.stopPropagation()}>
              <button className="modal-x" onClick={closeProductForm}>
                <X />
              </button>
              <div className="metric-icon">
                <Box />
              </div>
              <h2>{productForm.id ? "Edit product" : "Add product"}</h2>
              <label htmlFor="merchant-product-name">Name</label>
              <input
                id="merchant-product-name"
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
              />
              <ProductPhotoStudio
                merchantId={merchantId}
                productName={productForm.name}
                currentImageUrl={productForm.image_url}
                onSelect={(photo) =>
                  setProductForm((form) =>
                    form ? { ...form, media_id: photo?.id ?? null, studioUrl: photo?.url ?? null } : form,
                  )
                }
                onAnalysis={(analysis) =>
                  setProductForm((form) =>
                    form
                      ? {
                          ...form,
                          name: form.name.trim() ? form.name : analysis.name ?? form.name,
                          category: form.category.trim() ? form.category : analysis.category ?? form.category,
                          description: form.description?.trim()
                            ? form.description
                            : analysis.description ?? form.description,
                        }
                      : form,
                  )
                }
              />
              {!productForm.image_url && !productForm.studioUrl && !productForm.imageFile && (
                <p className="reel-photo-nudge" role="note">📸 Add a photo to appear in the reel</p>
              )}
              <label htmlFor="merchant-product-description">Description</label>
              <textarea
                id="merchant-product-description"
                className="product-description-input"
                rows={2}
                maxLength={600}
                placeholder="Short description customers will read"
                value={productForm.description ?? ""}
                onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
              />
              <div className="product-fields-grid">
                <div className="product-form-field product-category-field">
                  <label htmlFor="merchant-product-category">Category</label>
                  <input
                    id="merchant-product-category"
                    placeholder="e.g. Groceries"
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                  />
                </div>
                <div className="product-form-field">
                  <label htmlFor="merchant-product-price">Price (KES)</label>
                  <input
                    id="merchant-product-price"
                    inputMode="numeric"
                    placeholder="0"
                    value={productForm.price_kes}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        price_kes: e.target.value.replace(/\D/g, ""),
                      })
                    }
                  />
                </div>
                <div className="product-form-field">
                  <label htmlFor="merchant-product-unit">Unit (optional)</label>
                  <input
                    id="merchant-product-unit"
                    placeholder="e.g. kg, bunch"
                    maxLength={30}
                    value={productForm.unit ?? ""}
                    onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                  />
                </div>
                <div className="product-form-field">
                  <label htmlFor="merchant-product-stock">Stock quantity</label>
                  <input
                    id="merchant-product-stock"
                    inputMode="numeric"
                    placeholder="0"
                    value={productForm.stock}
                    onChange={(e) =>
                      setProductForm({
                        ...productForm,
                        stock: e.target.value.replace(/\D/g, ""),
                      })
                    }
                  />
                </div>
              </div>
              <label className="product-visibility">
                <input
                  type="checkbox"
                  checked={productForm.active}
                  onChange={(e) => setProductForm({ ...productForm, active: e.target.checked })}
                />{" "}
                Visible to customers
              </label>
              <button
                className="primary-button"
                disabled={
                  busy ||
                  !productForm.name.trim() ||
                  !productForm.category.trim() ||
                  Boolean(productImageError)
                }
                onClick={saveProduct}
              >
                {busy ? "Saving…" : "Save product"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MerchantTab({
  active,
  query,
  data,
  orders,
  filteredOrders,
  ordersFilter,
  onOrdersFilter,
  onPrepare,
  onRespond,
  onProductEdit,
  onAddProduct,
  onVoiceCreate,
  customers,
  paymentSummary,
  availableBalance,
  payoutAmount,
  onPayoutAmount,
  onPayout,
  requestingPayout,
  campaignForm,
  onOpenCampaign,
  onCampaignForm,
  onSaveCampaign,
  savingCampaign,
  settingsForm,
  onSettingsForm,
  onSaveSettings,
  savingSettings,
  onNotice,
  onSignOut,
  clips,
}) {
  const title = active;
  const inputClass = "w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-3 text-white";
  const cardClass = "card p-5";
  const filteredCustomers = customers.filter((customer) =>
    `${customer.name} ${customer.phone}`.toLowerCase().includes(query.toLowerCase()),
  );
  const totalPaid = paymentSummary.paidTotal;
  const reserved = data.payouts
    .filter((payout) => ["Requested", "Processing", "Paid"].includes(payout.status))
    .reduce((sum, payout) => sum + payout.amount_kes, 0);
  const paidOrders = data.orders.filter(confirmed);
  const redemptionCounts = data.redemptions.reduce((counts, redemption) => {
    counts[redemption.campaign_id] = (counts[redemption.campaign_id] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <section className="card section-view">
      <div className="section-head">
        <h2>{title}</h2>
        <p>
          {active === "Orders"
            ? "Review new orders and prepare them for rider pickup."
            : active === "Products"
              ? "Keep your live catalogue and stock accurate."
              : active === "Videos"
                ? "Your shop intro and product reel videos. Products with a video show first."
              : active === "Customers"
                ? "See customers and their recorded purchase history."
                : active === "Payments"
                  ? "Reconcile customer payment status against recorded orders."
                  : active === "Analytics"
                    ? "Performance calculated from your recorded orders."
                    : active === "Marketing"
                      ? "Create discount campaigns and track their redemptions."
                      : active === "Wallet"
                        ? "Track paid earnings and request a merchant payout."
                        : "Manage your business details and account session."}
        </p>
      </div>

      {active === "Orders" && (
        <>
          <div className="filter-row">
            {["All", "Pending", "Paid", "Ready for Pickup", "Delivered", "Cancelled"].map(
              (filter) => (
                <button
                  className={ordersFilter === filter ? "chosen" : ""}
                  onClick={() => onOrdersFilter(filter)}
                  key={filter}
                >
                  {filter}
                </button>
              ),
            )}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id}>
                    <td>#{order.id}</td>
                    <td>
                      <div className="customer">
                        <span className="avatar">{order.avatar}</span>
                        <span>
                          {order.name}
                          <small>{order.phone}</small>
                        </span>
                      </div>
                    </td>
                    <td>{order.items}</td>
                    <td>{order.amount}</td>
                    <td>
                      {order.payment} · {order.raw.payment_status}
                    </td>
                    <td>
                      <Status status={order.raw.status} />
                    </td>
                    <td>{order.time}</td>
                    <td>
                      {order.raw.merchant_response === "awaiting" &&
                      order.raw.status === "Pending" ? (
                        <>
                          <button
                            className="view-btn"
                            onClick={() => onRespond(order.id, "accept")}
                          >
                            Accept
                          </button>{" "}
                          <button
                            className="view-btn"
                            onClick={() => onRespond(order.id, "decline")}
                          >
                            Decline
                          </button>
                        </>
                      ) : ["Pending", "Preparing"].includes(order.raw.status) &&
                      !order.raw.rider_id ? (
                        <>
                          <button
                            className="view-btn"
                            onClick={() => onPrepare(order.id, "Ready for Pickup")}
                          >
                            Ready
                          </button>{" "}
                          <button
                            className="view-btn"
                            onClick={() => onPrepare(order.id, "Cancelled")}
                          >
                            Cancel
                          </button>
                        </>
                      ) : order.raw.status === "Assigned" && order.raw.rider_id ? (
                        <HandoverCodeButton
                          className="view-btn inline-flex items-center gap-1"
                          orderId={order.id}
                          kind="pickup"
                          status={order.raw.status}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredOrders.length && (
              <div className="empty">
                {orders.length ? "No orders match this filter." : "No orders yet."}
              </div>
            )}
          </div>
        </>
      )}

      {active === "Products" && (
        <>
          <div className="metrics">
            <Metric
              icon={Package}
              title="Products"
              value={data.products.length}
              note="in your catalogue"
              chart="yellow"
            />
            <Metric
              icon={Eye}
              title="Visible"
              value={data.products.filter((product) => product.active).length}
              note="available to customers"
              chart="green"
            />
            <Metric
              icon={Box}
              title="Low stock"
              value={data.products.filter((product) => product.stock <= 5).length}
              note="5 units or fewer"
              chart="purple"
            />
            <Metric
              icon={Coins}
              title="Out of stock"
              value={data.products.filter((product) => product.stock === 0).length}
              note="check inventory"
              chart="none"
            />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Visibility</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <span className="flex items-center gap-3">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt=""
                            className="h-10 w-10 rounded-lg object-cover"
                          />
                        ) : null}
                        <span>
                          {product.name}
                          {clips.get(product.id) ? (
                            <small className="ml-1 rounded bg-white/10 px-1" title="Has a reel video">▶</small>
                          ) : null}
                          {productReelStatus(product, clips.get(product.id)).nudge ? (
                            <small className="block text-slate-400">Photo only · Add video to rank higher</small>
                          ) : null}
                        </span>
                      </span>
                    </td>
                    <td>{product.category}</td>
                    <td>{money(product.price_kes)}</td>
                    <td>
                      {product.stock}
                      {product.stock <= 5 ? (
                        <small className="block text-amber-300">Low stock</small>
                      ) : null}
                    </td>
                    <td>
                      <Status status={product.active ? "Active" : "Hidden"} />
                    </td>
                    <td>
                      <button
                        className="view-btn"
                        onClick={() =>
                          onProductEdit({
                            id: product.id,
                            name: product.name,
                            category: product.category,
                            price_kes: product.price_kes,
                            stock: product.stock,
                            active: product.active,
                            image_url: product.image_url,
                            description: product.description ?? "",
                            unit: product.unit ?? "",
                            originalUnit: product.unit ?? "",
                            imageFile: null,
                            media_id: null,
                          })
                        }
                      >
                        Edit
                      </button>
                      <Link
                        to="/m/video"
                        search={{ product: product.id, start: "record" }}
                        className="view-btn ml-2 inline-flex"
                      >
                        {clips.get(product.id) ? "🎬 Replace video" : "🎬 Add reel video"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.products.length && (
              <div className="empty">No products yet. Add a product to start your catalogue.</div>
            )}
          </div>
          <div className="product-action-row">
            <button className="add-product" onClick={onAddProduct}>
              <Plus size={16} /> Add product
            </button>
            <button className="voice-product-launch" onClick={onVoiceCreate}>
              <Mic size={17} /> Create with Voice AI
            </button>
          </div>
        </>
      )}

      {active === "Videos" && (
        <MerchantVideosTab merchant={data.merchant} products={data.products} onNotice={onNotice} />
      )}

      {active === "Customers" && (
        <>
          <div className="metrics">
            <Metric
              icon={Users}
              title="Customers"
              value={customers.length}
              note="unique recorded profiles"
              chart="yellow"
            />
            <Metric
              icon={ShoppingBag}
              title="Returning"
              value={customers.filter((customer) => customer.orders > 1).length}
              note="more than one order"
              chart="green"
            />
            <Metric
              icon={Wallet}
              title="Paid sales"
              value={money(totalPaid)}
              note="product revenue"
              chart="purple"
            />
            <Metric
              icon={Star}
              title="Paid orders"
              value={paidOrders.length}
              note="confirmed payments"
              chart="none"
            />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Orders</th>
                  <th>Paid orders</th>
                  <th>Paid total</th>
                  <th>Last order</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr key={customer.key}>
                    <td>{customer.name}</td>
                    <td>{customer.phone || "—"}</td>
                    <td>{customer.orders}</td>
                    <td>{customer.paidOrders}</td>
                    <td>{money(customer.paidTotal)}</td>
                    <td>{ago(customer.lastOrderAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredCustomers.length && (
              <div className="empty">No matching customer records yet.</div>
            )}
          </div>
        </>
      )}

      {active === "Payments" && (
        <>
          <div className="metrics">
            <Metric
              icon={CheckCircle2}
              title="Confirmed"
              value={money(paymentSummary.paidTotal)}
              note={`${paymentSummary.paid.length} paid orders`}
              chart="green"
            />
            <Metric
              icon={Clock3}
              title="Awaiting payment"
              value={money(paymentSummary.pendingTotal)}
              note={`${paymentSummary.pending.length} orders not paid`}
              chart="yellow"
            />
            <Metric
              icon={CircleDollarSign}
              title="Average paid order"
              value={money(
                paymentSummary.paid.length
                  ? Math.round(paymentSummary.paidTotal / paymentSummary.paid.length)
                  : 0,
              )}
              note="excluding delivery and service fees"
              chart="purple"
            />
            <Metric
              icon={CreditCard}
              title="Payment methods"
              value={new Set(paymentSummary.paid.map((order) => order.payment_method)).size}
              note="used for paid orders"
              chart="none"
            />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Method</th>
                  <th>Payment state</th>
                  <th>Order state</th>
                  <th>Product revenue</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.map((order) => (
                  <tr key={order.id}>
                    <td>#{order.id}</td>
                    <td>{order.customer_name || order.customer_phone || "Guest"}</td>
                    <td>{order.payment_method}</td>
                    <td>
                      <Status status={order.payment_status} />
                    </td>
                    <td>
                      <Status status={order.status} />
                    </td>
                    <td>
                      {money(
                        confirmed(order)
                          ? Math.max(
                              0,
                              order.total_kes - order.delivery_fee_kes - order.service_fee_kes,
                            )
                          : 0,
                      )}
                    </td>
                    <td>{ago(order.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.orders.length && (
              <div className="empty">Payment records will appear when orders are placed.</div>
            )}
          </div>
          <p className="mt-4 text-sm text-slate-400">
            Payment status comes from order records; this dashboard does not mark provider payments
            as paid.
          </p>
        </>
      )}

      {active === "Analytics" && (
        <MerchantAnalyticsTab orders={data.orders} items={data.items} products={data.products} />
      )}

      {active === "Marketing" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <b>{data.campaigns.length} campaigns</b>
              <p className="text-sm text-slate-400">
                Redemptions are read from recorded order promotions.
              </p>
            </div>
            <button className="add-product" onClick={() => onOpenCampaign()}>
              <Plus size={16} /> Create campaign
            </button>
          </div>
          {campaignForm && (
            <form
              className={`${cardClass} grid gap-3 mb-5 sm:grid-cols-2`}
              onSubmit={(event) => {
                event.preventDefault();
                void onSaveCampaign();
              }}
            >
              <label className="grid gap-2">
                Campaign name
                <input
                  className={inputClass}
                  required
                  maxLength={120}
                  value={campaignForm.name}
                  onChange={(event) =>
                    onCampaignForm({ ...campaignForm, name: event.target.value })
                  }
                />
              </label>
              <label className="grid gap-2">
                Promo code
                <input
                  className={inputClass}
                  required
                  maxLength={40}
                  value={campaignForm.code}
                  onChange={(event) =>
                    onCampaignForm({
                      ...campaignForm,
                      code: event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""),
                    })
                  }
                />
              </label>
              <label className="grid gap-2">
                Discount type
                <select
                  className={inputClass}
                  value={campaignForm.discount_type}
                  onChange={(event) =>
                    onCampaignForm({ ...campaignForm, discount_type: event.target.value })
                  }
                >
                  <option value="percent">Percent</option>
                  <option value="fixed">Fixed KES</option>
                </select>
              </label>
              <label className="grid gap-2">
                Discount amount
                <input
                  className={inputClass}
                  required
                  type="number"
                  min="1"
                  max={campaignForm.discount_type === "percent" ? 100 : undefined}
                  value={campaignForm.discount_value}
                  onChange={(event) =>
                    onCampaignForm({ ...campaignForm, discount_value: event.target.value })
                  }
                />
              </label>
              <label className="grid gap-2">
                Minimum order (KES)
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  value={campaignForm.minimum_order_kes}
                  onChange={(event) =>
                    onCampaignForm({ ...campaignForm, minimum_order_kes: event.target.value })
                  }
                />
              </label>
              <label className="grid gap-2">
                Maximum discount (optional)
                <input
                  className={inputClass}
                  type="number"
                  min="1"
                  value={campaignForm.maximum_discount_kes}
                  onChange={(event) =>
                    onCampaignForm({ ...campaignForm, maximum_discount_kes: event.target.value })
                  }
                />
              </label>
              <label className="grid gap-2">
                Starts
                <input
                  className={inputClass}
                  type="datetime-local"
                  required
                  value={campaignForm.starts_at}
                  onChange={(event) =>
                    onCampaignForm({ ...campaignForm, starts_at: event.target.value })
                  }
                />
              </label>
              <label className="grid gap-2">
                Ends
                <input
                  className={inputClass}
                  type="datetime-local"
                  required
                  value={campaignForm.ends_at}
                  onChange={(event) =>
                    onCampaignForm({ ...campaignForm, ends_at: event.target.value })
                  }
                />
              </label>
              <label className="grid gap-2">
                Usage limit (optional)
                <input
                  className={inputClass}
                  type="number"
                  min="1"
                  value={campaignForm.usage_limit}
                  onChange={(event) =>
                    onCampaignForm({ ...campaignForm, usage_limit: event.target.value })
                  }
                />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={campaignForm.active}
                  onChange={(event) =>
                    onCampaignForm({ ...campaignForm, active: event.target.checked })
                  }
                />{" "}
                Active
              </label>
              <div className="flex gap-2 sm:col-span-2">
                <button className="add-product" type="submit" disabled={savingCampaign}>
                  {savingCampaign ? "Saving…" : "Save campaign"}
                </button>
                <button className="view-btn" type="button" onClick={() => onCampaignForm(null)}>
                  Cancel
                </button>
              </div>
            </form>
          )}
          <div className="grid gap-3">
            {data.campaigns.map((campaign) => {
              const redemptionCount = redemptionCounts[campaign.id] ?? 0;
              const isLive =
                campaign.active &&
                Date.parse(campaign.starts_at) <= Date.now() &&
                Date.parse(campaign.ends_at) > Date.now() &&
                (campaign.usage_limit === null || redemptionCount < campaign.usage_limit);
              return (
                <article
                  className={`${cardClass} flex flex-wrap items-center justify-between gap-4`}
                  key={campaign.id}
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <b>{campaign.name}</b>
                      <Status status={isLive ? "Active" : "Paused"} />
                    </div>
                    <p className="mt-2 text-sm text-slate-300">
                      Code <strong>{campaign.code}</strong> ·{" "}
                      {campaign.discount_type === "percent"
                        ? `${campaign.discount_value}%`
                        : money(campaign.discount_value)}{" "}
                      off · {redemptionCount} redemptions
                    </p>
                    <small className="text-slate-400">
                      Ends {new Date(campaign.ends_at).toLocaleString()}
                    </small>
                  </div>
                  <button className="view-btn" onClick={() => onOpenCampaign(campaign)}>
                    Edit
                  </button>
                </article>
              );
            })}
            {!data.campaigns.length && <div className="empty">No campaigns created yet.</div>}
          </div>
          <section className={`${cardClass} mt-5`}>
            <h3 className="font-semibold mb-3">Recent redemptions</h3>
            {data.redemptions.slice(0, 10).map((redemption) => (
              <div className="activity-row" key={redemption.id}>
                <div className="activity-icon green">
                  <Megaphone size={17} />
                </div>
                <div className="activity-copy">
                  <b>{redemption.code}</b>
                  <small>
                    Order #{redemption.order_id} · {money(redemption.discount_kes)} discount
                  </small>
                </div>
                <time>{ago(redemption.created_at)}</time>
              </div>
            ))}
            {!data.redemptions.length && <p className="empty">No campaign redemptions recorded.</p>}
          </section>
        </>
      )}

      {active === "Wallet" && (
        <>
          <div className="metrics">
            <Metric
              icon={Coins}
              title="Paid earnings"
              value={money(
                data.orders
                  .filter(
                    (order) => order.status === "Delivered" && order.payment_status === "Paid",
                  )
                  .reduce(
                    (sum, order) =>
                      sum +
                      Math.max(0, order.total_kes - order.delivery_fee_kes - order.service_fee_kes),
                    0,
                  ),
              )}
              note="delivered, paid orders only"
              chart="green"
            />
            <Metric
              icon={Wallet}
              title="Available"
              value={money(availableBalance)}
              note="after existing reservations"
              chart="yellow"
            />
            <Metric
              icon={Clock3}
              title="Reserved"
              value={money(reserved)}
              note="pending or paid payouts"
              chart="purple"
            />
            <Metric
              icon={CircleDollarSign}
              title="Payout requests"
              value={data.payouts.length}
              note="all recorded requests"
              chart="none"
            />
          </div>
          <form
            className={`${cardClass} max-w-2xl grid gap-3 sm:grid-cols-[1fr_auto]`}
            onSubmit={onPayout}
          >
            <label className="grid gap-2">
              Request a payout (KES)
              <input
                className={inputClass}
                required
                type="number"
                min="1"
                max={availableBalance}
                step="1"
                value={payoutAmount}
                onChange={(event) => onPayoutAmount(event.target.value)}
                placeholder="Enter amount"
              />
            </label>
            <button
              className="add-product self-end"
              disabled={
                requestingPayout ||
                !Number.isSafeInteger(Number(payoutAmount)) ||
                Number(payoutAmount) < 1 ||
                Number(payoutAmount) > availableBalance
              }
            >
              {requestingPayout ? "Submitting…" : "Request payout"} <ArrowRight size={16} />
            </button>
            <p className="text-xs text-slate-400 sm:col-span-2">
              This records a payout request for processing. It does not initiate a transfer; confirm
              settlement with your payment operations team.
            </p>
          </form>
          <div className="table-wrap mt-5">
            <table>
              <thead>
                <tr>
                  <th>Requested</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Provider reference</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {data.payouts.map((payout) => (
                  <tr key={payout.id}>
                    <td>{new Date(payout.created_at).toLocaleString()}</td>
                    <td>{money(payout.amount_kes)}</td>
                    <td>
                      <Status status={payout.status} />
                    </td>
                    <td>{payout.provider_reference || "—"}</td>
                    <td>{payout.failure_reason || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.payouts.length && <div className="empty">No payout requests yet.</div>}
          </div>
        </>
      )}

      {active === "Settings" && settingsForm && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <MyStoreVideoCard merchant={data.merchant} onNotice={onNotice} />
          </div>
          <form className={`${cardClass} grid gap-3`} onSubmit={onSaveSettings}>
            <h3 className="font-semibold">Business profile</h3>
            {[
              ["name", "Business name"],
              ["area", "Area / location"],
              ["phone", "Contact phone"],
              ["category", "Category"],
              ["business_type", "Business type"],
            ].map(([key, label]) => (
              <label className="grid gap-2" key={key}>
                {label}
                <input
                  className={inputClass}
                  required={key !== "phone"}
                  maxLength={key === "area" ? 200 : 120}
                  value={settingsForm[key] ?? ""}
                  onChange={(event) =>
                    onSettingsForm({ ...settingsForm, [key]: event.target.value })
                  }
                />
              </label>
            ))}
            <button className="add-product mt-2" type="submit" disabled={savingSettings}>
              {savingSettings ? "Saving…" : "Save business profile"} <CheckCircle2 size={16} />
            </button>
          </form>
          <section className={cardClass}>
            <h3 className="font-semibold">Account</h3>
            <p className="mt-2 text-sm text-slate-300">
              Your merchant dashboard is connected to your signed-in Beez account. Sign out when
              you’re finished using this device.
            </p>
            <button className="view-btn mt-4" onClick={onSignOut}>
              <ArrowRight size={15} /> Sign out
            </button>
          </section>
        </div>
      )}
    </section>
  );
}

// Trend lines are drawn only from real figures passed in `points`; cards without them show none.
function Metric({ icon: Icon, title, value, note, chart, points = [] }) {
  return (
    <div className="metric-card">
      <div className="metric-heading">
        <span className="metric-icon">
          <Icon size={20} />
        </span>
        <span>{title}</span>
      </div>
      <strong>{value}</strong>
      <div className="growth">{note}</div>
      <Sparkline points={points} tone={chart} />
    </div>
  );
}
function Status({ status }) {
  return <span className={`status ${status.toLowerCase()}`}>{status}</span>;
}
function Quick({ icon: Icon, label, onClick }) {
  return (
    <button className="quick-action" onClick={onClick}>
      <Icon size={22} />
      <span>{label}</span>
    </button>
  );
}
