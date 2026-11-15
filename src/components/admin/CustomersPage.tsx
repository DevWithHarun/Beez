import { useEffect, useState } from 'react';
import { PageTitle } from '@/components/admin/AdminShell';
import { supabase } from '@/integrations/supabase/client';
import {
  exportCsv,
  kes,
  loadAdminCustomerOrders,
  loadAdminCustomers,
  timeAgo,
  type AdminCustomer,
  type AdminCustomerOrder,
} from '@/lib/admin-data';

const PAGE_SIZE = 25;
const HISTORY_PAGE_SIZE = 10;

export function CustomersPage() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [customerType, setCustomerType] = useState<1 | 2>(1);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState<AdminCustomer | null>(null);
  const [history, setHistory] = useState<AdminCustomerOrder[]>([]);
  const [historyTotalCount, setHistoryTotalCount] = useState(0);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    let active = true;
    setLoaded(false);
    setError(null);
    void loadAdminCustomers(search, customerType, PAGE_SIZE, page * PAGE_SIZE).then(
      (data) => {
        if (!active) return;
        setCustomers(data);
        setTotalCount(data[0]?.total_count ?? 0);
        setLoaded(true);
      },
      (cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'Could not load guest customers.');
        setLoaded(true);
      },
    );
    return () => {
      active = false;
    };
  }, [search, customerType, page, refreshKey]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-customer-directory-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        setRefreshKey((current) => current + 1);
        setHistoryRefreshKey((current) => current + 1);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (page * PAGE_SIZE >= totalCount && page > 0) {
      setPage(Math.max(0, Math.ceil(totalCount / PAGE_SIZE) - 1));
    }
  }, [page, totalCount]);

  useEffect(() => {
    const customerKey = selectedCustomer?.customer_key;
    if (!customerKey) {
      setHistory([]);
      setHistoryTotalCount(0);
      setHistoryLoaded(false);
      setHistoryError(null);
      return;
    }

    let active = true;
    setHistoryLoaded(false);
    setHistoryError(null);
    void loadAdminCustomerOrders(customerKey, HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE).then(
      (data) => {
        if (!active) return;
        setHistory(data);
        setHistoryTotalCount(data[0]?.total_count ?? 0);
        setHistoryLoaded(true);
      },
      (cause: unknown) => {
        if (!active) return;
        setHistoryError(cause instanceof Error ? cause.message : 'Could not load this customer’s orders.');
        setHistoryLoaded(true);
      },
    );
    return () => {
      active = false;
    };
  }, [selectedCustomer?.customer_key, historyPage, historyRefreshKey]);

  const historyCount = historyTotalCount;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const historyPageCount = Math.max(1, Math.ceil(historyCount / HISTORY_PAGE_SIZE));

  const selectCustomer = (customer: AdminCustomer) => {
    setSelectedCustomer((current) => current?.customer_key === customer.customer_key ? null : customer);
    setHistoryPage(0);
  };

  const exportCurrentPage = () => exportCsv('guest-customers.csv', customers.map((customer) => ({
    name: customer.customer_name,
    phone: customer.customer_phone,
    latest_area: customer.area,
    orders: customer.order_count,
    paid_total_kes: customer.paid_total_kes,
    last_order_at: customer.last_order_at,
  })));

  return (
    <div className="ad-page">
      <PageTitle
        title="Customers"
        sub={`${totalCount.toLocaleString()} ${customerType === 2 ? 'returning ' : ''}guest customers`}
        action={<button className="ad-btn ghost" onClick={exportCurrentPage} disabled={!customers.length}>Export page CSV</button>}
      />
      <p className="ad-muted">Guest identities are grouped by normalized phone number. Orders without a phone number stay separate; customers do not need an account.</p>
      <div className="ad-card">
        <div className="ad-toolbar">
          <input
            className="ad-input"
            type="search"
            aria-label="Search guest customers"
            placeholder="Search name, phone, or latest delivery area"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <select
            className="ad-input"
            aria-label="Filter guest customers"
            value={customerType}
            onChange={(event) => {
              setCustomerType(event.target.value === '2' ? 2 : 1);
              setPage(0);
            }}
          >
            <option value={1}>All customers</option>
            <option value={2}>Returning customers</option>
          </select>
          <button className="ad-btn ghost" onClick={() => setRefreshKey((current) => current + 1)} disabled={!loaded}>
            Refresh
          </button>
        </div>
        {error && <p className="ad-msg" role="alert">Could not load guest customers: {error}</p>}
        {!loaded && <p className="ad-muted" role="status">Loading guest customers…</p>}
        {loaded && !error && customers.length === 0 && (
          <p className="ad-muted">
            {totalCount === 0 && !search && customerType === 1
              ? 'No guest customers yet. Customers will appear here after their first order.'
              : 'No customers match these filters.'}
          </p>
        )}
        {customers.length > 0 && (
          <>
            <table className="ad-table">
              <thead>
                <tr><th>Name</th><th>Phone</th><th>Latest area</th><th>Orders</th><th>Paid total</th><th>Last order</th><th>History</th></tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.customer_key}>
                    <td>{customer.customer_name}</td>
                    <td>{customer.customer_phone || 'Not provided'}</td>
                    <td>{customer.area || '—'}</td>
                    <td>{customer.order_count}</td>
                    <td>{kes(customer.paid_total_kes)}</td>
                    <td>{timeAgo(customer.last_order_at)}</td>
                    <td>
                      <button
                        className="ad-btn ghost sm"
                        aria-expanded={selectedCustomer?.customer_key === customer.customer_key}
                        onClick={() => selectCustomer(customer)}
                      >
                        {selectedCustomer?.customer_key === customer.customer_key ? 'Hide orders' : 'View orders'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="ad-toolbar" aria-label="Customer pages">
              <span className="ad-muted">Page {page + 1} of {pageCount} · {totalCount.toLocaleString()} customers</span>
              <button className="ad-btn ghost sm" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0 || !loaded}>Previous</button>
              <button className="ad-btn ghost sm" onClick={() => setPage((current) => current + 1)} disabled={!loaded || page + 1 >= pageCount}>Next</button>
            </div>
          </>
        )}
      </div>

      {selectedCustomer && (
        <section className="ad-card" aria-label={`Orders for ${selectedCustomer.customer_name}`}>
          <div className="ad-head">
            <div>
              <h3>Order history · {selectedCustomer.customer_name}</h3>
              <p className="ad-muted">{selectedCustomer.customer_phone || 'No phone provided'} · {historyCount} orders</p>
            </div>
            <button className="ad-btn ghost sm" onClick={() => setSelectedCustomer(null)}>Close</button>
          </div>
          {historyError && <p className="ad-msg" role="alert">Could not load order history: {historyError}</p>}
          {!historyLoaded && <p className="ad-muted" role="status">Loading order history…</p>}
          {historyLoaded && !historyError && history.length === 0 && <p className="ad-muted">No order history is available.</p>}
          {history.length > 0 && (
            <>
              <table className="ad-table">
                <thead><tr><th>Order</th><th>Merchant</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Area</th><th>Placed</th></tr></thead>
                <tbody>
                  {history.map((order) => (
                    <tr key={order.order_id}>
                      <td>#{order.order_id}</td>
                      <td>{order.merchant_name}</td>
                      <td>{order.items_summary}</td>
                      <td>{kes(order.total_kes)}</td>
                      <td>{order.payment_method} · {order.payment_status}</td>
                      <td>{order.status}</td>
                      <td>{order.customer_area || '—'}</td>
                      <td>{timeAgo(order.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="ad-toolbar">
                <span className="ad-muted">Page {historyPage + 1} of {historyPageCount}</span>
                <button className="ad-btn ghost sm" onClick={() => setHistoryPage((current) => Math.max(0, current - 1))} disabled={historyPage === 0 || !historyLoaded}>Previous</button>
                <button className="ad-btn ghost sm" onClick={() => setHistoryPage((current) => current + 1)} disabled={!historyLoaded || historyPage + 1 >= historyPageCount}>Next</button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
