import React, { useCallback, useEffect, useState } from 'react';
import api from '../../api';
import { currency, EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/shared/States';

const currentMonth = () => new Date().toISOString().slice(0, 7);

export default function IncomePage() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ amount: '', period: currentMonth() });
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setRows((await api.get('/income')).data); }
    catch (requestError) { setError(requestError.response?.data?.error || 'Could not load income records.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  function beginEdit(row) { setEditing(row.id); setForm({ amount: String(row.amount), period: row.period }); setNotice(''); setError(''); }
  function cancelEdit() { setEditing(null); setForm({ amount: '', period: currentMonth() }); }

  async function submit(event) {
    event.preventDefault(); setError(''); setNotice('');
    if (Number(form.amount) <= 0 || !form.period) return setError('Enter a positive amount and choose a month.');
    setBusy(true);
    try {
      if (editing) await api.put(`/income/${editing}`, { amount: Number(form.amount), period: form.period });
      else await api.post('/income', { amount: Number(form.amount), period: form.period });
      setNotice(editing ? 'Income updated.' : 'Income added.'); cancelEdit(); await load();
    } catch (requestError) { setError(requestError.response?.data?.error || 'Could not save income.'); }
    finally { setBusy(false); }
  }

  async function remove(id) {
    setError(''); setNotice('');
    try { await api.delete(`/income/${id}`); setNotice('Income record deleted.'); if (editing === id) cancelEdit(); await load(); }
    catch (requestError) { setError(requestError.response?.data?.error || 'Could not delete income.'); }
  }

  return <div className="page-stack">
    <PageHeader eyebrow="MONEY IN" title="Income" description="Record income by month for a more complete view of your finances." />
    {error && <ErrorState message={error} onRetry={load} />}{notice && <div className="notice notice-success" role="status">{notice}</div>}
    <section className="panel form-panel"><div className="panel-heading"><div><h2>{editing ? 'Edit income' : 'Add monthly income'}</h2><p>One income record per month.</p></div></div>
      <form className="income-form" onSubmit={submit}>
        <label>Amount<input aria-label="Income amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></label>
        <label>Month<input aria-label="Income month" type="month" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} required /></label>
        <div className="form-actions"><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add income'}</button>{editing && <button type="button" className="button button-secondary" onClick={cancelEdit}>Cancel</button>}</div>
      </form>
    </section>
    <section className="panel"><div className="panel-heading"><div><h2>Income history</h2><p>Monthly records for your account</p></div></div>
      {loading ? <LoadingState label="Loading income…" /> : rows.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Month</th><th className="align-right">Amount</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{new Date(`${row.period}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</td><td className="align-right amount-cell">{currency(row.amount)}</td><td className="row-actions"><button className="button button-quiet button-small" onClick={() => beginEdit(row)}>Edit</button><button className="button button-quiet button-small" onClick={() => remove(row.id)}>Delete</button></td></tr>)}</tbody></table></div> : <EmptyState title="No income recorded" detail="Add a monthly income record to see it here and in your dashboard." />}
    </section>
  </div>;
}
