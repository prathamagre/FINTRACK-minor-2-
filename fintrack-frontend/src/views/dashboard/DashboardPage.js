import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '../../api';
import { useAuth } from '../../auth/AuthContext';
import { currency, EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/shared/States';

const COLORS = ['#31675b', '#d28a54', '#7588a8', '#cfb35a', '#9878aa', '#c4746c', '#6c9a91', '#a4a9b0'];
const compactCurrency = (value) => `₹${new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0)}`;

function MetricCard({ label, value, note, tone = '' }) {
  return <article className={`metric-card ${tone}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

function ChartCard({ title, note, children, className = '' }) {
  return <section className={`panel chart-card ${className}`}><div className="panel-heading"><div><h2>{title}</h2>{note && <p>{note}</p>}</div></div>{children}</section>;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const [summary, prediction] = await Promise.all([api.get('/dashboard'), api.get('/prediction/next-month')]);
      setData(summary.data); setForecast(prediction.data);
    } catch (requestError) { setError(requestError.response?.data?.error || 'Could not load your dashboard. Check your connection and try again.'); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  if (busy && !data) return <LoadingState label="Bringing your finances together…" />;
  if (error && !data) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const incomeByPeriod = new Map(data.monthly_income.map((item) => [item.period, item.amount]));
  const trend = data.monthly_expenses.map((item) => ({ ...item, income: incomeByPeriod.get(item.period) || 0,
    savings: incomeByPeriod.has(item.period) ? (incomeByPeriod.get(item.period) || 0) - item.amount : null,
    label: new Date(`${item.period}-01T00:00:00`).toLocaleDateString('en', { month: 'short', year: '2-digit' }) }));
  const activeGoals = data.goal_summaries.filter((goal) => goal.current_amount < goal.target_amount).slice(0, 3);

  return <div className="dashboard-page">
    <PageHeader eyebrow="YOUR MONEY, AT A GLANCE" title={`Good ${new Date().getHours() < 12 ? 'morning' : 'day'}, ${user?.name?.split(' ')[0] || 'there'}.`}
      description="A clear view of what came in, what went out, and what you're building toward."
      action={<Link className="button button-primary" to="/expenses">Add an expense <span aria-hidden="true">＋</span></Link>} />
    {error && <ErrorState message={error} onRetry={load} />}

    <section className="metric-grid" aria-label="Financial summary">
      <MetricCard label="Total income" value={currency(data.total_income)} note="Across recorded months" />
      <MetricCard label="Total expenses" value={currency(data.total_expenses)} note="Across recorded transactions" />
      <MetricCard label="Estimated savings" value={currency(data.estimated_savings)} note="Income less tracked expenses" tone="metric-positive" />
      <MetricCard label="Savings rate" value={data.savings_rate == null ? '—' : `${(data.savings_rate * 100).toFixed(1)}%`} note="Based on recorded income" />
      <MetricCard label="This month" value={currency(data.current_month_expenses)} note="Expenses so far" />
    </section>

    <section className="chart-grid">
      <ChartCard title="Monthly spending" note="Your last 12 months" className="chart-wide">
        <div className="chart-wrap"><ResponsiveContainer width="100%" height={260}><AreaChart data={trend} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
          <defs><linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#31675b" stopOpacity={0.2} /><stop offset="95%" stopColor="#31675b" stopOpacity={0.01} /></linearGradient></defs>
          <CartesianGrid vertical={false} stroke="#e9ece7" /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#777d76', fontSize: 12 }} /><YAxis tickFormatter={compactCurrency} tickLine={false} axisLine={false} width={55} tick={{ fill: '#777d76', fontSize: 11 }} /><Tooltip formatter={(value) => currency(value)} /><Area type="monotone" dataKey="amount" name="Expenses" stroke="#31675b" strokeWidth={2.5} fill="url(#expenseFill)" /></AreaChart></ResponsiveContainer></div>
      </ChartCard>

      <ChartCard title="Spending by category" note="All recorded expenses">
        {data.category_expenses.length ? <div className="chart-wrap"><ResponsiveContainer width="100%" height={260}><PieChart><Pie data={data.category_expenses} dataKey="amount" nameKey="category" innerRadius={58} outerRadius={92} paddingAngle={3}>
          {data.category_expenses.map((entry, index) => <Cell key={entry.category} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={(value) => currency(value)} /><Legend verticalAlign="bottom" height={32} /></PieChart></ResponsiveContainer></div> : <EmptyState title="No expenses yet" detail="Add expenses to see your category breakdown." />}
      </ChartCard>

      <ChartCard title="Income and expenses" note="Monthly amounts where income is recorded" className="chart-wide">
        {data.monthly_income.length ? <div className="chart-wrap"><ResponsiveContainer width="100%" height={240}><BarChart data={trend} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}><CartesianGrid vertical={false} stroke="#e9ece7" /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#777d76', fontSize: 12 }} /><YAxis tickFormatter={compactCurrency} tickLine={false} axisLine={false} width={55} tick={{ fill: '#777d76', fontSize: 11 }} /><Tooltip formatter={(value) => currency(value)} /><Legend /><Bar dataKey="income" name="Income" fill="#91aa85" radius={[4, 4, 0, 0]} /><Bar dataKey="amount" name="Expenses" fill="#d28a54" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div> : <EmptyState title="No income recorded" detail="Add monthly income to compare it with spending." />}
      </ChartCard>

      <ChartCard title="Monthly savings trend" note="Available for months with recorded income">
        {trend.filter((item) => item.savings !== null).length >= 2 ? <div className="chart-wrap"><ResponsiveContainer width="100%" height={240}><LineChart data={trend.filter((item) => item.savings !== null)}><CartesianGrid vertical={false} stroke="#e9ece7" /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#777d76', fontSize: 12 }} /><YAxis tickFormatter={compactCurrency} tickLine={false} axisLine={false} width={55} tick={{ fill: '#777d76', fontSize: 11 }} /><Tooltip formatter={(value) => currency(value)} /><Line type="monotone" dataKey="savings" name="Income less expenses" stroke="#7588a8" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer></div> : <EmptyState title="Not enough monthly data" detail="Record income for at least two months to see a savings trend." />}
      </ChartCard>
    </section>

    <section className="lower-grid">
      <div className="panel"><div className="panel-heading"><div><h2>Recent expenses</h2><p>Your latest recorded activity</p></div><Link to="/expenses" className="text-link">All expenses <span aria-hidden="true">→</span></Link></div>
        {data.recent_expenses.length ? <ul className="activity-list">{data.recent_expenses.slice(0, 5).map((expense) => <li key={expense.id}><span className="activity-dot" /><span className="activity-copy"><strong>{expense.category}</strong><small>{expense.description || new Date(`${expense.date}T00:00:00`).toLocaleDateString()}</small></span><strong className="activity-amount">−{currency(expense.amount)}</strong></li>)}</ul> : <EmptyState title="Nothing recorded yet" detail="Add your first expense to get started." />}
      </div>
      <div className="panel"><div className="panel-heading"><div><h2>Goals in progress</h2><p>Keep your next milestone in view</p></div><Link to="/goals" className="text-link">All goals <span aria-hidden="true">→</span></Link></div>
        {activeGoals.length ? <div className="goal-mini-list">{activeGoals.map((goal) => <div className="goal-mini" key={goal.id}><div className="goal-mini-heading"><strong>{goal.name}</strong><span>{Math.round(goal.progress_ratio * 100)}%</span></div><div className="progress-track"><span style={{ width: `${Math.round(goal.progress_ratio * 100)}%` }} /></div><small>{currency(goal.current_amount)} of {currency(goal.target_amount)}</small></div>)}</div> : <EmptyState title="No active goals" detail="Set a goal to make a plan for what matters." />}
      </div>
      <div className="panel forecast-panel"><div className="forecast-orbit" aria-hidden="true">↗</div><span className="eyebrow">NEXT-MONTH FORECAST</span><h2>{forecast?.forecast_amount == null ? 'More history needed' : currency(forecast.forecast_amount)}</h2><p>{forecast?.message || 'Estimate based on your recent monthly spending.'}</p><Link to="/advice" className="text-link">View forecast details <span aria-hidden="true">→</span></Link></div>
    </section>
  </div>;
}
