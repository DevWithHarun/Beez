import { useNavigate } from "@tanstack/react-router";
import {
  Bike,
  ClipboardList,
  CircleHelp,
  LayoutDashboard,
  LogOut,
  Store,
  UserRound,
  Wallet,
} from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import MerchantDashboard from "@/features/merchant/MerchantDashboard";
import MerchantEarnings from "@/features/merchant/MerchantEarnings";
import MerchantOrders from "@/features/merchant/MerchantOrders";
import MerchantProfile from "@/features/merchant/MerchantProfile";
import MerchantWorkspace from "@/features/merchant/MerchantWorkspace";
import RiderDashboard from "@/features/rider/RiderDashboard";
import RiderEarnings from "@/features/rider/RiderEarnings";
import RiderJobs from "@/features/rider/RiderJobs";
import {
  getSession,
  logoutSession,
  refreshSession,
  subscribeToSession,
  type BeezUserSession,
} from "@/shared/auth/session";

type WorkspaceRole = "MERCHANT" | "RIDER";
type WorkspaceTab = "Dashboard" | "Shop" | "Voice Orders" | "Earnings" | "Profile" | "Jobs";

const merchantTabs: WorkspaceTab[] = ["Dashboard", "Shop", "Voice Orders", "Earnings", "Profile"];
const riderTabs: WorkspaceTab[] = ["Dashboard", "Jobs", "Earnings", "Profile"];

