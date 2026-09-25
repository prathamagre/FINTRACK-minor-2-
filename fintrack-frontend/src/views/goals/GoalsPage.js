import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../api';
import { currency, EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/shared/States';

const TYPES = ['Car', 'House', 'Vacation', 'Education', 'Emergency Fund', 'Investment', 'Custom'];
const blank = () => ({ name: '', goal_type: 'Emergency Fund', target_amount: '', current_amount: '0', target_date: '', description: '' });
const monthDistance = (dateValue) => {
  const target = new Date(`${dateValue}T00:00:00`); const now = new Date();
  return Math.max(1, (target.getFullYear() - now.getFullYear()) * 12 + target.getMonth() - now.getMonth());
};

export default function GoalsPage() {
  const [goals, setGoals] = useState([]);
  const [form, setForm] = useState(blank());
  const [editing, setEditing] = useState(null);
  const [contributing, setContributing] = useState(null);
  const [contribution, setContribution] = useState({ amount: '', contribution_date: new Date().toISOString().slice(0, 10) });
  const [history, setHistory] = useState([]);
  const [historyGoal, setHistoryGoal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setGoals((await api.get('/goals')).data); }
    catch (requestError) { setError(requestError.response?.data?.error || 'Could not load your goals.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => goals.reduce((sum, goal) => ({ target: sum.target + goal.target_amount, saved: sum.saved + goal.current_amount }), { target: 0, saved: 0 }), [goals]);

  function startEdit(goal) {
    setEditing(goal.id);
    setForm({ name: goal.name, goal_type: TYPES.includes(goal.goal_type) ? goal.goal_type : 'Custom', target_amount: String(goal.target_amount), current_amount: String(goal.current_amount), target_date: goal.target_date, description: goal.description || '' });
    setError(''); setNotice('');
  }
  function resetForm() { setEditing(null); setForm(blank()); }

  async function saveGoal(event) {
    event.preventDefault(); setError(''); setNotice('');
    if (!form.name.trim() || Number(form.target_amount) <= 0 || !form.target_date) return setError('Enter a name, positive target amount, and target date.');
    setBusy(true);
    try {
      const body = { ...form, name: form.name.trim(), target_amount: Number(form.target_amount), current_amount: Number(form.current_amount), description: form.description.trim() };
      if (editing) await api.put(`/goals/${editing}`, body); else await api.post('/goals', body);
      setNotice(editing ? 'Goal updated.' : 'Goal created.'); resetForm(); await load();
    } catch (requestError) { setError(requestError.response?.data?.error || 'Could not save goal.'); }
    finally { setBusy(false); }
  }

  async function removeGoal(id) {
    setError(''); setNotice('');
    try { await api.delete(`/goals/${id}`); setNotice('Goal deleted.'); if (editing === id) resetForm(); if (historyGoal === id) setHistoryGoal(null); await load(); }
    catch (requestError) { setError(requestError.response?.data?.error || 'Could not delete goal.'); }
  }

  async function addContribution(event) {
    event.preventDefault(); if (!contributing) return;
    setError(''); setNotice(''); setBusy(true);
    try { await api.post(`/goals/${contributing}/contributions`, { ...contribution, amount: Number(contribution.amount) }); setNotice('Contribution added.'); setContributing(null); setContribution({ amount: '', contribution_date: new Date().toISOString().slice(0, 10) }); await load(); if (historyGoal === contributing) await loadHistory(contributing); }
    catch (requestError) { setError(requestError.response?.data?.error || 'Could not add contribution.'); }
    finally { setBusy(false); }
  }

  async function loadHistory(id) {
    setHistoryGoal(id); setError('');
    try { setHistory((await api.get(`/goals/${id}/contributions`)).data); }
    catch (requestError) { setError(requestError.response?.data?.error || 'Could not load contribution history.'); }
  }

  async function removeContribution(goalId, contributionId) {
    setError('');
    try { await api.delete(`/goals/${goalId}/contributions/${contributionId}`); await load(); await loadHistory(goalId); }
    catch (requestError) { setError(requestError.response?.data?.error || 'Could not delete contribution.'); }
  }

  return <div className="page-stack">
    <PageHeader eyebrow="WHAT YOU'RE BUILDING TOWARD" title="Financial goals" description="Turn a big target into visible, manageable progress." />
    {error && <ErrorState message={error} onRetry={load} />}{notice && <div className="notice notice-success" role="status">{notice}</div>}
    <div className="goal-summary-strip"><div><span>Total targets</span><strong>{currency(totals.target)}</strong></div><div><span>Saved so far</span><strong>{currency(totals.saved)}</strong></div><div><span>Goals in progress</span><strong>{goals.filter((goal) => goal.current_amount < goal.target_amount).length}</strong></div></div>
    <section className="panel form-panel"><div className="panel-heading"><div><h2>{editing ? 'Edit goal' : 'Create a goal'}</h2><p>Progress changes through recorded contributions.</p></div></div>
      <form className="goal-form" onSubmit={saveGoal}>
        <label>Goal name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={160} required /></label>
        <label>Goal type<select value={form.goal_type} onChange={(e) => setForm({ ...form, goal_type: e.target.value })}>{TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
        <label>Target amount<input type="number" min="0.01" step="0.01" value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: e.target.value })} required /></label>
        {!editing && <label>Already saved<input type="number" min="0" step="0.01" value={form.current_amount} onChange={(e) => setForm({ ...form, current_amount: e.target.value })} /></label>}
        <label>Target date<input type="date" value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })} required /></label>
        <label className="goal-description">Description <span className="field-hint">Optional</span><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={1000} /></label>
        <div className="form-actions"><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create goal'}</button>{editing && <button type="button" className="button button-secondary" onClick={resetForm}>Cancel</button>}</div>
      </form>
    </section>
    {loading ? <LoadingState label="Loading goals…" /> : goals.length ? <section className="goal-grid">{goals.map((goal) => {
      const remaining = Math.max(0, goal.target_amount - goal.current_amount);
      const requiredMonthly = remaining / monthDistance(goal.target_date);
      const status = remaining === 0 ? 'Complete' : new Date(`${goal.target_date}T23:59:59`) < new Date() ? 'Past target date' : 'In progress';
      return <article className="panel goal-card" key={goal.id}>
        <div className="goal-card-top"><span className="goal-type-tag">{goal.goal_type}</span><span className={`goal-status ${status === 'Complete' ? 'status-complete' : ''}`}>{status}</span></div>
        <h2>{goal.name}</h2>{goal.description && <p className="goal-description-copy">{goal.description}</p>}
        <div className="goal-balance"><strong>{currency(goal.current_amount)}</strong><span>of {currency(goal.target_amount)}</span></div>
        <div className="progress-track progress-large" role="progressbar" aria-label={`${goal.name} progress`} aria-valuenow={Math.round(goal.progress_ratio * 100)} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${Math.round(goal.progress_ratio * 100)}%` }} /></div>
        <div className="goal-progress-label"><span>{Math.round(goal.progress_ratio * 100)}% saved</span><span>{currency(remaining)} left</span></div>
        <div className="goal-facts"><div><small>Target date</small><strong>{new Date(`${goal.target_date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</strong></div><div><small>Needed per month</small><strong>{currency(requiredMonthly)}</strong></div></div>
        <div className="goal-actions"><button className="button button-primary button-small" disabled={remaining <= 0} onClick={() => { setContributing(goal.id); setContribution({ amount: '', contribution_date: new Date().toISOString().slice(0, 10) }); }}>Add contribution</button><button className="button button-secondary button-small" onClick={() => startEdit(goal)}>Edit</button><button className="button button-quiet button-small" onClick={() => removeGoal(goal.id)}>Delete</button></div>
        <button className="text-link contribution-toggle" onClick={() => historyGoal === goal.id ? setHistoryGoal(null) : loadHistory(goal.id)}>{historyGoal === goal.id ? 'Hide contribution history' : 'View contribution history'}</button>
        {contributing === goal.id && <form className="contribution-form" onSubmit={addContribution}><label>Contribution amount<input type="number" min="0.01" max={remaining} step="0.01" value={contribution.amount} onChange={(e) => setContribution({ ...contribution, amount: e.target.value })} required /></label><label>Date<input type="date" value={contribution.contribution_date} onChange={(e) => setContribution({ ...contribution, contribution_date: e.target.value })} required /></label><div className="form-actions"><button className="button button-primary button-small" disabled={busy}>Save contribution</button><button type="button" className="button button-secondary button-small" onClick={() => setContributing(null)}>Cancel</button></div></form>}
        {historyGoal === goal.id && <div className="contribution-history"><h3>Contribution history</h3>{history.length ? history.map((item) => <div className="contribution-row" key={item.id}><span>{new Date(`${item.contribution_date}T00:00:00`).toLocaleDateString()}</span><strong>{currency(item.amount)}</strong><button className="text-link" onClick={() => removeContribution(goal.id, item.id)}>Remove</button></div>) : <p className="muted">No contributions recorded yet.</p>}</div>}
      </article>;
    })}</section> : <div className="panel"><EmptyState title="No goals yet" detail="Create a goal above to start tracking progress." /></div>}
  </div>;
}
