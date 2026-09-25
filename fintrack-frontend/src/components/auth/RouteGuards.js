import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { LoadingState } from '../shared/States';

export function ProtectedRoute() {
  const { user, checking, sessionError, validateSession } = useAuth();
  const location = useLocation();
  if (checking) return <LoadingState label="Checking your session…" />;
  if (sessionError) return <div className="center-card"><p role="alert">{sessionError}</p><button onClick={validateSession}>Try again</button></div>;
  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

export function PublicOnlyRoute() {
  const { user, checking } = useAuth();
  if (checking) return <LoadingState label="Checking your session…" />;
  return user ? <Navigate to="/dashboard" replace /> : <Outlet />;
}
