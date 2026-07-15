import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/layout/Layout';
import LoginPage from '@/pages/auth/LoginPage';
import ProfileSetupPage from '@/pages/auth/ProfileSetupPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import TodoPage from '@/pages/todo/TodoPage';
import FinanceLayout from '@/pages/finance/FinanceLayout';
import AccountListPage from '@/pages/finance/AccountListPage';
import TransactionListPage from '@/pages/finance/TransactionListPage';
import IAMLayout from '@/pages/iam/IAMLayout';
import UserListPage from '@/pages/iam/UserListPage';
import EntityListPage from '@/pages/iam/EntityListPage';
import DepartmentPage from '@/pages/iam/DepartmentPage';
import JobTitlePage from '@/pages/iam/JobTitlePage';
import OrgChartPage from '@/pages/iam/OrgChartPage';
import BeliRulePage from '@/pages/iam/BeliRulePage';
import ContractLayout from '@/pages/contract/ContractLayout';
import ContractListPage from '@/pages/contract/ContractListPage';
import CounterpartyListPage from '@/pages/contract/CounterpartyListPage';
import ProjectLayout from '@/pages/project/ProjectLayout';
import ProjectListPage from '@/pages/project/ProjectListPage';
import ProjectDetailPage from '@/pages/project/ProjectDetailPage';
import DevelopmentProgressPage from '@/pages/project/DevelopmentProgressPage';
import DocumentListPage from '@/pages/kb/DocumentListPage';
import DocumentDetailPage from '@/pages/kb/DocumentDetailPage';
import ChatPage from '@/pages/kb/ChatPage';
import MeetingListPage from '@/pages/meeting/MeetingListPage';
import MeetingDetailPage from '@/pages/meeting/MeetingDetailPage';
import WeChatNotifyPage from '@/pages/wechat-notify/WeChatNotifyPage';
import McpPage from '@/pages/mcp/McpPage';
import McpToolDetailPage from '@/pages/mcp/McpToolDetailPage';

const getRouterBasename = () => {
  const base = import.meta.env.BASE_URL || '/';
  const path = window.location.pathname;
  if (path === '/punkrecord' || path.startsWith('/punkrecord/')) {
    return '/punkrecord';
  }
  return base === '/' ? '/' : base.replace(/\/$/, '');
};

// Protected Route wrapper
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // First-time login: force profile setup
  if (!user.profile_completed || user.must_change_password) {
    return <Navigate to="/profile-setup" replace />;
  }

  return children;
};

// Permission-guarded Route wrapper
const PermissionRoute = ({ permission, children }) => {
  const { hasPermission } = useAuth();

  if (!hasPermission(permission)) {
    return (
      <div style={{ padding: '60px 40px', textAlign: 'center', color: '#888' }}>
        <h2>403 - 无访问权限</h2>
        <p>你没有访问此模块的权限，请联系管理员。</p>
      </div>
    );
  }

  return children;
};

function App() {
  return (
    <BrowserRouter basename={getRouterBasename()}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/profile-setup" element={<ProfileSetupPage />} />

          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<DashboardPage />} />
            <Route path="todo" element={<PermissionRoute permission="todo.read"><TodoPage /></PermissionRoute>} />
            <Route path="iam" element={<PermissionRoute permission="iam.read"><IAMLayout /></PermissionRoute>}>
              <Route path="users" element={<UserListPage />} />
              <Route path="entities" element={<EntityListPage />} />
              <Route path="departments" element={<DepartmentPage />} />
              <Route path="job-titles" element={<JobTitlePage />} />
              <Route path="beli-rules" element={<BeliRulePage />} />
              <Route path="org-chart" element={<OrgChartPage />} />
            </Route>
            <Route path="contract" element={<PermissionRoute permission="contract.read"><ContractLayout /></PermissionRoute>}>
              <Route path="list" element={<ContractListPage />} />
              <Route path="counterparties" element={<CounterpartyListPage />} />
            </Route>
            <Route path="project" element={<PermissionRoute permission="project.read"><ProjectLayout /></PermissionRoute>}>
              <Route index element={<ProjectListPage />} />
              <Route path=":id" element={<ProjectDetailPage />} />
              <Route path=":id/dev-progress" element={<DevelopmentProgressPage />} />
            </Route>

            <Route path="finance" element={<PermissionRoute permission="finance.read"><FinanceLayout /></PermissionRoute>}>
              <Route path="accounts" element={<AccountListPage />} />
              <Route path="transactions" element={<TransactionListPage />} />
            </Route>

            <Route path="kb" element={<PermissionRoute permission="kb.read"><DocumentListPage /></PermissionRoute>} />
            <Route path="kb/chat" element={<PermissionRoute permission="kb.read"><ChatPage /></PermissionRoute>} />
            <Route path="kb/chat/:id" element={<PermissionRoute permission="kb.read"><ChatPage /></PermissionRoute>} />
            <Route path="kb/documents/:id" element={<PermissionRoute permission="kb.read"><DocumentDetailPage /></PermissionRoute>} />

            <Route path="meeting" element={<PermissionRoute permission="meeting.read"><MeetingListPage /></PermissionRoute>} />
            <Route path="meeting/:id" element={<PermissionRoute permission="meeting.read"><MeetingDetailPage /></PermissionRoute>} />

            <Route path="wechat-notify" element={<WeChatNotifyPage />} />

            <Route path="mcp" element={<McpPage />} />
            <Route path="mcp/tools/:toolName" element={<McpToolDetailPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
