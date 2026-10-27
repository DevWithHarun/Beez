import { useEffect, useRef, useState, type ReactNode, type FormEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import type { Session } from '@supabase/supabase-js';
import {
  Home, ShoppingBag, Users, Store, Bike, Package, Truck, CreditCard, BarChart3, Headphones, Settings, Search, Bell, LogOut,
} from 'lucide-react';
import beezMark from '@/assets/beez-mark.png.asset.json';
import { supabase } from '@/integrations/supabase/client';
import { useTable, type Ticket } from '@/lib/admin-data';
import { getMyRoles } from '@/lib/identity.functions';
import '@/routes/-admin-dashboard.css';

const nav = [
  [Home, 'Dashboard', '/admin/dashboard'], [ShoppingBag, 'Orders', '/admin/orders'], [Users, 'Customers', '/admin/customers'],
  [Store, 'Merchants', '/admin/merchants'], [Bike, 'Riders', '/admin/riders'], [Package, 'Products', '/admin/products'],
  [Truck, 'Deliveries', '/admin/deliveries'], [CreditCard, 'Payments', '/admin/payments'], [BarChart3, 'Reports', '/admin/reports'],
  [Headphones, 'Support', '/admin/support'], [Settings, 'Settings', '/admin/settings'],
] as const;

type Gate = 'loading' | 'signed-out' | 'denied' | 'error' | 'admin';

export function AdminGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [gate, setGate] = useState<Gate>('loading');
  const [authError, setAuthError] = useState('');
  const checkId = useRef(0);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    const check = async (s: Session | null) => {
      if (!active) return;
      const currentCheck = ++checkId.current;
      setSession(s);
      setAuthError('');
      if (!s) {
        setGate('signed-out');
        return;
      }
      setGate('loading');
      try {
        const roles = await getMyRoles();
        if (active && currentCheck === checkId.current) setGate(roles.admin ? 'admin' : 'denied');
      } catch (error) {
        if (!active || currentCheck !== checkId.current) return;
        setAuthError(error instanceof Error ? error.message : 'Could not verify admin access.');
        setGate('error');
      }
    };
    const initialCheck = checkId.current;
    void supabase.auth.getSession().then(
      ({ data, error }) => {
        if (!active || initialCheck !== checkId.current) return;
        if (error) {
          setAuthError(error.message);
          setGate('error');
          return;
        }
        void check(data.session);
      },
      (error: unknown) => {
        if (!active || initialCheck !== checkId.current) return;
        setAuthError(error instanceof Error ? error.message : 'Could not retrieve your sign-in session.');
        setGate('error');
      },
    );
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
        window.setTimeout(() => {
          if (active) void check(s);
        }, 0);
      }
    });
    return () => {
      active = false;
      checkId.current += 1;
      sub.subscription.unsubscribe();
    };
  }, [retryCount]);

  if (gate === 'loading') return <div className="ad ad-center"><p className="ad-muted">Loading admin…</p></div>;
  if (gate === 'signed-out') return <AdminLogin />;
  if (gate === 'denied') return (
    <div className="ad ad-center"><div className="ad-card ad-login">
      <h1>No admin access</h1>
      <p className="ad-muted">{session?.user.email} is not an admin. Ask an existing admin to give you access.</p>
      <button className="ad-btn" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </div></div>
  );
  if (gate === 'error') return (
    <div className="ad ad-center"><div className="ad-card ad-login">
      <h1>Could not verify admin access</h1>
      <p className="ad-muted">{authError}</p>
      <button className="ad-btn" onClick={() => {
        setGate('loading');
        setRetryCount((count) => count + 1);
      }}>Try again</button>
      <button className="ad-link" onClick={() => void supabase.auth.signOut()}>Sign out</button>
    </div></div>
  );
  return <AdminLayout email={session?.user.email ?? ''}>{children}</AdminLayout>;
}

function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setMsg(error.message);
    } catch (error) {
      setMsg(error instanceof Error ? error.message : 'Could not sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="ad ad-center">
      <form className="ad-card ad-login" onSubmit={submit}>
        <div className="ad-logo"><span className="ad-bee"><img src={beezMark.url} alt="Beez" className="h-full w-full object-contain p-1" /></span>Beez Admin</div>
        <h1>Admin sign in</h1>
        <p className="ad-muted">Sign in with your administrator email and password.</p>
        <label>Email<input className="ad-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password<input className="ad-input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {msg && <p role="alert" className="ad-msg">{msg}</p>}
        <button className="ad-btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}

function AdminLayout({ email, children }: { email: string; children: ReactNode }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const { rows: tickets } = useTable<Ticket>('support_tickets');
  const open = tickets.filter((t) => t.status === 'Open').length;
  return (
    <div className="ad">
      <aside className="ad-side">
        <div className="ad-logo"><span className="ad-bee"><img src={beezMark.url} alt="Beez" className="h-full w-full object-contain p-1" /></span>Beez</div>
        <nav>{nav.map(([I, n, to]) => (
          <Link key={n} to={to} activeProps={{ className: 'active' }}><I size={19} /><span>{n}</span></Link>
        ))}</nav>
        <div className="ad-side-foot"><span className="ad-bee sm"><img src={beezMark.url} alt="Beez" className="h-full w-full object-contain p-1" /></span><div><b>Beez</b><p>Fast. Safe. Local.</p></div></div>
      </aside>
      <div className="ad-main">
        <header className="ad-top">
          <form className="ad-search" onSubmit={(e) => { e.preventDefault(); navigate({ to: '/admin/orders', search: { q } }); }}>
            <Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search orders, customers, or order IDs..." />
          </form>
          <div className="ad-top-r">
            <Link to="/admin/support" className="ad-bell" aria-label="Open support tickets"><Bell size={20} />{open > 0 && <i>{open}</i>}</Link>
            <div className="ad-user">
              <span className="ad-av-txt">{email.slice(0, 1).toUpperCase()}</span>
              <div><b>{email}</b><p>Admin</p></div>
              <button aria-label="Sign out" onClick={async () => { await supabase.auth.signOut(); }}><LogOut size={16} /></button>
            </div>
          </div>
        </header>
        <div className="ad-body">{children}</div>
      </div>
    </div>
  );
}

export function PageTitle({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return <div className="ad-welcome"><div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>{action}</div>;
}
