import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/layout/Layout';
import LoginPage from '@/pages/auth/LoginPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import TodoPage from '@/pages/todo/TodoPage';
import FinanceLayout from '@/pages/finance/FinanceLayout';
import AccountListPage from '@/pages/finance/AccountListPage';
import TransactionListPage from '@/pages/finance/TransactionListPage';
import IAMLayout from '@/pages/iam/IAMLayout';
import UserListPage from '@/pages/iam/UserListPage';
import EntityListPage from '@/pages/iam/EntityListPage';
import ContractLayout from '@/pages/contract/ContractLayout';
import ContractListPage from '@/pages/contract/ContractListPage';
import CounterpartyListPage from '@/pages/contract/CounterpartyListPage';

// Protected Route wrapper
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<DashboardPage />} />
            <Route path="todo" element={<TodoPage />} />
            <Route path="iam" element={<IAMLayout />}>
              <Route path="users" element={<UserListPage />} />
              <Route path="entities" element={<EntityListPage />} />
            </Route>
            <Route path="contract" element={<ContractLayout />}>
              <Route path="list" element={<ContractListPage />} />
              <Route path="counterparties" element={<CounterpartyListPage />} />
            </Route>
            <Route path="project" element={<div>Project Module (Coming Soon)</div>} />

            <Route path="finance" element={<FinanceLayout />}>
              <Route path="accounts" element={<AccountListPage />} />
              <Route path="transactions" element={<TransactionListPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
