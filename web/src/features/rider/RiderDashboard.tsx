import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bike, BriefcaseBusiness, Clock3, MapPinned, Route, Wallet } from "lucide-react";
import {
  getAvailableDeliveries,
  getRiderEarnings,
  getRiderState,
  setRiderAvailability,
} from "./api";

type RiderWorkspaceTab = "Dashboard" | "Jobs" | "Earnings" | "Profile";

export default function RiderDashboard({
  user,
  onSelectTab,
}: {
  user: { displayName?: string | null; onboardingStatus?: string; area?: string | null };
  onSelectTab: (tab: RiderWorkspaceTab) => void;
}) {
  const queryClient = useQueryClient();
  const stateQuery = useQuery({
    queryKey: ["rider", "status"],
    queryFn: getRiderState,
    retry: false,
  });
  const availableQuery = useQuery({
    queryKey: ["rider", "available-deliveries"],
    queryFn: getAvailableDeliveries,
    enabled: stateQuery.data?.approved === true,
    retry: false,
  });
  const earningsQuery = useQuery({
    queryKey: ["rider", "earnings"],
    queryFn: getRiderEarnings,
    enabled: stateQuery.data?.approved === true,
    retry: false,
  });
  const availabilityMutation = useMutation({
    mutationFn: setRiderAvailability,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["rider", "status"] });
      await queryClient.invalidateQueries({ queryKey: ["rider", "available-deliveries"] });
    },
  });

  const approved = stateQuery.data?.approved ?? false;
  const available = stateQuery.data?.available ?? false;
  const openJobs = availableQuery.data?.length ?? 0;
  const activeStatus = stateQuery.isPending
    ? "Checking…"
    : stateQuery.isError
      ? "Unavailable"
      : approved
        ? available
          ? "Online"
          : "Offline"
        : "Pending approval";

  const stats = [
    {
      label: "Account status",
      value: stateQuery.isPending ? "Checking…" : approved ? "Approved" : "Awaiting review",
      helper: approved ? "Dispatch access enabled" : "Operations review in progress",
      icon: BriefcaseBusiness,
    },
    {
      label: "Availability",
      value: activeStatus,
      helper: available ? "Accepting jobs now" : "Ready when you are online",
      icon: Route,
    },
    {
      label: "Ready deliveries",
      value: stateQuery.isPending
        ? "…"
        : !approved
          ? stateQuery.isError
            ? "Unavailable"
            : "Locked"
          : availableQuery.isPending
            ? "…"
            : availableQuery.isError
              ? "Unavailable"
              : `${openJobs}`,
      helper: !approved
        ? stateQuery.isError
          ? "Could not check rider approval"
          : "Available after approval"
        : availableQuery.isError
          ? "Could not load dispatch queue"
          : openJobs > 0
            ? "Orders ready for pickup"
            : "No new batches yet",
      icon: MapPinned,
    },
    {
      label: "Ledger earnings",
      value: earningsQuery.isPending
        ? "…"
        : earningsQuery.isError
          ? "Unavailable"
          : `KES ${earningsQuery.data.balanceKes.toLocaleString("en-KE")}`,
      helper: earningsQuery.isError
        ? "Could not load rider ledger"
        : `${earningsQuery.data?.completedDeliveries ?? 0} completed deliveries`,
      icon: Wallet,
    },
  ];

  return (
    <div className="rider-dashboard">
      <div className="rider-dashboard-hero">
        <div>
          <span className="role-workspace-eyebrow">RIDER HOME</span>
          <h1>Welcome{user.displayName ? `, ${user.displayName}` : " back"}</h1>
          <p>
            {approved
              ? `Your rider profile is active${user.area ? ` in ${user.area}` : ""}. Review jobs, stay online, and keep your route moving.`
              : "Your rider profile is set up. Beez operations will approve it before you can take jobs."}
          </p>
        </div>
        {approved && (
          <button
            type="button"
            className="rider-toggle"
            disabled={availabilityMutation.isPending}
            onClick={() => availabilityMutation.mutate(!available)}
          >
            {availabilityMutation.isPending ? "Updating…" : available ? "Go offline" : "Go online"}
          </button>
        )}
      </div>

      {stateQuery.isError && (
        <p className="role-workspace-error" role="alert">
          {stateQuery.error.message}
        </p>
      )}
      {availabilityMutation.isError && (
        <p className="role-workspace-error" role="alert">
          {availabilityMutation.error.message}
        </p>
      )}

      {!approved && !stateQuery.isPending ? (
        <div className="role-approval-notice" role="status">
          <strong>Pending approval</strong>
          <span>Delivery access unlocks after Beez operation review and rider verification.</span>
        </div>
      ) : null}

      <div className="rider-dashboard-stats">
        {stats.map(({ label, value, helper, icon: Icon }) => (
          <article key={label} className="rider-dashboard-stat">
            <div className="rider-dashboard-stat-head">
              <span>{label}</span>
              <Icon size={18} aria-hidden="true" />
            </div>
            <strong>{value}</strong>
            <small>{helper}</small>
          </article>
        ))}
      </div>

      <div className="rider-dashboard-grid">
        <section className="rider-panel">
          <div className="rider-panel-header">
            <div>
              <span className="role-workspace-eyebrow">DISPATCH</span>
              <h2>Delivery queue</h2>
            </div>
            <button type="button" className="rider-link-button" onClick={() => onSelectTab("Jobs")}>
              Open jobs
            </button>
          </div>
          <p className="role-dashboard-intro">
            {stateQuery.isError
              ? "Rider status unavailable. Try refreshing this page."
              : !approved
                ? "Available deliveries appear here after rider approval."
                : availableQuery.isPending
                  ? "Checking the live dispatch queue…"
                  : availableQuery.isError
                    ? `Dispatch queue unavailable: ${availableQuery.error.message}`
                    : !available
                      ? "Go online to view available delivery jobs."
                      : openJobs === 0
                        ? "There are no ready deliveries in your queue right now."
                        : `${openJobs} ready ${openJobs === 1 ? "delivery" : "deliveries"} are waiting in the dispatch queue.`}
          </p>
        </section>

        <section className="rider-panel">
          <div className="rider-panel-header">
            <div>
              <span className="role-workspace-eyebrow">EARNINGS</span>
              <h2>Ledger overview</h2>
            </div>
            <button
              type="button"
              className="rider-link-button"
              onClick={() => onSelectTab("Earnings")}
            >
              Earnings
            </button>
          </div>
          <div className="rider-metrics">
            <div className="rider-metric">
              <span>Completed deliveries</span>
              <strong>
                {earningsQuery.isPending
                  ? "…"
                  : earningsQuery.isError
                    ? "—"
                    : earningsQuery.data.completedDeliveries.toLocaleString("en-KE")}
              </strong>
            </div>
            <div className="rider-metric">
              <span>Platform share</span>
              <strong>
                {earningsQuery.isPending
                  ? "…"
                  : earningsQuery.isError
                    ? "—"
                    : `${earningsQuery.data.commissionPercent}%`}
              </strong>
            </div>
            <div className="rider-metric">
              <span>Rider share</span>
              <strong>
                {earningsQuery.isPending
                  ? "…"
                  : earningsQuery.isError
                    ? "—"
                    : `${100 - earningsQuery.data.commissionPercent}%`}
              </strong>
            </div>
          </div>
          <div className="rider-mini-card">
            <Wallet size={18} aria-hidden="true" />
            <div>
              <strong>
                {earningsQuery.isPending
                  ? "Loading ledger balance…"
                  : earningsQuery.isError
                    ? "Ledger balance unavailable"
                    : `KES ${earningsQuery.data.balanceKes.toLocaleString("en-KE")}`}
              </strong>
              <span>Rider share of delivery fees, credited after customer confirmation.</span>
            </div>
          </div>
        </section>
      </div>

      <div className="rider-action-row">
        <button
          type="button"
          className="role-dashboard-card rider-quick-action"
          onClick={() => onSelectTab("Jobs")}
        >
          <Bike size={20} aria-hidden="true" />
          <strong>Delivery jobs</strong>
          <span>{approved ? "Check the latest pickup batches." : "Waiting for approval."}</span>
        </button>
        <button
          type="button"
          className="role-dashboard-card rider-quick-action"
          onClick={() => onSelectTab("Earnings")}
        >
          <Wallet size={20} aria-hidden="true" />
          <strong>Earnings</strong>
          <span>Review ledger earnings and confirmed deliveries.</span>
        </button>
        <button
          type="button"
          className="role-dashboard-card rider-quick-action"
          onClick={() => onSelectTab("Profile")}
        >
          <Clock3 size={20} aria-hidden="true" />
          <strong>Profile</strong>
          <span>Check rider status, area coverage, and verification.</span>
        </button>
      </div>
    </div>
  );
}
