import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Banknote,
  BellRing,
  Clock3,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Store,
  Users,
  WalletCards,
} from "lucide-react";
import { useEffect, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import {
  approveRider,
  changeUserStatus,
  confirmWithdrawal,
  confirmRefund,
  failRefund,
  getAdminAudit,
  getAdminLedger,
  getAdminUsers,
  getExceptions,
  getOperationsSummary,
  getOrderTimeline,
  getOrders,
  getPayments,
  getPendingMerchants,
  getPendingRefunds,
  getPendingRiders,
  getPendingWithdrawals,
  rejectWithdrawal,
  reviewMerchant,
  reviewWithdrawal,
} from "./api";
import {
  clearAdminSession,
  getAdminSession,
  loginAdmin,
  logoutAdmin,
  stepUpAdmin,
  subscribeToAdminSession,
} from "./session";
import type {
  AdminException,
  AdminLedgerEntry,
  AdminOrder,
  AdminPayment,
  AdminUser,
  AuditEvent,
  MerchantApplicant,
  OperationsSummary,
  PendingRefund,
  PendingRider,
  PendingWithdrawal,
} from "./api";

export default function AdminDashboard() {
  const session = useSyncExternalStore(subscribeToAdminSession, getAdminSession, getAdminSession);

  if (!session) return <AdminLogin />;
  return <AdminConsole key={session.admin.id} session={session} />;
}

function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authenticatorCode, setAuthenticatorCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await loginAdmin(email.trim(), password, authenticatorCode);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Admin sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="admin-login-page">
      <form className="admin-login-card" onSubmit={(event) => void submit(event)}>
        <div className="admin-brand">
          <div className="admin-brand-mark">B</div>
          <div>
            <strong>Beez</strong>
            <span>Secure admin access</span>
          </div>
        </div>
        <p className="admin-eyebrow">STAFF SIGN-IN</p>
        <h1>Admin console</h1>
        <p className="admin-login-intro">
          Sign in with your provisioned admin account. Admin access is separate from merchant and
          rider accounts.
        </p>
        <label>
          Admin email
          <input
            type="email"
            autoComplete="username"
            maxLength={254}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            maxLength={128}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <label>
          Authenticator code
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={authenticatorCode}
            onChange={(event) =>
              setAuthenticatorCode(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
          />
        </label>
        {error && (
          <p className="admin-form-error" role="alert">
            {error}
          </p>
        )}
        <button className="admin-primary-button admin-login-submit" disabled={busy} type="submit">
          <ShieldCheck size={16} aria-hidden="true" />
          {busy ? "Verifying…" : "Sign in securely"}
        </button>
        <p className="admin-login-security">
          <ShieldCheck size={15} aria-hidden="true" />
          Session tokens stay in memory and expire after eight hours.
        </p>
      </form>
    </main>
  );
}

function AdminConsole({ session }: { session: NonNullable<ReturnType<typeof getAdminSession>> }) {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState("");
  const [logoutError, setLogoutError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [clock, setClock] = useState(Date.now());
  const summaryQuery = useQuery({
    queryKey: ["admin", "summary"],
    queryFn: getOperationsSummary,
    refetchInterval: 30_000,
    retry: 1,
    retryDelay: 1_000,
  });
  const merchantsQuery = useQuery({
    queryKey: ["admin", "pending-merchants"],
    queryFn: getPendingMerchants,
    refetchInterval: 30_000,
    retry: false,
  });
  const ridersQuery = useQuery({
    queryKey: ["admin", "pending-riders"],
    queryFn: getPendingRiders,
    refetchInterval: 30_000,
    retry: false,
  });
  const withdrawalsQuery = useQuery({
    queryKey: ["admin", "pending-withdrawals"],
    queryFn: getPendingWithdrawals,
    refetchInterval: 30_000,
    retry: false,
  });
  const ordersQuery = useQuery({
    queryKey: ["admin", "orders"],
    queryFn: getOrders,
    refetchInterval: 30_000,
    retry: false,
  });
  const timelineQuery = useQuery({
    queryKey: ["admin", "order-timeline", selectedOrder],
    queryFn: () => getOrderTimeline(selectedOrder ?? ""),
    enabled: selectedOrder !== null,
    retry: false,
  });
  const paymentsQuery = useQuery({
    queryKey: ["admin", "payments"],
    queryFn: getPayments,
    refetchInterval: 30_000,
    retry: false,
  });
  const exceptionsQuery = useQuery({
    queryKey: ["admin", "exceptions"],
    queryFn: getExceptions,
    refetchInterval: 30_000,
    retry: false,
  });
  const ledgerQuery = useQuery({
    queryKey: ["admin", "ledger"],
    queryFn: getAdminLedger,
    refetchInterval: 30_000,
    retry: false,
  });
  const usersQuery = useQuery({
    queryKey: ["admin", "users", userSearch],
    queryFn: () => getAdminUsers(userSearch),
    refetchInterval: 30_000,
    retry: false,
  });
  const auditQuery = useQuery({
    queryKey: ["admin", "audit", auditSearch],
    queryFn: () => getAdminAudit(auditSearch),
    refetchInterval: 30_000,
    retry: false,
  });
  const refundsQuery = useQuery({
    queryKey: ["admin", "pending-refunds"],
    queryFn: getPendingRefunds,
    refetchInterval: 30_000,
    retry: false,
  });

  useEffect(() => {
    const remaining = Date.parse(session.expiresAt) - Date.now();
    if (remaining <= 0) {
      clearAdminSession();
      return;
    }
    const timer = window.setTimeout(clearAdminSession, remaining);
    return () => window.clearTimeout(timer);
  }, [session.expiresAt]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    setLogoutError("");
    try {
      await logoutAdmin();
    } catch (cause) {
      setLogoutError(cause instanceof Error ? cause.message : "Could not sign out.");
    } finally {
      setLoggingOut(false);
    }
  }

  async function withStepUp(code: string, action: () => Promise<void>) {
    setNotice("");
    try {
      const current = getAdminSession();
      if (!current) throw new Error("Sign in to the admin console to continue.");
      if (Date.now() - Date.parse(current.mfaVerifiedAt) >= 10 * 60 * 1000) {
        await stepUpAdmin(code);
      }
      await action();
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
      setNotice("Operation completed. Live data has been refreshed.");
    } catch (cause) {
      throw cause instanceof Error ? cause : new Error("The operation could not be completed.");
    }
  }

  const mfaAt = Date.parse(session.mfaVerifiedAt);
  const needsStepUp = !Number.isFinite(mfaAt) || clock - mfaAt >= 10 * 60 * 1000;

  return (
    <div className="admin-dashboard">
      <aside className="admin-sidebar" aria-label="Admin navigation">
        <div className="admin-brand">
          <div className="admin-brand-mark">B</div>
          <div>
            <strong>Beez</strong>
            <span>Admin · Pilot</span>
          </div>
        </div>

        <nav className="admin-nav" aria-label="Primary navigation">
          <a className="admin-nav-item active" href="#overview">
            <LayoutDashboard size={16} aria-hidden="true" />
            Overview
          </a>
          <a className="admin-nav-item" href="#merchant-approvals">
            <Store size={16} aria-hidden="true" />
            Merchant approvals
            <span className="admin-nav-count">{merchantsQuery.data?.items.length ?? "—"}</span>
          </a>
          <a className="admin-nav-item" href="#approvals">
            <Users size={16} aria-hidden="true" />
            Rider approvals
            <span className="admin-nav-count">{ridersQuery.data?.items.length ?? "—"}</span>
          </a>
          <a className="admin-nav-item" href="#orders">
            <Activity size={16} aria-hidden="true" />
            Orders
          </a>
          <a className="admin-nav-item" href="#exceptions">
            <AlertTriangle size={16} aria-hidden="true" />
            Exceptions
            <span className="admin-nav-count">{exceptionsQuery.data?.items.length ?? "—"}</span>
          </a>
          <a className="admin-nav-item" href="#payments">
            <Banknote size={16} aria-hidden="true" />
            Payments
          </a>
          <a className="admin-nav-item" href="#withdrawals">
            <WalletCards size={16} aria-hidden="true" />
            Withdrawals
            <span className="admin-nav-count">{withdrawalsQuery.data?.items.length ?? "—"}</span>
          </a>
          <a className="admin-nav-item" href="#refunds">
            <WalletCards size={16} aria-hidden="true" />
            Refund requests
            <span className="admin-nav-count">{refundsQuery.data?.items.length ?? "—"}</span>
          </a>
          <a className="admin-nav-item" href="#ledger">
            <Banknote size={16} aria-hidden="true" />
            Ledger
          </a>
          <a className="admin-nav-item" href="#users">
            <Users size={16} aria-hidden="true" />
            Users
          </a>
          <a className="admin-nav-item" href="#audit">
            <ScrollText size={16} aria-hidden="true" />
            Audit log
          </a>
        </nav>

        <div className="admin-sidebar-callout">
          <ShieldCheck size={18} aria-hidden="true" />
          <div>
            <strong>{needsStepUp ? "Authenticator required" : "Session protected"}</strong>
            <span>Admin actions require a fresh authenticator code and are audited.</span>
          </div>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-header" id="overview">
          <div>
            <p className="admin-eyebrow">OPERATIONS OVERVIEW</p>
            <h1>Good to see you, {session.admin.displayName}</h1>
            <span className="admin-preview-label">LIVE DATABASE · REFRESHES EVERY 30 SECONDS</span>
          </div>
          <div className="admin-header-actions">
            <button
              className="admin-secondary-button"
              disabled={summaryQuery.isFetching}
              onClick={() => void summaryQuery.refetch()}
              type="button"
            >
              <RefreshCw size={16} aria-hidden="true" />
              {summaryQuery.isFetching ? "Refreshing…" : "Refresh overview"}
            </button>
            <button
              className="admin-secondary-button"
              disabled={loggingOut}
              onClick={() => void handleLogout()}
              type="button"
            >
              <LogOut size={16} aria-hidden="true" />
              {loggingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </header>

        {logoutError && (
          <p className="admin-form-error" role="alert">
            {logoutError}
          </p>
        )}
        {notice && (
          <p className="admin-success-message" role="status">
            {notice}
          </p>
        )}

        <div className="admin-overview-meta" aria-live="polite">
          <span>Live data refreshes automatically every 30 seconds.</span>
          {summaryQuery.data && (
            <span>Last updated {formatAsOf(summaryQuery.data.asOf)} EAT</span>
          )}
        </div>

        {summaryQuery.isError && (
          <div className="admin-queue-error" role="alert">
            <p>Live operations summary unavailable: {summaryQuery.error.message}</p>
            <button
              disabled={summaryQuery.isFetching}
              type="button"
              onClick={() => void summaryQuery.refetch()}
            >
              Retry
            </button>
          </div>
        )}
        {!summaryQuery.isError && (
          <>
          <section className="admin-summary-grid" aria-label="Live operations summary">
            <MetricCard
              label="Orders today"
              value={summaryQuery.isPending ? "…" : summaryQuery.data?.ordersToday}
            />
            <MetricCard
              label="Paid today"
              value={
                summaryQuery.isPending
                  ? "…"
                  : `KES ${(summaryQuery.data?.paidTodayKes ?? 0).toLocaleString("en-KE")}`
              }
            />
            <MetricCard
              label="Active shops / riders"
              value={
                summaryQuery.isPending
                  ? "…"
                  : `${summaryQuery.data?.activeMerchants ?? 0} / ${summaryQuery.data?.activeRiders ?? 0}`
              }
            />
            <MetricCard
              label="Needs attention"
              value={summaryQuery.isPending ? "…" : summaryQuery.data?.attentionItems}
            />
            <MetricCard
              label="Open deliveries"
              value={summaryQuery.isPending ? "…" : summaryQuery.data?.openDeliveries}
            />
            <MetricCard
              label="Avg. delivery time today"
              value={
                summaryQuery.isPending
                  ? "…"
                  : summaryQuery.data?.averageDeliveryMinutes == null
                    ? "No deliveries"
                    : `${summaryQuery.data.averageDeliveryMinutes} min`
              }
            />
            <MetricCard
              label="Failed deliveries"
              value={summaryQuery.isPending ? "…" : summaryQuery.data?.failedDeliveries}
            />
          </section>
          <OverviewWorkQueues summary={summaryQuery.data} isPending={summaryQuery.isPending} />
          </>
        )}

        <QueuePanel
          id="merchant-approvals"
          title="Merchant applications"
          eyebrow="PEOPLE · MERCHANT APPROVALS"
          icon={<Store size={19} aria-hidden="true" />}
          query={merchantsQuery}
          emptyText="No merchants are waiting for review."
        >
          {(items) =>
            items.map((merchant) => (
              <MerchantReview
                key={merchant.merchantId}
                merchant={merchant}
                needsStepUp={needsStepUp}
                onDecision={(approve, reason, code) =>
                  withStepUp(code, async () => {
                    await reviewMerchant(merchant.merchantId, approve, reason);
                  })
                }
              />
            ))
          }
        </QueuePanel>

        <QueuePanel
          id="approvals"
          title="Rider applications"
          eyebrow="PEOPLE · RIDER APPROVALS"
          icon={<BadgeCheck size={19} aria-hidden="true" />}
          query={ridersQuery}
          emptyText="No riders are waiting for approval."
        >
          {(items) =>
            items.map((rider) => (
              <RiderApproval
                key={rider.userId}
                needsStepUp={needsStepUp}
                onApprove={(code) =>
                  withStepUp(code, async () => {
                    await approveRider(rider.userId);
                  })
                }
                rider={rider}
              />
            ))
          }
        </QueuePanel>

        <QueuePanel
          id="orders"
          title="Recent orders and timelines"
          eyebrow="FULFILMENT · ORDERS"
          icon={<Activity size={19} aria-hidden="true" />}
          query={ordersQuery}
          emptyText="No orders are recorded."
        >
          {(items) => (
            <>
              <div className="admin-table-wrap">
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Shop</th>
                      <th>Status</th>
                      <th>Delivery</th>
                      <th>Amount</th>
                      <th>Created</th>
                      <th>Timeline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <strong>{order.basketNo}</strong>
                          <small>{order.customerPhoneMasked || "Customer phone unavailable"}</small>
                        </td>
                        <td>{order.merchantName}</td>
                        <td>{order.status.replaceAll("_", " ")}</td>
                        <td>{order.deliveryStatus?.replaceAll("_", " ") ?? "Not assigned"}</td>
                        <td>KES {order.subtotalKes.toLocaleString("en-KE")}</td>
                        <td>{formatDate(order.createdAt)}</td>
                        <td>
                          <button
                            className="admin-secondary-button"
                            type="button"
                            onClick={() =>
                              setSelectedOrder(selectedOrder === order.id ? null : order.id)
                            }
                          >
                            {selectedOrder === order.id ? "Close" : "View"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selectedOrder && (
                <TimelinePanel
                  order={items.find((order) => order.id === selectedOrder)}
                  isPending={timelineQuery.isPending}
                  error={timelineQuery.error}
                  events={timelineQuery.data?.items}
                  onRetry={() => void timelineQuery.refetch()}
                />
              )}
            </>
          )}
        </QueuePanel>

        <QueuePanel
          id="exceptions"
          title="Operational exceptions"
          eyebrow="OPERATIONS · ATTENTION REQUIRED"
          icon={<AlertTriangle size={19} aria-hidden="true" />}
          query={exceptionsQuery}
          emptyText="No failed deliveries or stuck payment callbacks are reported."
        >
          {(items) => (
            <DataTable
              headers={["Type", "Order", "Status", "Details", "Occurred"]}
              rows={items.map((exception) => [
                exception.type,
                exception.basketNo ?? "—",
                exception.status,
                exception.detail,
                formatDate(exception.occurredAt),
              ])}
              rowKeys={items.map((exception) => exception.id)}
            />
          )}
        </QueuePanel>

        <QueuePanel
          id="payments"
          title="Payment attempts"
          eyebrow="MONEY · PAYMENTS"
          icon={<Banknote size={19} aria-hidden="true" />}
          query={paymentsQuery}
          emptyText="No payments are recorded."
        >
          {(items) => (
            <DataTable
              headers={["Order", "Status", "KES", "Phone", "Receipt", "Callback", "Created"]}
              rows={items.map((payment) => [
                payment.basketNo,
                payment.status,
                payment.amountKes.toLocaleString("en-KE"),
                payment.phoneMasked,
                payment.receipt ?? "—",
                payment.callbackStatus ?? "No callback",
                formatDate(payment.createdAt),
              ])}
              rowKeys={items.map((payment) => payment.id)}
            />
          )}
        </QueuePanel>

        <QueuePanel
          id="withdrawals"
          title="Merchant withdrawal requests"
          eyebrow="MONEY · MANUAL PAYOUTS"
          icon={<WalletCards size={19} aria-hidden="true" />}
          query={withdrawalsQuery}
          emptyText="No merchant withdrawal requests are waiting for review."
        >
          {(items) =>
            items.map((withdrawal) => (
              <WithdrawalReview
                key={withdrawal.id}
                withdrawal={withdrawal}
                needsStepUp={needsStepUp}
                onStart={(code) =>
                  withStepUp(code, async () => {
                    await reviewWithdrawal(withdrawal.id);
                  })
                }
                onConfirm={(code, reference) =>
                  withStepUp(code, async () => {
                    await confirmWithdrawal(withdrawal.id, reference);
                  })
                }
                onReject={(code, reason) =>
                  withStepUp(code, async () => {
                    await rejectWithdrawal(
                      withdrawal.id,
                      reason,
                      withdrawal.status === "PROCESSING",
                    );
                  })
                }
              />
            ))
          }
        </QueuePanel>

        <QueuePanel
          id="refunds"
          title="Merchant refund requests"
          eyebrow="MONEY · REFUNDS"
          icon={<BellRing size={19} aria-hidden="true" />}
          query={refundsQuery}
          emptyText="No merchant refund requests are waiting for review."
        >
          {(items) =>
            items.map((refund) => (
              <RefundReview
                key={refund.id}
                needsStepUp={needsStepUp}
                onConfirm={(code, reference) =>
                  withStepUp(code, async () => {
                    await confirmRefund(refund.id, reference);
                  })
                }
                onFail={(code, reason) =>
                  withStepUp(code, async () => {
                    await failRefund(refund.id, reason);
                  })
                }
                refund={refund}
              />
            ))
          }
        </QueuePanel>

        <QueuePanel
          id="ledger"
          title="Read-only ledger"
          eyebrow="FINANCE · LEDGER"
          icon={<Banknote size={19} aria-hidden="true" />}
          query={ledgerQuery}
          emptyText="No ledger entries are recorded."
        >
          {(items) => (
            <DataTable
              headers={["Account", "Owner", "Reference", "Description", "KES", "Order", "Created"]}
              rows={items.map((entry) => [
                entry.accountType.replaceAll("_", " "),
                entry.accountOwner,
                entry.referenceType,
                entry.description,
                entry.amountKes.toLocaleString("en-KE"),
                entry.basketNo ?? "—",
                formatDate(entry.createdAt),
              ])}
              rowKeys={items.map((entry) => entry.id)}
            />
          )}
        </QueuePanel>

        <QueuePanel
          id="users"
          title="Merchant and rider accounts"
          eyebrow="PEOPLE · ACCOUNT ADMINISTRATION"
          icon={<Users size={19} aria-hidden="true" />}
          query={usersQuery}
          emptyText="No merchant or rider accounts match this search."
        >
          {(items) => (
            <>
              <label className="admin-search">
                Search name or phone
                <input
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  maxLength={100}
                  placeholder="Enter at least 2 characters to search"
                />
              </label>
              {items.map((user) => (
                <UserAdminRow
                  key={user.id}
                  user={user}
                  needsStepUp={needsStepUp}
                  onAction={(action, reason, code) =>
                    withStepUp(code, async () => {
                      await changeUserStatus(user.id, action, reason);
                    })
                  }
                />
              ))}
            </>
          )}
        </QueuePanel>

        <QueuePanel
          id="audit"
          title="Operations audit log"
          eyebrow="SECURITY · APPEND-ONLY HISTORY"
          icon={<ScrollText size={19} aria-hidden="true" />}
          query={auditQuery}
          emptyText="No audit entries match this search."
        >
          {(items) => (
            <>
              <label className="admin-search">
                Search actions, target types, or reasons
                <input
                  value={auditSearch}
                  onChange={(event) => setAuditSearch(event.target.value)}
                  maxLength={100}
                  placeholder="Enter at least 2 characters to search"
                />
              </label>
              <DataTable
                headers={["When", "Actor", "Action", "Target", "Details"]}
                rows={items.map((entry) => [
                  formatDate(entry.createdAt),
                  entry.actorEmail,
                  entry.action,
                  `${entry.entityType} · ${entry.entityId}`,
                  entry.detail,
                ])}
                rowKeys={items.map((entry) => entry.id)}
              />
            </>
          )}
        </QueuePanel>
      </main>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <article className="admin-stat-card">
      <div className="admin-stat-icon">
        <Activity size={18} aria-hidden="true" />
      </div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>Live database value</small>
      </div>
    </article>
  );
}

function OverviewWorkQueues({
  summary,
  isPending,
}: {
  summary: OperationsSummary | undefined;
  isPending: boolean;
}) {
  const queues = [
    { label: "Merchant applications", count: summary?.pendingMerchantApprovals, href: "#merchant-approvals" },
    { label: "Rider applications", count: summary?.pendingRiderApprovals, href: "#approvals" },
    { label: "Delivery failures", count: summary?.failedDeliveries, href: "#exceptions" },
    { label: "Payment issues", count: summary?.paymentIssues, href: "#exceptions" },
    { label: "Withdrawals to review", count: summary?.pendingWithdrawals, href: "#withdrawals" },
    { label: "Refunds to review", count: summary?.pendingRefunds, href: "#refunds" },
  ];

  return (
    <section className="admin-overview-work" aria-label="Work queues needing attention">
      <div>
        <p className="admin-section-label">OPERATIONS · NEXT ACTIONS</p>
        <h2>Work needing attention</h2>
      </div>
      <ul>
        {queues.map((queue) => (
          <li key={queue.label}>
            <a href={queue.href}>
              <span>{queue.label}</span>
              <strong>{isPending ? "…" : (queue.count ?? 0).toLocaleString("en-KE")}</strong>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function QueuePanel<T>({
  id,
  title,
  eyebrow,
  icon,
  query,
  emptyText,
  children,
}: {
  id: string;
  title: string;
  eyebrow: string;
  icon: ReactNode;
  query: {
    data?: { items: T[] };
    isError: boolean;
    isPending: boolean;
    error: Error | null;
    refetch: () => unknown;
  };
  emptyText: string;
  children: (items: T[]) => ReactNode;
}) {
  const items = query.data?.items ?? [];
  return (
    <section className="admin-live-panel" id={id}>
      <div className="admin-panel-header">
        <div>
          <p className="admin-section-label">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        {icon}
      </div>
      <QueueState
        error={query.error}
        isError={query.isError}
        isLoading={query.isPending}
        onRetry={() => void query.refetch()}
        empty={!query.isError && items.length === 0}
        emptyText={emptyText}
      />
      {items.length > 0 && children(items)}
    </section>
  );
}

function DataTable({
  headers,
  rows,
  rowKeys,
}: {
  headers: string[];
  rows: ReactNode[][];
  rowKeys: string[];
}) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-data-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowKeys[rowIndex]}>
              {row.map((cell, cellIndex) => (
                <td key={`${rowKeys[rowIndex]}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MerchantReview({
  merchant,
  needsStepUp,
  onDecision,
}: {
  merchant: MerchantApplicant;
  needsStepUp: boolean;
  onDecision: (approve: boolean, reason: string, code: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function decide(approve: boolean) {
    setBusy(true);
    setError("");
    try {
      await onDecision(approve, reason.trim(), code);
      setReason("");
      setCode("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The merchant review failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="admin-queue-item">
      <div className="admin-queue-item-heading">
        <div>
          <strong>{merchant.businessName}</strong>
          <span>
            {merchant.category} · {merchant.zoneName} · {merchant.locationText}
          </span>
          <span>
            {merchant.ownerName || "Owner"} · {merchant.ownerPhoneMasked || "Phone unavailable"}
          </span>
        </div>
        <time dateTime={merchant.createdAt}>{formatDate(merchant.createdAt)}</time>
      </div>
      <div className="admin-action-form">
        {needsStepUp && (
          <label>
            Authenticator code
            <input
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              pattern="[0-9]{6}"
              required
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </label>
        )}
        <label>
          Review reason
          <input
            maxLength={240}
            minLength={1}
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <button
          className="admin-primary-button"
          type="button"
          disabled={busy || !reason.trim() || (needsStepUp && !code)}
          onClick={() => void decide(true)}
        >
          {busy ? "Saving…" : "Approve merchant"}
        </button>
        <button
          className="admin-secondary-button"
          type="button"
          disabled={busy || !reason.trim() || (needsStepUp && !code)}
          onClick={() => void decide(false)}
        >
          Reject application
        </button>
      </div>
      {error && (
        <p className="admin-form-error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}

function WithdrawalReview({
  withdrawal,
  needsStepUp,
  onStart,
  onConfirm,
  onReject,
}: {
  withdrawal: PendingWithdrawal;
  needsStepUp: boolean;
  onStart: (code: string) => Promise<void>;
  onConfirm: (code: string, reference: string) => Promise<void>;
  onReject: (code: string, reason: string) => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [transferNotSent, setTransferNotSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
      setCode("");
      setReference("");
      setReason("");
      setTransferNotSent(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The withdrawal action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="admin-queue-item">
      <div className="admin-queue-item-heading">
        <div>
          <strong>
            {withdrawal.businessName} · KES {withdrawal.amountKes.toLocaleString("en-KE")}
          </strong>
          <span>
            {withdrawal.merchantName || "Merchant"} · payout to {withdrawal.payoutPhone}
          </span>
          <span>
            {withdrawal.status} · Requested {formatDate(withdrawal.requestedAt)}
            {withdrawal.processingAt ? ` · Processing ${formatDate(withdrawal.processingAt)}` : ""}
          </span>
        </div>
      </div>
      <div className="admin-action-form admin-refund-actions">
        {needsStepUp && (
          <label>
            Authenticator code
            <input
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              pattern="[0-9]{6}"
              required
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </label>
        )}
        {withdrawal.status === "REQUESTED" ? (
          <>
            <button
              className="admin-primary-button"
              type="button"
              disabled={busy || (needsStepUp && !code)}
              onClick={() => void run(() => onStart(code))}
            >
              {busy ? "Saving…" : "Start manual payout"}
            </button>
            <label>
              Rejection reason
              <input
                maxLength={240}
                minLength={1}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <button
              className="admin-secondary-button"
              type="button"
              disabled={busy || !reason.trim() || (needsStepUp && !code)}
              onClick={() => void run(() => onReject(code, reason.trim()))}
            >
              Reject request
            </button>
          </>
        ) : (
          <>
            <label>
              M-Pesa reference (enter only after the external transfer succeeds)
              <input
                maxLength={64}
                minLength={4}
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
            </label>
            <button
              className="admin-primary-button"
              type="button"
              disabled={busy || reference.trim().length < 4 || (needsStepUp && !code)}
              onClick={() => void run(() => onConfirm(code, reference.trim()))}
            >
              {busy ? "Saving…" : "Record completed payout"}
            </button>
            <label className="admin-checkbox-label">
              <input
                type="checkbox"
                checked={transferNotSent}
                onChange={(event) => setTransferNotSent(event.target.checked)}
              />
              I confirm no M-Pesa transfer was sent
            </label>
            <label>
              Reason for not sending the payout
              <input
                maxLength={240}
                minLength={1}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <button
              className="admin-secondary-button"
              type="button"
              disabled={busy || !transferNotSent || !reason.trim() || (needsStepUp && !code)}
              onClick={() => void run(() => onReject(code, reason.trim()))}
            >
              Reject and release reserved funds
            </button>
          </>
        )}
      </div>
      {error && (
        <p className="admin-form-error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}

function UserAdminRow({
  user,
  needsStepUp,
  onAction,
}: {
  user: AdminUser;
  needsStepUp: boolean;
  onAction: (
    action: "suspend" | "restore" | "logout-all",
    reason: string,
    code: string,
  ) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(action: "suspend" | "restore" | "logout-all") {
    setBusy(true);
    setError("");
    try {
      await onAction(action, reason.trim(), code);
      setReason("");
      setCode("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The account action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="admin-queue-item">
      <div className="admin-queue-item-heading">
        <div>
          <strong>
            {user.name} · {user.role}
          </strong>
          <span>
            {user.phoneMasked || "Phone unavailable"} · {user.status}
            {user.merchantStatus ? ` · Shop ${user.merchantStatus}` : ""}
            {user.riderStatus ? ` · Rider ${user.riderStatus}` : ""}
          </span>
          <span>
            Joined {formatDate(user.createdAt)}
            {user.lastLoginAt ? ` · Last seen ${formatDate(user.lastLoginAt)}` : ""}
          </span>
        </div>
      </div>
      <div className="admin-action-form">
        {needsStepUp && (
          <label>
            Authenticator code
            <input
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              pattern="[0-9]{6}"
              required
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </label>
        )}
        <label>
          Reason
          <input
            maxLength={240}
            minLength={1}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        {user.status === "ACTIVE" ? (
          <button
            className="admin-primary-button"
            type="button"
            disabled={busy || !reason.trim() || (needsStepUp && !code)}
            onClick={() => void run("suspend")}
          >
            Suspend account
          </button>
        ) : user.status === "SUSPENDED" ? (
          <button
            className="admin-primary-button"
            type="button"
            disabled={busy || !reason.trim() || (needsStepUp && !code)}
            onClick={() => void run("restore")}
          >
            Restore account
          </button>
        ) : null}
        <button
          className="admin-secondary-button"
          type="button"
          disabled={busy || !reason.trim() || (needsStepUp && !code)}
          onClick={() => void run("logout-all")}
        >
          Revoke all sessions
        </button>
      </div>
      {error && (
        <p className="admin-form-error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}

function TimelinePanel({
  order,
  isPending,
  error,
  events,
  onRetry,
}: {
  order: AdminOrder | undefined;
  isPending: boolean;
  error: Error | null;
  events:
    | {
        type: string;
        fromStatus: string | null;
        toStatus: string | null;
        detail: string;
        createdAt: string;
      }[]
    | undefined;
  onRetry: () => void;
}) {
  if (!order) return null;
  return (
    <div className="admin-timeline">
      <h3>Timeline · {order.basketNo}</h3>
      {isPending ? (
        <p className="admin-queue-state">Loading timeline…</p>
      ) : error ? (
        <div className="admin-queue-error" role="alert">
          <p>{error.message}</p>
          <button type="button" onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : !events?.length ? (
        <p className="admin-queue-state">No timeline events are recorded for this order.</p>
      ) : (
        <ol>
          {events.map((event, index) => (
            <li key={`${event.type}-${event.createdAt}-${index}`}>
              <strong>
                {event.type} {event.fromStatus ? `${event.fromStatus} → ` : ""}
                {event.toStatus}
              </strong>
              <span>{event.detail}</span>
              <time dateTime={event.createdAt}>{formatDate(event.createdAt)}</time>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function QueueState({
  error,
  isError,
  isLoading,
  onRetry,
  empty,
  emptyText,
}: {
  error: Error | null;
  isError: boolean;
  isLoading: boolean;
  onRetry: () => void;
  empty: boolean;
  emptyText: string;
}) {
  if (isLoading) return <p className="admin-queue-state">Loading queue…</p>;
  if (isError) {
    return (
      <div className="admin-queue-error" role="alert">
        <p>{error?.message ?? "This queue could not be loaded."}</p>
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }
  if (empty) return <p className="admin-queue-state">{emptyText}</p>;
  return null;
}

function RiderApproval({
  rider,
  onApprove,
  needsStepUp,
}: {
  rider: PendingRider;
  onApprove: (code: string) => Promise<void>;
  needsStepUp: boolean;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onApprove(code);
      setCode("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Rider approval failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="admin-queue-item">
      <div className="admin-queue-item-heading">
        <div>
          <strong>{rider.displayName || "Rider applicant"}</strong>
          <span>
            {[rider.area, rider.phoneMasked].filter(Boolean).join(" · ") ||
              "Profile details limited"}
          </span>
        </div>
        <time dateTime={rider.createdAt}>{formatDate(rider.createdAt)}</time>
      </div>
      <form className="admin-action-form" onSubmit={(event) => void submit(event)}>
        {needsStepUp && (
          <label>
            Authenticator code
            <input
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              pattern="[0-9]{6}"
              required
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </label>
        )}
        <button className="admin-primary-button" disabled={busy} type="submit">
          {busy ? "Approving…" : "Approve rider"}
        </button>
      </form>
      {error && (
        <p className="admin-form-error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}

function RefundReview({
  refund,
  onConfirm,
  onFail,
  needsStepUp,
}: {
  refund: PendingRefund;
  onConfirm: (code: string, reference: string) => Promise<void>;
  onFail: (code: string, reason: string) => Promise<void>;
  needsStepUp: boolean;
}) {
  const [code, setCode] = useState("");
  const [providerReference, setProviderReference] = useState("");
  const [failureReason, setFailureReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function resolve(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
      setCode("");
      setProviderReference("");
      setFailureReason("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Refund resolution failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="admin-queue-item">
      <div className="admin-queue-item-heading">
        <div>
          <strong>
            {refund.merchantName} · Order {refund.basketNo}
          </strong>
          <span>
            KES {refund.amountKes.toLocaleString("en-KE")} · Customer{" "}
            {refund.customerPhoneMasked || "number unavailable"}
          </span>
          <span>Reason: {refund.reason}</span>
        </div>
        <time dateTime={refund.requestedAt}>{formatDate(refund.requestedAt)}</time>
      </div>
      <div className="admin-action-form admin-refund-actions">
        {needsStepUp && (
          <label>
            Authenticator code
            <input
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              pattern="[0-9]{6}"
              required
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </label>
        )}
        <label>
          Provider reference (refund already sent)
          <input
            maxLength={64}
            minLength={4}
            required
            value={providerReference}
            onChange={(event) => setProviderReference(event.target.value)}
          />
        </label>
        <button
          className="admin-primary-button"
          disabled={busy || (needsStepUp && !code) || !providerReference}
          onClick={() => void resolve(() => onConfirm(code, providerReference.trim()))}
          type="button"
        >
          {busy ? "Saving…" : "Confirm refund sent"}
        </button>
        <label>
          Reason if refund was not sent
          <input
            maxLength={240}
            minLength={1}
            required
            value={failureReason}
            onChange={(event) => setFailureReason(event.target.value)}
          />
        </label>
        <button
          className="admin-secondary-button"
          disabled={busy || (needsStepUp && !code) || !failureReason.trim()}
          onClick={() => void resolve(() => onFail(code, failureReason.trim()))}
          type="button"
        >
          Mark refund failed
        </button>
      </div>
      {error && (
        <p className="admin-form-error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatAsOf(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "time unavailable"
    : new Intl.DateTimeFormat("en-KE", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Africa/Nairobi",
      }).format(date);
}
