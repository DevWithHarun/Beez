import { useMemo, useState, type FormEvent } from 'react';
import { PageTitle } from '@/components/admin/AdminShell';
import { supabase } from '@/integrations/supabase/client';
import { exportCsv, useTable, type Merchant } from '@/lib/admin-data';

type MerchantForm = {
  name: string;
  area: string;
  phone: string;
  category: string;
  business_type: string;
};

const blankForm: MerchantForm = { name: '', area: '', phone: '', category: '', business_type: '' };

export function MerchantsPage() {
  const { rows, loaded, error, reload } = useTable<Merchant>('merchants');
  const [form, setForm] = useState<MerchantForm>(blankForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ownerEmail, setOwnerEmail] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((merchant) => {
      const activeMatches = statusFilter === 'all'
        || (statusFilter === 'active' ? merchant.active : !merchant.active);
      const queryMatches = !query || [
        merchant.name,
        merchant.area,
        merchant.phone,
        merchant.category,
        merchant.business_type,
        merchant.owner_id ?? '',
      ].join(' ').toLowerCase().includes(query);
      return activeMatches && queryMatches;
    });
  }, [rows, search, statusFilter]);

  const resetForm = () => {
    setForm(blankForm);
    setEditingId(null);
    setOwnerEmail('');
  };

  const startEditing = (merchant: Merchant) => {
    setForm({
      name: merchant.name,
      area: merchant.area,
      phone: merchant.phone,
      category: merchant.category,
      business_type: merchant.business_type,
    });
    setEditingId(merchant.id);
    setOwnerEmail('');
    setMessage(null);
    setActionError(null);
  };

  const saveMerchant = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setActionError(null);
    try {
      const normalized = {
        name: form.name.trim(),
        area: form.area.trim(),
        phone: form.phone.trim(),
        category: form.category.trim(),
        business_type: form.business_type.trim(),
      };
      const result = editingId
        ? await supabase.from('merchants').update(normalized).eq('id', editingId).select('id').single()
        : await supabase.from('merchants').insert(normalized).select('id').single();
      if (result.error) throw new Error(result.error.message);

      if (editingId && ownerEmail.trim()) {
        const { error: ownerError } = await supabase.rpc('admin_set_merchant_owner', {
          _merchant_id: editingId,
          _owner_email: ownerEmail.trim(),
        });
        if (ownerError) {
          await reload();
          throw new Error(`Merchant details were saved, but owner assignment failed: ${ownerError.message}`);
        }
      }

      await reload();
      setMessage(editingId ? 'Merchant details saved.' : 'Merchant created.');
      resetForm();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not save this merchant.');
    } finally {
      setSaving(false);
    }
  };

  const setMerchantActive = async (merchant: Merchant) => {
    setBusyId(merchant.id);
    setActionError(null);
    setMessage(null);
    try {
      const { error } = await supabase.from('merchants')
        .update({ active: !merchant.active })
        .eq('id', merchant.id)
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      await reload();
      setMessage(`${merchant.name} is now ${merchant.active ? 'paused' : 'active'}.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not update merchant status.');
    } finally {
      setBusyId(null);
    }
  };

  const assignOwner = async (merchant: Merchant, email: string | null) => {
    setBusyId(merchant.id);
    setActionError(null);
    setMessage(null);
    try {
      const { error } = await supabase.rpc('admin_set_merchant_owner', {
        _merchant_id: merchant.id,
        _owner_email: email,
      });
      if (error) throw new Error(error.message);
      await reload();
      setMessage(email ? `Owner linked to ${merchant.name}.` : `Owner unlinked from ${merchant.name}.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not change the merchant owner.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="ad-page">
      <PageTitle
        title="Merchants"
        sub={`${rows.filter((merchant) => merchant.active).length} active of ${rows.length}`}
        action={<button className="ad-btn ghost" onClick={() => exportCsv('merchants.csv', filtered.map((merchant) => ({
          name: merchant.name,
          area: merchant.area,
          phone: merchant.phone,
          category: merchant.category,
          business_type: merchant.business_type,
          active: merchant.active ? 'Active' : 'Paused',
          owner_id: merchant.owner_id ?? '',
          created_at: merchant.created_at,
        })))} disabled={!filtered.length}>Export CSV</button>}
      />

      <form className="ad-card ad-form" onSubmit={(event) => void saveMerchant(event)}>
        <label>Shop name<input className="ad-input" required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label>Area<input className="ad-input" required maxLength={200} value={form.area} onChange={(event) => setForm({ ...form, area: event.target.value })} /></label>
        <label>Phone<input className="ad-input" type="tel" maxLength={30} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
        <label>Category<input className="ad-input" required maxLength={100} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label>
        <label>Business type<input className="ad-input" maxLength={40} value={form.business_type} onChange={(event) => setForm({ ...form, business_type: event.target.value })} /></label>
        {editingId && (
          <label>Assign owner by existing Auth email
            <input className="ad-input" type="email" autoComplete="off" value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} placeholder="Leave blank to keep current owner" />
          </label>
        )}
        <div className="ad-toolbar">
          <button className="ad-btn" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save merchant' : 'Add merchant'}</button>
          {editingId && <button className="ad-btn ghost" type="button" onClick={resetForm} disabled={saving}>Cancel edit</button>}
        </div>
      </form>

      {actionError && <p className="ad-msg" role="alert">{actionError}</p>}
      {message && <p className="ad-muted" role="status">{message}</p>}

      <div className="ad-card">
        <div className="ad-toolbar">
          <input className="ad-input" type="search" aria-label="Search merchants" placeholder="Search name, area, phone, category" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select className="ad-input" aria-label="Filter merchants by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
            <option value="all">All merchants</option>
            <option value="active">Active</option>
            <option value="inactive">Paused</option>
          </select>
          <button className="ad-btn ghost" onClick={() => void reload()} disabled={!loaded}>Refresh</button>
        </div>
        {error && <p className="ad-msg" role="alert">Could not load merchants: {error}</p>}
        {!loaded && <p className="ad-muted" role="status">Loading merchants…</p>}
        {loaded && !error && filtered.length === 0 && <p className="ad-muted">{rows.length ? 'No merchants match these filters.' : 'No merchants yet. Add a merchant above or wait for merchant onboarding.'}</p>}
        {filtered.length > 0 && (
          <table className="ad-table">
            <thead><tr><th>Name</th><th>Category</th><th>Business type</th><th>Area</th><th>Phone</th><th>Owner</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map((merchant) => (
                <tr key={merchant.id}>
                  <td>{merchant.name}</td>
                  <td>{merchant.category || '—'}</td>
                  <td>{merchant.business_type || '—'}</td>
                  <td>{merchant.area}</td>
                  <td>{merchant.phone || '—'}</td>
                  <td>
                    {merchant.owner_id
                      ? <><span title={merchant.owner_id}>Linked account</span><br /><button className="ad-link" disabled={busyId === merchant.id} onClick={() => void assignOwner(merchant, null)}>Unlink</button></>
                      : editingId === merchant.id ? 'Assign in form above' : 'Unassigned'}
                  </td>
                  <td><span className={`ad-pill ${merchant.active ? 'done' : 'cancel'}`}>{merchant.active ? 'Active' : 'Paused'}</span></td>
                  <td>
                    <button className="ad-btn ghost sm" onClick={() => startEditing(merchant)}>Edit</button>{' '}
                    <button className="ad-btn ghost sm" disabled={busyId === merchant.id} onClick={() => void setMerchantActive(merchant)}>
                      {busyId === merchant.id ? 'Saving…' : merchant.active ? 'Pause' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
