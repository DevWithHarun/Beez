import { useMemo, useState } from 'react';
import { PageTitle } from '@/components/admin/AdminShell';
import {
  exportCsv,
  kes,
  timeAgo,
  updateAdminRiderAvailability,
  useTable,
  type AdminOrder,
  type Rider,
} from '@/lib/admin-data';

type RiderFilter = 'all' | 'online' | 'offline' | 'on-delivery';

export function RidersPage() {
  const { rows: riders, loaded: ridersLoaded, error: ridersError, reload: reloadRiders } = useTable<Rider>('riders');
  const { rows: orders, loaded: ordersLoaded, error: ordersError, reload: reloadOrders } = useTable<AdminOrder>('orders');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<RiderFilter>('all');
  const [busyIds, setBusyIds] = useState<Set<string>>(() => new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const loaded = ridersLoaded && ordersLoaded;
  const errors = [ridersError, ordersError].filter((message): message is string => Boolean(message));

  const orderStats = useMemo(() => {
    const stats = new Map<string, { deliveries: number; earnings: number; activeOrders: string[] }>();
    for (const order of orders) {
      if (!order.rider_id) continue;
      const stat = stats.get(order.rider_id) ?? { deliveries: 0, earnings: 0, activeOrders: [] };
      if (order.status === 'Delivered') {
        stat.deliveries += 1;
        stat.earnings += order.rider_earning_kes ?? 0;
      }
      if (['Assigned', 'In Transit', 'Out for Delivery'].includes(order.status)) {
        stat.activeOrders.push(order.id);
      }
      stats.set(order.rider_id, stat);
    }
    return stats;
  }, [orders]);

  const filteredRiders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return riders.filter((rider) => {
      const stats = orderStats.get(rider.id);
      const matchesFilter = filter === 'all'
        || (filter === 'online' && rider.online)
        || (filter === 'offline' && !rider.online)
        || (filter === 'on-delivery' && Boolean(stats?.activeOrders.length));
      const matchesSearch = !query
        || `${rider.full_name} ${rider.phone} ${rider.id}`.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [filter, orderStats, riders, search]);

  const changeAvailability = async (rider: Rider) => {
    setBusyIds((current) => new Set(current).add(rider.id));
    setActionError(null);
    setNotice(null);
    try {
      await updateAdminRiderAvailability(rider.id, !rider.online);
      await reloadRiders();
      setNotice(`${rider.full_name || 'Rider'} is now ${rider.online ? 'offline' : 'online'}.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not update rider availability.');
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(rider.id);
        return next;
      });
    }
  };

  const refresh = async () => {
    await Promise.all([reloadRiders(), reloadOrders()]);
  };

  const exportRiders = () => exportCsv('riders.csv', filteredRiders.map((rider) => {
    const stats = orderStats.get(rider.id);
    return {
      name: rider.full_name,
      phone: rider.phone,
      availability: rider.online ? 'Online' : 'Offline',
      active_orders: stats?.activeOrders.join('; ') ?? '',
      delivered_orders: stats?.deliveries ?? 0,
      delivered_earnings_kes: stats?.earnings ?? 0,
      latitude: rider.lat ?? '',
      longitude: rider.lng ?? '',
      joined_at: rider.created_at,
    };
  }));

  const onlineCount = riders.filter((rider) => rider.online).length;
  const deliveryCount = riders.filter((rider) => Boolean(orderStats.get(rider.id)?.activeOrders.length)).length;

  return (
    <div className="ad-page">
      <PageTitle
        title="Riders"
        sub={`${onlineCount} online · ${deliveryCount} currently on delivery · ${riders.length} registered`}
        action={<button className="ad-btn ghost" onClick={exportRiders} disabled={!filteredRiders.length}>Export CSV</button>}
      />
      <p className="ad-muted">Availability is saved to the rider profile. Riders with an active delivery cannot be forced offline.</p>

      <div className="ad-card">
        <div className="ad-toolbar">
          <input
            className="ad-input"
            type="search"
            aria-label="Search riders"
            placeholder="Search name, phone, or rider ID"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="ad-input"
            aria-label="Filter riders"
            value={filter}
            onChange={(event) => setFilter(event.target.value as RiderFilter)}
          >
            <option value="all">All riders</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="on-delivery">On delivery</option>
          </select>
          <button className="ad-btn ghost" onClick={() => void refresh()} disabled={!loaded}>Refresh</button>
        </div>
        {errors.length > 0 && <p className="ad-msg" role="alert">Could not load rider data: {errors.join(' ')}</p>}
        {actionError && <p className="ad-msg" role="alert">{actionError}</p>}
        {notice && <p className="ad-muted" role="status">{notice}</p>}
        {!loaded && <p className="ad-muted" role="status">Loading riders and delivery history…</p>}
        {loaded && errors.length === 0 && filteredRiders.length === 0 && (
          <p className="ad-muted">{riders.length ? 'No riders match these filters.' : 'No riders have registered yet.'}</p>
        )}
        {filteredRiders.length > 0 && (
          <table className="ad-table">
            <thead>
              <tr>
                <th>Rider</th><th>Phone</th><th>Availability</th><th>Current deliveries</th>
                <th>Completed deliveries</th><th>Delivered earnings</th><th>Last location</th><th>Joined</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRiders.map((rider) => {
                const stats = orderStats.get(rider.id) ?? { deliveries: 0, earnings: 0, activeOrders: [] };
                const busy = busyIds.has(rider.id);
                return (
                  <tr key={rider.id}>
                    <td>{rider.full_name || '—'}</td>
                    <td>{rider.phone || '—'}</td>
                    <td><span className={`ad-pill ${rider.online ? 'done' : 'cancel'}`}>{rider.online ? 'Online' : 'Offline'}</span></td>
                    <td>{stats.activeOrders.length
                      ? stats.activeOrders.map((id) => <span key={id}>#{id} </span>)
                      : 'None'}</td>
                    <td>{stats.deliveries}</td>
                    <td>{kes(stats.earnings)}</td>
                    <td>{rider.lat != null && rider.lng != null ? `${rider.lat.toFixed(4)}, ${rider.lng.toFixed(4)}` : 'Not shared'}</td>
                    <td>{timeAgo(rider.created_at)}</td>
                    <td>
                      <button
                        className="ad-btn ghost sm"
                        disabled={busy || (rider.online && Boolean(stats.activeOrders.length))}
                        title={rider.online && stats.activeOrders.length ? 'A rider with an active delivery cannot be forced offline.' : undefined}
                        onClick={() => void changeAvailability(rider)}
                      >
                        {busy ? 'Saving…' : rider.online ? 'Set offline' : 'Set online'}
                      </button>
                      {rider.online && stats.activeOrders.length > 0 && <p className="ad-muted xs">Active delivery</p>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
