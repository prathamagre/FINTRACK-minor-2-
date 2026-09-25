import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../api';
import { currency, EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/shared/States';

const CATEGORIES = ['Food', 'Travel', 'Shopping', 'Bills', 'Entertainment', 'Health', 'Education', 'Other'];
const today = () => new Date().toISOString().slice(0, 10);

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [month, setMonth] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [form, setForm] = useState({ amount: '', category: 'Food', description: '', date: today() });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const response = await api.get('/expenses', { params: month ? { month } : {} }); setExpenses(response.data); }
    catch (requestError) { setError(requestError.response?.data?.error || 'Could not load expenses. Check your connection and try again.'); }
    finally { setLoading(false); }
  }, [month]);
  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => categoryFilter ? expenses.filter((item) => item.category === categoryFilter) : expenses, [expenses, categoryFilter]);

  async function submit(event) {
    event.preventDefault(); setError(''); setNotice('');
    if (Number(form.amount) <= 0 || !form.date || !form.category) return setError('Enter a positive amount, category, and date.');
    setBusy(true);
    try {
      await api.post('/expenses', { ...form, amount: Number(form.amount) });
      setForm((old) => ({ ...old, amount: '', description: '' })); setNotice('Expense added.'); await load();
    } catch (requestError) { setError(requestError.response?.data?.error || 'Could not save expense. Check your connection and try again.'); }
    finally { setBusy(false); }
  }

  async function remove(id) {
    setError(''); setNotice('');
    try { await api.delete(`/expenses/${id}`); setNotice('Expense deleted.'); await load(); }
    catch (requestError) { setError(requestError.response?.data?.error || 'Could not delete expense.'); }
  }

  return <div className="page-stack">
    <PageHeader eyebrow="SPENDING" title="Expenses" description="Keep the everyday details organized, one entry at a time." />
    {error && <ErrorState message={error} onRetry={load} />}{notice && <div className="notice notice-success" role="status">{notice}</div>}
    <section className="panel form-panel"><div className="panel-heading"><div><h2>Add an expense</h2><p>Entries are private to your account.</p></div></div>
      <form className="expense-form" onSubmit={submit}>
        <label>Amount<input aria-label="Amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></label>
        <label>Category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Date<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></label>
        <label className="expense-description">Description <span className="field-hint">Optional</span><input maxLength={500} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        <button className="button button-primary expense-submit" disabled={busy}>{busy ? 'Saving…' : 'Add expense'}</button>
      </form>
    </section>
    <section className="panel"><div className="panel-heading list-heading"><div><h2>Transactions</h2><p>{visible.length} {visible.length === 1 ? 'expense' : 'expenses'} shown</p></div>
      <div className="filter-row"><label>Month<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label><label>Category<select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option value="">All categories</option>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label></div>
    </div>
      {loading ? <LoadingState label="Loading expenses…" /> : visible.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th className="align-right">Amount</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
        {visible.map((expense) => <tr key={expense.id}><td>{new Date(`${expense.date}T00:00:00`).toLocaleDateString()}</td><td><span className="category-pill">{expense.category}</span></td><td>{expense.description || <span className="muted">—</span>}</td><td className="align-right amount-cell">{currency(expense.amount)}</td><td><button className="button button-quiet button-small" onClick={() => remove(expense.id)} aria-label={`Delete ${expense.category} expense from ${expense.date}`}>Delete</button></td></tr>)}
      </tbody></table></div> : <EmptyState title="No expenses found" detail="Try another filter, or add your first expense above." />}
    </section>
  </div>;
}
