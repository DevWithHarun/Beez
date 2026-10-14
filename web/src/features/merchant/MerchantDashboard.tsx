import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ClipboardList, Mic, Package, Store, Wallet } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { getMerchantDashboard } from "./api";

export default function MerchantDashboard({
  onOpenShop,
  onOpenOrders,
  onOpenEarnings,
  onOpenVoiceProducts,
}: {
  onOpenShop: () => void;
  onOpenOrders: () => void;
  onOpenEarnings: () => void;
  onOpenVoiceProducts?: () => void;
}) {
  const dashboardQuery = useQuery({
    queryKey: ["merchant", "dashboard"],
    queryFn: getMerchantDashboard,
    refetchInterval: 30_000,
    retry: false,
  });

  if (dashboardQuery.isPending) {
    return (
      <div className="role-dashboard" role="status">
        <p className="role-dashboard-intro">Loading your shop overview…</p>
      </div>
    );
  }

  if (dashboardQuery.isError) {
    return (
      <div className="role-dashboard" role="alert">
        <span className="role-workspace-eyebrow">MERCHANT HOME</span>
        <h1>Your shop overview couldn’t load</h1>
        <p className="role-dashboard-intro">{dashboardQuery.error.message}</p>
        <button
          className="role-dashboard-action"
          type="button"
          onClick={() => void dashboardQuery.refetch()}
        >
          Try again
        </button>
      </div>
    );
  }

  const dashboard = dashboardQuery.data;
  const shop = dashboard.shop;
  const orderSummary = dashboard.orders;
  const shopStatus = shop
    ? shop.status === "ACTIVE"
      ? shop.isOpen
        ? "open"
        : "closed"
      : shop.status.replaceAll("_", " ").toLowerCase()
    : "not set up";

  return (
    <div className="role-dashboard">
      <span className="role-workspace-eyebrow">MERCHANT HOME</span>
      <h1>Welcome{shop ? ` to ${shop.businessName}` : " to your shop"}</h1>
      <p className="role-dashboard-intro">
        {shop
          ? "Here’s a quick look at your shop. Manage your catalogue or check what’s available in your workspace."
          : "Set up your shop to start building your product catalogue."}
      </p>

      <div className="merchant-dashboard-stats">
        <article className="merchant-dashboard-stat">
          <span>Shop status</span>
          <strong>{shopStatus}</strong>
          {shop && <small>{shop.zoneName}</small>}
        </article>
        <article className="merchant-dashboard-stat">
          <span>Products</span>
          <strong>{shop ? dashboard.productCount : "—"}</strong>
          <small>{shop ? "In your catalogue" : "After shop setup"}</small>
        </article>
        <article className="merchant-dashboard-stat">
          <span>In stock</span>
          <strong>{shop ? dashboard.inStockProductCount : "—"}</strong>
          <small>Products marked in stock</small>
        </article>
        <article className="merchant-dashboard-stat">
          <span>Today’s paid sales</span>
          <strong>KES {dashboard.today.paidMerchandiseKesToday.toLocaleString("en-KE")}</strong>
          <small>{dashboard.today.paidOrdersToday} paid orders today</small>
        </article>
        <article className="merchant-dashboard-stat">
          <span>Available earnings</span>
          <strong>
            {dashboard.earnings
              ? `KES ${dashboard.earnings.availableKes.toLocaleString("en-KE")}`
              : "—"}
          </strong>
          <small>From completed deliveries</small>
        </article>
        <article className="merchant-dashboard-stat">
          <span>Paid merchandise this month</span>
          <strong>KES {orderSummary.paidMerchandiseKesThisMonth.toLocaleString("en-KE")}</strong>
          <small>{orderSummary.paidOrdersThisMonth} paid orders</small>
        </article>
        <article className="merchant-dashboard-stat">
          <span>Preparing</span>
          <strong>{orderSummary.preparingCount}</strong>
          <small>Paid orders being prepared</small>
        </article>
        <article className="merchant-dashboard-stat">
          <span>Ready for pickup</span>
          <strong>{orderSummary.readyCount}</strong>
          <small>Orders awaiting collection</small>
        </article>
      </div>

      <div className="merchant-dashboard-section">
        <h2>Quick actions</h2>
        <div className="role-dashboard-cards">
          <button className="role-dashboard-card" type="button" onClick={onOpenOrders}>
            <ClipboardList size={20} aria-hidden="true" />
            <strong>
              {orderSummary.preparingCount
                ? `Orders waiting · ${orderSummary.preparingCount}`
                : "Voice Orders"}
            </strong>
            <span>
              {`${orderSummary.preparingCount} preparing · ${orderSummary.readyCount} ready for pickup.`}
            </span>
          </button>
          <button className="role-dashboard-card" type="button" onClick={onOpenShop}>
            <Store size={20} aria-hidden="true" />
            <strong>{shop ? "Manage shop & products" : "Set up your shop"}</strong>
            <span>
              {shop
                ? "Update shop details and manage your catalogue."
                : "Add your shop details and products."}
            </span>
          </button>
          {shop && onOpenVoiceProducts && (
            <button className="role-dashboard-card" type="button" onClick={onOpenVoiceProducts}>
              <Mic size={20} aria-hidden="true" />
              <strong>Add products by voice</strong>
              <span>Speak product names and prices, then review before adding.</span>
            </button>
          )}
          <button className="role-dashboard-card" type="button" onClick={onOpenEarnings}>
            <Wallet size={20} aria-hidden="true" />
            <strong>Withdraw earnings</strong>
            <span>Check your available balance and request an M-Pesa payout.</span>
          </button>
          {shop?.status === "ACTIVE" && (
            <Link
              className="role-dashboard-card merchant-dashboard-link"
              to="/m/$slug"
              params={{ slug: shop.slug }}
            >
              <ArrowUpRight size={20} aria-hidden="true" />
              <strong>View public shop</strong>
              <span>See the shop as customers can view it.</span>
            </Link>
          )}
        </div>
      </div>

      <div className="merchant-dashboard-notice">
        <Package size={19} aria-hidden="true" />
        <p>Totals include confirmed paid merchandise only; delivery fees are excluded.</p>
      </div>
    </div>
  );
}
