import React, { useCallback, useEffect, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '../../api';
import { currency, EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/shared/States';

const compact = (value) => `₹${new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0)}`;

function ForecastCard() {
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setForecast((await api.get('/prediction/next-month')).data); }
    catch (requestError) { setError(requestError.response?.data?.error || 'Could not load forecast data.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const history = forecast?.historical_values || [];
  const chartData = [...history.map((item) => ({ period: item.period, spending: item.amount })),
    ...(forecast?.forecast_amount == null ? [] : [{ period: forecast.target_period, forecast: forecast.forecast_amount }])];
  return <section className="panel advice-forecast">
    <div className="panel-heading"><div><h2>Statistical Expense Forecast</h2><p>The number is calculated from your historical monthly expenses. AI advice and goal plans are generated separately.</p></div><button className="button button-secondary button-small" onClick={load} disabled={loading}>Refresh</button></div>
    {loading ? <LoadingState label="Calculating forecast…" /> : error ? <ErrorState message={error} onRetry={load} /> : <>
      <div className="forecast-summary"><div><span>Forecast for {forecast?.target_period || 'next month'}</span><strong>{forecast?.forecast_amount == null ? 'Not available yet' : currency(forecast.forecast_amount)}</strong></div><span className={`forecast-confidence confidence-${forecast?.confidence}`}>{forecast?.confidence?.replaceAll('_', ' ')}</span></div>
      {chartData.length ? <div className="chart-wrap"><ResponsiveContainer width="100%" height={245}><ComposedChart data={chartData}><CartesianGrid vertical={false} stroke="#e9ece7" /><XAxis dataKey="period" tickLine={false} axisLine={false} tick={{ fill: '#777d76', fontSize: 12 }} /><YAxis tickFormatter={compact} tickLine={false} axisLine={false} width={55} tick={{ fill: '#777d76', fontSize: 11 }} /><Tooltip formatter={(value) => currency(value)} /><Bar dataKey="spending" name="Historical spending" fill="#91aa85" radius={[4, 4, 0, 0]} /><Line dataKey="forecast" name="Forecast" stroke="#d28a54" strokeWidth={3} dot={{ r: 5, fill: '#d28a54' }} connectNulls /></ComposedChart></ResponsiveContainer></div> : <EmptyState title="No history yet" detail="Add expenses across a few months to build a forecast." />}
      <p className="forecast-explanation">{forecast?.message}</p>
      <div className="history-values"><strong>Historical values used</strong>{history.length ? history.map((item) => <span key={item.period}>{item.period} <b>{currency(item.amount)}</b></span>) : <span>No monthly values recorded.</span>}</div>
    </>}
  </section>;
}

function Recommendations({ result }) {
  if (!result) return null;
  return <div className="ai-result"><div className="ai-summary"><span className="eyebrow">SUMMARY</span><p>{result.summary}</p></div>
    {!!result.observations?.length && <div className="ai-observations"><strong>Spending observations</strong><ul>{result.observations.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
    {!!result.savings_opportunities?.length && <InsightList title="Savings opportunities" items={result.savings_opportunities} />}
    <div className="recommendation-grid" aria-label="Practical actions">{(result.recommendations || []).map((item, index) => <article className="recommendation-card" key={`${index}-${item}`}><span>0{index + 1}</span><p>{item}</p></article>)}</div>
    {!!result.priorities?.length && <InsightList title="Priorities" items={result.priorities} />}
    {!!result.caveats?.length && <div className="ai-caveats"><strong>Keep in mind</strong><ul>{result.caveats.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
  </div>;
}

function InsightList({ title, items }) {
  return <div className="ai-observations"><strong>{title}</strong><ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul></div>;
}

function GoalPlan({ result }) {
  if (!result) return null;
  return <div className="ai-result"><div className="plan-monthly"><span>Suggested monthly saving</span><strong>{currency(result.required_monthly_saving)}</strong><p>{result.progress_summary}</p></div>
    <div className="plan-columns"><div><h3>Actionable steps</h3><ol>{(result.practical_steps || []).map((item, i) => <li key={i}>{item}</li>)}</ol></div><div><h3>Spending adjustments</h3><ul>{(result.suggested_spending_adjustments || []).map((item, i) => <li key={i}>{item}</li>)}</ul></div></div>
    {!!result.milestones?.length && <InsightList title="Suggested milestones" items={result.milestones} />}
    {!!result.warnings?.length && <div className="ai-caveats"><strong>Potential challenges</strong><ul>{result.warnings.map((item, i) => <li key={i}>{item}</li>)}</ul></div>}
    {result.caveat && <p className="muted small-copy">{result.caveat}</p>}
  </div>;
}

export default function AdvicePage() {
  const [advice, setAdvice] = useState(null);
  const [adviceError, setAdviceError] = useState('');
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [goals, setGoals] = useState([]);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [goalsError, setGoalsError] = useState('');
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState('');
  const [goalId, setGoalId] = useState('');
  const [plan, setPlan] = useState(null);
  const [planError, setPlanError] = useState('');
  const [planLoading, setPlanLoading] = useState(false);

  useEffect(() => {
    api.get('/goals').then((response) => { setGoals(response.data); if (response.data.length) setGoalId(String(response.data[0].id)); })
      .catch((error) => setGoalsError(error.response?.data?.error || 'Could not load your goals.'))
      .finally(() => setGoalsLoading(false));
    api.get('/dashboard').then((response) => setSummary(response.data))
      .catch((error) => setSummaryError(error.response?.data?.error || 'Could not load your financial summary.'));
  }, []);

  async function requestAdvice() {
    setAdviceError(''); setAdvice(null); setAdviceLoading(true);
    try { setAdvice((await api.post('/ai/savings-advice', {})).data); }
    catch (error) { setAdviceError(error.response?.data?.error || 'Could not request advice. Check your connection and try again.'); }
    finally { setAdviceLoading(false); }
  }

  async function requestPlan(event) {
    event.preventDefault(); if (!goalId) return;
    setPlanError(''); setPlan(null); setPlanLoading(true);
    try { setPlan((await api.post(`/ai/goals/${goalId}/plan`, {})).data); }
    catch (error) { setPlanError(error.response?.data?.error || 'Could not request a goal plan.'); }
    finally { setPlanLoading(false); }
  }

  return <div className="page-stack">
    <PageHeader eyebrow="PERSONALIZED INSIGHTS" title="Insights & guidance" description="Use your recorded finances to understand trends and plan your next step." />
    <div className="privacy-note"><span aria-hidden="true">i</span><p>AI guidance is generated from your financial aggregates and selected goal details. It is educational, not a guarantee of financial outcomes.</p></div>
    {summaryError && <ErrorState message={summaryError} />}
    {summary && <section className="ai-summary-strip" aria-label="Your financial summary"><div><span>Total income</span><strong>{currency(summary.total_income)}</strong></div><div><span>Total expenses</span><strong>{currency(summary.total_expenses)}</strong></div><div><span>Estimated savings</span><strong>{currency(summary.estimated_savings)}</strong></div><div><span>Savings rate</span><strong>{summary.savings_rate == null ? '—' : `${Math.round(summary.savings_rate * 100)}%`}</strong></div></section>}
    <section className="panel ai-panel"><div className="panel-heading"><div><span className="eyebrow">SAVINGS COACH</span><h2>AI Savings Advice</h2><p>Recommendations use your recorded income, expenses, categories, savings rate, and recent monthly trends.</p></div></div>
      <button className="button button-primary" onClick={requestAdvice} disabled={adviceLoading}>{adviceLoading ? 'Reviewing your aggregates…' : advice ? 'Refresh advice' : 'Get AI savings advice'}</button>
      {adviceError && <div className="notice notice-error advice-error" role="alert">{adviceError}</div>}
      {adviceLoading && <LoadingState label="Preparing recommendations…" />}
      <Recommendations result={advice} />
    </section>
    <section className="panel ai-panel"><div className="panel-heading"><div><span className="eyebrow">GOAL PLANNER</span><h2>AI Goal Planning</h2><p>Get an estimated monthly pace and useful actions based on your goal and spending aggregates.</p></div></div>
      {goalsLoading ? <LoadingState label="Loading your goals…" /> : goalsError ? <ErrorState message={goalsError} /> : goals.length ? <form className="goal-plan-request" onSubmit={requestPlan}><label>Select a goal<select value={goalId} onChange={(e) => { setGoalId(e.target.value); setPlan(null); setPlanError(''); }}>{goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.name}</option>)}</select></label><button className="button button-primary" disabled={planLoading || !goalId}>{planLoading ? 'Building your plan…' : plan ? 'Refresh plan' : 'Create AI goal plan'}</button></form> : <EmptyState title="Create a goal first" detail="Your goal plan will be grounded in a goal you own." />}
      {planError && <div className="notice notice-error advice-error" role="alert">{planError}</div>}{planLoading && <LoadingState label="Building a practical plan…" />}
      <GoalPlan result={plan} />
    </section>
    <ForecastCard />
  </div>;
}
