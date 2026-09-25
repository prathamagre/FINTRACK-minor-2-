import React from 'react';

export function LoadingState({ label = 'Loading…' }) {
  return <div className="state-box" role="status"><span className="spinner" aria-hidden="true" />{label}</div>;
}

export function ErrorState({ message, onRetry }) {
  return <div className="notice notice-error" role="alert"><span>{message}</span>{onRetry && <button className="button button-small button-secondary" onClick={onRetry}>Retry</button>}</div>;
}

export function EmptyState({ title, detail }) {
  return <div className="empty-state"><span className="empty-mark" aria-hidden="true">—</span><strong>{title}</strong>{detail && <p>{detail}</p>}</div>;
}

export function PageHeader({ eyebrow, title, description, action }) {
  return <header className="page-header"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</header>;
}

export const currency = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(Number(value) || 0);
