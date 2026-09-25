import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import api, { hasAccessToken, saveAccessToken, setUnauthorizedHandler } from './api';
import '@testing-library/jest-dom';

const currentUser = { id: 7, name: 'Asha Example', email: 'asha@example.com' };
const dashboard = {
  total_income: 7200, total_expenses: 2800, estimated_savings: 4400, savings_rate: 0.61,
  current_month: '2026-09', current_month_expenses: 800,
  monthly_expenses: [{ period: '2026-08', amount: 1200 }, { period: '2026-09', amount: 800 }],
  monthly_income: [{ period: '2026-08', amount: 3500 }, { period: '2026-09', amount: 3700 }],
  category_expenses: [{ category: 'Food', amount: 1200 }], recent_expenses: [],
  recent_income: [], goal_summaries: [],
};
const forecast = { forecast_amount: 900, target_period: '2026-10', historical_values: [], confidence: 'limited_history', message: 'Average of recent months.' };
const defaultAdapter = api.defaults.adapter;
const realGet = api.get.bind(api);

function enter(path) { window.history.pushState({}, '', path); }
function setupAuthenticated(path) {
  enter(path);
  saveAccessToken('test-access-token');
  api.get = jest.fn(async (url) => {
    if (url === '/auth/me') return { data: { user: currentUser } };
    if (url === '/dashboard') return { data: dashboard };
    if (url === '/prediction/next-month') return { data: forecast };
    if (url === '/expenses') return { data: [] };
    if (url === '/income') return { data: [] };
    if (url === '/goals') return { data: [] };
    if (url.includes('/contributions')) return { data: [] };
    throw new Error(`Unexpected GET ${url}`);
  });
  api.post = jest.fn(async () => ({ data: {} }));
  api.put = jest.fn(async () => ({ data: {} }));
  api.delete = jest.fn(async () => ({ data: {} }));
}

beforeEach(() => {
  window.sessionStorage.clear();
  api.get = jest.fn(); api.post = jest.fn(); api.put = jest.fn(); api.delete = jest.fn();
});

afterEach(() => { api.defaults.adapter = defaultAdapter; setUnauthorizedHandler(null); });

test('public signup validates input, creates account, stores a session token and opens the dashboard', async () => {
  const user = userEvent;
  enter('/signup');
  api.post.mockResolvedValue({ data: { user: currentUser, access_token: 'created-token' } });
  api.get.mockImplementation(async (url) => url === '/dashboard' ? { data: dashboard } : { data: forecast });
  render(<App />);
  await user.type(await screen.findByLabelText('Your name'), 'Asha Example');
  await user.type(screen.getByLabelText('Email address'), 'asha@example.com');
  await user.type(screen.getByLabelText(/^Password/), 'strong-password-123');
  await user.type(screen.getByLabelText('Confirm password'), 'different-password-123');
  await act(async () => { await user.click(screen.getByRole('button', { name: 'Create account' })); });
  expect(await screen.findByRole('alert')).toHaveTextContent('Your passwords do not match.');
  expect(api.post).not.toHaveBeenCalled();
  await user.clear(screen.getByLabelText('Confirm password'));
  await user.type(screen.getByLabelText('Confirm password'), 'strong-password-123');
  await act(async () => { await user.click(screen.getByRole('button', { name: 'Create account' })); });
  expect(await screen.findByText('Total income')).toBeInTheDocument();
  expect(api.post).toHaveBeenCalledWith('/auth/signup', { name: 'Asha Example', email: 'asha@example.com', password: 'strong-password-123' });
  expect(window.sessionStorage.getItem('fintrack_access_token')).toBe('created-token');
});

test('unauthenticated users are redirected, login errors are visible, and successful login can log out', async () => {
  const user = userEvent;
  enter('/goals');
  api.post.mockRejectedValueOnce({ response: { data: { error: 'Invalid email or password.' } } });
  api.post.mockImplementation(async (url) => url === '/auth/login'
    ? { data: { user: currentUser, access_token: 'login-token' } } : { data: { message: 'Logged out.' } });
  api.get.mockImplementation(async (url) => url === '/dashboard' ? { data: dashboard } : { data: forecast });
  render(<App />);
  await user.type(await screen.findByLabelText('Email address'), 'asha@example.com');
  await user.type(screen.getByLabelText('Password'), 'wrong-password');
  await act(async () => { await user.click(screen.getByRole('button', { name: 'Sign in' })); });
  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
  expect(api.post).toHaveBeenCalledWith('/auth/login', { email: 'asha@example.com', password: 'wrong-password' });
  await act(async () => { await user.click(screen.getByRole('button', { name: 'Sign in' })); });
  expect(await screen.findByText('Total income')).toBeInTheDocument();
  expect(window.sessionStorage.getItem('fintrack_access_token')).toBe('login-token');
  await act(async () => { await user.click(screen.getByRole('button', { name: 'Sign out' })); });
  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  expect(api.post).toHaveBeenCalledWith('/auth/logout');
  expect(window.sessionStorage.getItem('fintrack_access_token')).toBeNull();
});

test('an expired stored token is cleared and private routes return to login', async () => {
  enter('/expenses');
  saveAccessToken('expired-token');
  api.get = realGet;
  api.defaults.adapter = async (config) => {
    const response = { status: 401, data: { error: 'Authentication token has expired.' }, headers: {}, config };
    throw { config, response };
  };
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  await waitFor(() => expect(hasAccessToken()).toBe(false));
});