export default function RoleWorkspace({ role }: { role: WorkspaceRole }) {
  const navigate = useNavigate();
  const session = useSyncExternalStore(subscribeToSession, getSession, getSession);
  const [checkingSession, setCheckingSession] = useState(!session);
  const [sessionError, setSessionError] = useState("");
  const [selectedTab, setSelectedTab] = useState<WorkspaceTab>("Dashboard");
  const [shopSection, setShopSection] = useState<"catalogue" | "voice">("catalogue");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let active = true;
    if (getSession()) {
      setCheckingSession(false);
      return () => {
        active = false;
      };
    }

    void refreshSession()
      .then((current) => {
        if (!active) return;
        setCheckingSession(false);
        if (!current || current.user.onboardingRequired) {
          void navigate({ to: "/app" });
        } else if (current.user.role !== role) {
          void navigate({ to: current.user.role === "MERCHANT" ? "/merchant" : "/rider" });
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setSessionError(
          error instanceof Error
            ? error.message
            : "We couldn't check your sign-in. Please try again.",
        );
        setCheckingSession(false);
      });

    return () => {
      active = false;
    };
  }, [navigate, role]);

  useEffect(() => {
    if (!session) return;
    if (session.user.onboardingRequired) {
      void navigate({ to: "/app" });
    } else if (session.user.role !== role) {
      void navigate({ to: session.user.role === "MERCHANT" ? "/merchant" : "/rider" });
    }
  }, [navigate, role, session]);

  async function signOut() {
    setBusy(true);
    setActionError("");
    try {
      await logoutSession();
      void navigate({ to: "/app" });
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "We couldn't sign you out. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="role-workspace-loading" role="status">
        Checking your secure sign-in…
      </main>
    );
  }

  if (sessionError) {
    return (
      <main className="role-workspace-loading">
        <p role="alert">{sessionError}</p>
        <button
          className="role-workspace-retry"
          type="button"
          onClick={() => {
            setSessionError("");
            setCheckingSession(true);
            void refreshSession()
              .then((current) => {
                setCheckingSession(false);
                if (!current || current.user.onboardingRequired) {
                  void navigate({ to: "/app" });
                }
              })
              .catch((error: unknown) => {
                setCheckingSession(false);
                setSessionError(
                  error instanceof Error
                    ? error.message
                    : "We couldn't check your sign-in. Please try again.",
                );
              });
          }}
        >
          Try again
        </button>
      </main>
    );
  }

  if (!session || session.user.role !== role || session.user.onboardingRequired) {
    return (
      <main className="role-workspace-loading" role="status">
        Opening your account…
      </main>
    );
  }

  const tabs = role === "MERCHANT" ? merchantTabs : riderTabs;
  const Icon = role === "MERCHANT" ? Store : Bike;

  return (
    <main className="role-workspace">
      <header className="role-workspace-header">
        <a className="role-workspace-brand" href="/" aria-label="Beez home">
          <img src="/beez-logo.png" alt="" />
          <span>Beez</span>
        </a>
        <div className="role-workspace-account">
          <span className="role-workspace-role">
            <Icon size={15} aria-hidden="true" />
            {role === "MERCHANT" ? "Merchant workspace" : "Rider workspace"}
          </span>
          <span className="role-workspace-name">
            {session.user.displayName ?? session.user.phone}
          </span>
        </div>
        <button
          className="role-workspace-signout"
          disabled={busy}
          type="button"
          onClick={() => void signOut()}
        >
          <LogOut size={16} aria-hidden="true" />
          {busy ? "Signing out…" : "Sign out"}
        </button>
      </header>

      <div className="role-workspace-body">
        <nav className="role-workspace-tabs" aria-label={`${role.toLowerCase()} workspace`}>
          {tabs.map((tab) => (
            <button
              key={tab}
              aria-label={tab}
              aria-current={selectedTab === tab ? "page" : undefined}
              className="role-workspace-tab"
              type="button"
              onClick={() => {
                setActionError("");
                if (tab === "Shop") setShopSection("catalogue");
                setSelectedTab(tab);
              }}
            >
              {tab === "Dashboard" ? (
                <LayoutDashboard size={17} aria-hidden="true" />
              ) : tab === "Earnings" ? (
                <Wallet size={17} aria-hidden="true" />
              ) : tab === "Jobs" || tab === "Voice Orders" ? (
                <ClipboardList size={17} aria-hidden="true" />
              ) : tab === "Shop" ? (
                <Store size={17} aria-hidden="true" />
              ) : tab === "Profile" ? (
                <UserRound size={17} aria-hidden="true" />
              ) : null}
              <span>{tab}</span>
            </button>
          ))}
        </nav>

        <section className="role-workspace-content" aria-live="polite">
          {actionError && (
            <p className="role-workspace-error" role="alert">
              {actionError}
            </p>
          )}
          {selectedTab === "Dashboard" ? (
            role === "MERCHANT" ? (
              <MerchantDashboard
                onOpenShop={() => {
                  setShopSection("catalogue");
                  setSelectedTab("Shop");
                }}
                onOpenOrders={() => setSelectedTab("Voice Orders")}
                onOpenEarnings={() => setSelectedTab("Earnings")}
                onOpenVoiceProducts={() => {
                  setShopSection("voice");
                  setSelectedTab("Shop");
                }}
              />
            ) : (
              <RiderDashboard user={session.user} onSelectTab={setSelectedTab} />
            )
          ) : selectedTab === "Profile" ? (
            role === "MERCHANT" ? (
              <MerchantProfile user={session.user} />
            ) : (
              <ProfilePanel user={session.user} role={role} />
            )
          ) : role === "MERCHANT" && selectedTab === "Voice Orders" ? (
            <MerchantOrders language={session.user.language === "sw" ? "sw" : "en"} />
          ) : role === "MERCHANT" && selectedTab === "Earnings" ? (
            <MerchantEarnings />
          ) : role === "MERCHANT" && selectedTab === "Shop" ? (
            <MerchantWorkspace
              initialName={session.user.shopName ?? ""}
              initialArea={session.user.area ?? ""}
              initialSection={shopSection}
            />
          ) : role === "RIDER" && selectedTab === "Jobs" ? (
            <RiderJobs />
          ) : role === "RIDER" && selectedTab === "Earnings" ? (
            <RiderEarnings />
          ) : (
            <ComingSoonPanel role={role} tab={selectedTab} user={session.user} />
          )}
        </section>
      </div>
    </main>
  );
}

