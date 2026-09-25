import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

const navigation = [
  { to: '/dashboard', label: 'Overview' },
  { to: '/expenses', label: 'Expenses' },
  { to: '/income', label: 'Income' },
  { to: '/goals', label: 'Goals' },
  { to: '/advice', label: 'Insights & AI' },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    try { await logout(); }
    catch (_error) { /* AuthContext clears the local token even if the API is unreachable. */ }
    finally { navigate('/login', { replace: true }); setBusy(false); }
  }

  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
      <NavLink to="/dashboard" className="brand" onClick={() => setMenuOpen(false)}><span className="brand-symbol">F</span>fintrack</NavLink>
      <span className="nav-heading">YOUR FINANCES</span>
      <nav aria-label="Main navigation" className="side-nav">
        {navigation.map((item, index) => <NavLink key={item.to} to={item.to} onClick={() => setMenuOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
          <span className="nav-index">0{index + 1}</span>{item.label}
        </NavLink>)}
      </nav>
      <div className="sidebar-bottom"><div className="user-card"><span className="user-avatar">{user?.name?.slice(0, 1).toUpperCase()}</span><span className="user-details"><strong>{user?.name}</strong><small>{user?.email}</small></span></div>
        <button className="signout-button" onClick={signOut} disabled={busy}>{busy ? 'Signing out…' : 'Sign out'}</button></div>
    </aside>
    {menuOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <div className="workspace"><header className="mobile-header"><button className="menu-toggle" aria-label="Open navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>☰</button><span className="brand"><span className="brand-symbol">F</span>fintrack</span><span className="mobile-user">{user?.name?.split(' ')[0]}</span></header>
      <main className="page-content"><Outlet /></main><footer className="app-footer">FINTRACK <span>Personal finance, made clearer.</span></footer></div>
  </div>;
}
