import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute, PublicOnlyRoute } from './components/auth/RouteGuards';
import AppShell from './components/layout/AppShell';
import { LoginPage, SignupPage } from './views/auth/AuthPages';
import DashboardPage from './views/dashboard/DashboardPage';
import ExpensesPage from './views/expenses/ExpensesPage';
import IncomePage from './views/income/IncomePage';
import GoalsPage from './views/goals/GoalsPage';
import AdvicePage from './views/advice/AdvicePage';
import './App.css';

export default function App() {
  return <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AuthProvider><Routes>
    <Route element={<PublicOnlyRoute />}>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
    </Route>
    <Route element={<ProtectedRoute />}><Route element={<AppShell />}>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/expenses" element={<ExpensesPage />} />
      <Route path="/income" element={<IncomePage />} />
      <Route path="/goals" element={<GoalsPage />} />
      <Route path="/advice" element={<AdvicePage />} />
      <Route path="/view-expenses" element={<Navigate to="/expenses" replace />} />
      <Route path="/about" element={<Navigate to="/dashboard" replace />} />
    </Route></Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></AuthProvider></BrowserRouter>;
}