function DashboardHome({
  role,
  user,
  onSelectTab,
}: {
  role: WorkspaceRole;
  user: BeezUserSession;
  onSelectTab: (tab: WorkspaceTab) => void;
}) {
  const riderPending = role === "RIDER" && user.onboardingStatus === "PENDING_APPROVAL";
  return (
    <div className="role-dashboard">
      <span className="role-workspace-eyebrow">
        {role === "MERCHANT" ? "MERCHANT HOME" : "RIDER HOME"}
      </span>
      <h1>Welcome{user.displayName ? `, ${user.displayName}` : ""}</h1>
      <p className="role-dashboard-intro">
        {role === "MERCHANT"
          ? "Your shop workspace is ready. Manage your shop details and product catalogue here."
          : riderPending
            ? "Your rider profile is set up. Delivery access will be available after your account is approved."
            : "Your rider workspace is ready."}
      </p>

      {riderPending && (
        <div className="role-approval-notice" role="status">
          <strong>Pending approval</strong>
          <span>Beez will notify you when your rider account is approved.</span>
        </div>
      )}

      <div className="role-dashboard-cards">
        {role === "MERCHANT" ? (
          <>
            <button
              className="role-dashboard-card"
              type="button"
              onClick={() => onSelectTab("Shop")}
            >
              <Store size={20} aria-hidden="true" />
              <strong>Shop</strong>
              <span>{user.shopName ?? "Set up your shop and add products."}</span>
            </button>
            <button
              className="role-dashboard-card"
              type="button"
              onClick={() => onSelectTab("Voice Orders")}
            >
              <ClipboardList size={20} aria-hidden="true" />
              <strong>Voice Orders</strong>
              <span>
                Prepare paid orders, request refunds for unavailable items, and track delivery.
              </span>
            </button>
          </>
        ) : (
          <>
            <button
              className="role-dashboard-card"
              type="button"
              onClick={() => onSelectTab("Jobs")}
            >
              <Bike size={20} aria-hidden="true" />
              <strong>Delivery jobs</strong>
              <span>
                {riderPending ? "Available after account approval." : "View your delivery jobs."}
              </span>
            </button>
            <button
              className="role-dashboard-card"
              type="button"
              onClick={() => onSelectTab("Earnings")}
            >
              <Wallet size={20} aria-hidden="true" />
              <strong>Earnings</strong>
              <span>Earnings tools are coming soon.</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ProfilePanel({ user, role }: { user: BeezUserSession; role: WorkspaceRole }) {
  return (
    <div className="role-profile">
      <span className="role-workspace-eyebrow">ACCOUNT</span>
      <h1>Your profile</h1>
      <dl>
        <div>
          <dt>Name</dt>
          <dd>{user.displayName ?? "—"}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{user.phone}</dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd>{role === "MERCHANT" ? "Merchant" : "Rider"}</dd>
        </div>
        <div>
          <dt>{role === "MERCHANT" ? "Shop" : "Delivery area"}</dt>
          <dd>{(role === "MERCHANT" ? user.shopName : user.area) ?? "Not set"}</dd>
        </div>
        <div>
          <dt>Account status</dt>
          <dd>{user.onboardingStatus.replaceAll("_", " ").toLowerCase()}</dd>
        </div>
      </dl>
    </div>
  );
}

function ComingSoonPanel({
  role,
  tab,
  user,
}: {
  role: WorkspaceRole;
  tab: WorkspaceTab;
  user: BeezUserSession;
}) {
  const waitingForApproval = role === "RIDER" && user.onboardingStatus === "PENDING_APPROVAL";
  return (
    <div className="role-coming-soon">
      <CircleHelp size={27} aria-hidden="true" />
      <span className="role-workspace-eyebrow">{tab.toUpperCase()}</span>
      <h1>{tab} are coming soon</h1>
      <p>
        {waitingForApproval
          ? "This section will be available after your rider account is approved."
          : `The ${tab.toLowerCase()} tools are not available yet. Your account and profile remain saved.`}
      </p>
    </div>
  );
}
