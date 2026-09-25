import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

function AuthFrame({ title, subtitle, children, footer }) {
  return <main className="auth-screen"><Link className="brand auth-brand" to="/login"><span className="brand-symbol">F</span>fintrack</Link>
    <section className="auth-card"><span className="eyebrow">PERSONAL FINANCE, MADE CLEAR</span><h1>{title}</h1><p className="auth-subtitle">{subtitle}</p>{children}<div className="auth-footer">{footer}</div></section>
    <p className="auth-caption">Your money data is private to your account.</p>
  </main>;
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.');
    if (!password) return setError('Enter your password.');
    setBusy(true);
    try { await login({ email: email.trim(), password }); navigate(location.state?.from || '/dashboard', { replace: true }); }
    catch (requestError) { setError(requestError.response?.data?.error || 'Unable to sign in. Check your connection and try again.'); }
    finally { setBusy(false); }
  }

  return <AuthFrame title="Welcome back" subtitle="Sign in to see your personal money picture."
    footer={<>New to Fintrack? <Link to="/signup">Create an account</Link></>}>
    <form onSubmit={submit} noValidate className="form-stack">
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      <label>Email address<input autoComplete="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label>Password<input autoComplete="current-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
      <button className="button button-primary button-wide" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  </AuthFrame>;
}

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => setForm((previous) => ({ ...previous, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!form.name.trim()) return setError('Enter your name.');
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError('Enter a valid email address.');
    if (form.password.length < 12 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) return setError('Use at least 12 characters with a letter and a number.');
    if (form.password !== form.confirm) return setError('Your passwords do not match.');
    setBusy(true);
    try { await signup({ name: form.name.trim(), email: form.email.trim(), password: form.password }); navigate('/dashboard', { replace: true }); }
    catch (requestError) { setError(requestError.response?.data?.error || 'Unable to create your account. Check your connection and try again.'); }
    finally { setBusy(false); }
  }

  return <AuthFrame title="Start with a clear picture" subtitle="Create your private account to bring your finances together."
    footer={<>Already have an account? <Link to="/login">Sign in</Link></>}>
    <form onSubmit={submit} noValidate className="form-stack">
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      <label>Your name<input autoComplete="name" value={form.name} onChange={set('name')} required /></label>
      <label>Email address<input autoComplete="email" type="email" value={form.email} onChange={set('email')} required /></label>
      <label>Password <span className="field-hint">At least 12 characters, with a letter and number</span><input autoComplete="new-password" type="password" value={form.password} onChange={set('password')} required /></label>
      <label>Confirm password<input autoComplete="new-password" type="password" value={form.confirm} onChange={set('confirm')} required /></label>
      <button className="button button-primary button-wide" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
    </form>
  </AuthFrame>;
}