test('dashboard shows only the authenticated summary and loads its charts', async () => {
  setupAuthenticated('/dashboard');
  render(<App />);
  expect(await screen.findByText('Total income')).toBeInTheDocument();
  expect(screen.getByText('₹7,200')).toBeInTheDocument();
  expect(screen.getByText('₹2,800')).toBeInTheDocument();
  expect(screen.getByText('Spending by category')).toBeInTheDocument();
  expect(screen.getByText('Income and expenses')).toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith('/dashboard');
});

test('expense form adds and removes one expense and refreshes its list', async () => {
  const user = userEvent;
  setupAuthenticated('/expenses');
  const row = { id: 31, amount: 35, category: 'Food', description: 'Lunch', date: new Date().toISOString().slice(0, 10) };
  let saved = false;
  api.get.mockImplementation(async (url) => url === '/auth/me' ? { data: { user: currentUser } } : url === '/expenses' ? { data: saved ? [row] : [] } : { data: [] });
  api.post.mockImplementation(async (url) => { if (url === '/expenses') { saved = true; return { data: row }; } return { data: {} }; });
  api.delete.mockImplementation(async () => { saved = false; return { data: {} }; });
  render(<App />);
  await user.type(await screen.findByLabelText('Amount'), '35');
  await user.selectOptions(screen.getAllByLabelText('Category')[0], 'Food');
  await user.type(screen.getByLabelText('Description Optional'), 'Lunch');
  await act(async () => { await user.click(screen.getByRole('button', { name: 'Add expense' })); });
  expect(await screen.findByText('Lunch')).toBeInTheDocument();
  expect(api.post).toHaveBeenCalledWith('/expenses', expect.objectContaining({ amount: 35, category: 'Food', description: 'Lunch' }));
  await act(async () => { await user.click(screen.getByRole('button', { name: /Delete Food expense/ })); });
  await waitFor(() => expect(screen.queryByText('Lunch')).not.toBeInTheDocument());
  expect(api.delete).toHaveBeenCalledWith('/expenses/31');
});

test('income can be edited and deleted', async () => {
  const user = userEvent;
  setupAuthenticated('/income');
  const income = { id: 12, amount: 3200, period: '2026-08' };
  api.get.mockImplementation(async (url) => url === '/auth/me' ? { data: { user: currentUser } } : url === '/income' ? { data: [income] } : { data: [] });
  render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Edit' }));
  const amount = screen.getByLabelText('Income amount');
  await user.clear(amount); await user.type(amount, '4000');
  await act(async () => { await user.click(screen.getByRole('button', { name: 'Save changes' })); });
  expect(api.put).toHaveBeenCalledWith('/income/12', { amount: 4000, period: '2026-08' });
  await act(async () => { await user.click(await screen.findByRole('button', { name: 'Delete' })); });
  expect(api.delete).toHaveBeenCalledWith('/income/12');
});

test('goals can be created and receive contributions', async () => {
  const user = userEvent;
  setupAuthenticated('/goals');
  const goal = { id: 4, name: 'Emergency fund', goal_type: 'Emergency Fund', target_amount: 1000, current_amount: 0, target_date: '2027-12-01', description: '', progress_ratio: 0 };
  let created = false;
  api.get.mockImplementation(async (url) => url === '/auth/me' ? { data: { user: currentUser } } : url === '/goals' ? { data: created ? [goal] : [] } : { data: [] });
  api.post.mockImplementation(async (url) => { if (url === '/goals') { created = true; return { data: goal }; } return { data: {} }; });
  render(<App />);
  await user.type(await screen.findByLabelText('Goal name'), 'Emergency fund');
  await user.selectOptions(screen.getByLabelText('Goal type'), 'Emergency Fund');
  await user.type(screen.getByLabelText('Target amount'), '1000');
  await user.type(screen.getByLabelText('Target date'), '2027-12-01');
  await act(async () => { await user.click(screen.getByRole('button', { name: 'Create goal' })); });
  await user.click(await screen.findByRole('button', { name: 'Add contribution' }));
  await user.type(screen.getByLabelText('Contribution amount'), '100');
  await act(async () => { await user.click(screen.getByRole('button', { name: 'Save contribution' })); });
  expect(api.post).toHaveBeenCalledWith('/goals/4/contributions', expect.objectContaining({ amount: 100 }));
});

test('AI advice and goal planning show backend missing-key errors without calling Gemini from React', async () => {
  const user = userEvent;
  setupAuthenticated('/advice');
  api.get.mockImplementation(async (url) => url === '/auth/me' ? { data: { user: currentUser } } : url === '/goals' ? { data: [{ id: 3, name: 'Trip' }] } : { data: forecast });
  api.post.mockRejectedValue({ response: { status: 503, data: { error: 'AI features are not configured. Add GEMINI_API_KEY to enable AI guidance.' } } });
  render(<App />);
  const adviceButton = await screen.findByRole('button', { name: 'Get AI savings advice' });
  await act(async () => { await user.click(adviceButton); });
  expect(await screen.findByRole('alert')).toHaveTextContent('GEMINI_API_KEY');
  const planButton = await screen.findByRole('button', { name: 'Create AI goal plan' });
  await waitFor(() => expect(planButton).toBeEnabled());
  await act(async () => { await user.click(planButton); });
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/ai/goals/3/plan', {}));
  await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2));
  expect(api.post).toHaveBeenCalledWith('/ai/savings-advice', {});
  expect(api.post).toHaveBeenCalledWith('/ai/goals/3/plan', {});
  expect(screen.getByText('Historical values used')).toBeInTheDocument();
});
