import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './hooks/useAuth';
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute';
import MainLayout from './components/MainLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import DashboardShell from './pages/dashboard/DashboardShell';
import RequestDetailsEmployee from './pages/employee/RequestDetailsEmployee';
import UserManagementPage from './pages/UserManagementPage';
import CasesListPage from './pages/CasesListPage';
import CaseDetailsPage from './pages/CaseDetailsPage';
import ProfilePage from './pages/ProfilePage';
import ExecutionSettingsHomePage from './pages/ExecutionSettingsHomePage';
import NotificationSettingsPage from './pages/NotificationSettingsPage';
import PermissionsPanel from './pages/admin/PermissionsPanel';

import RequestsListPage from './pages/RequestsListPage';
import AboutPage from './pages/AboutPage';
import NotAuthorizedPage from './pages/NotAuthorizedPage';
import RecycleBinPage from './pages/RecycleBinPage';

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster 
          position="top-center"
          reverseOrder={false}
          gutter={8}
          toastOptions={{
            duration: 5000,
            style: {
              background: '#fff',
              color: '#363636',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
              borderRadius: '1rem',
              padding: '10px 16px',
            },
          }}
        />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/not-authorized" element={<NotAuthorizedPage />} />
          
          {/* Universal Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/" element={<DashboardShell />} />
              <Route path="/dashboard" element={<DashboardShell />} />
              <Route path="/requests" element={<RequestsListPage />} />
              <Route path="/employee/requests/:id" element={<RequestDetailsEmployee />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/about" element={<AboutPage />} />
            </Route>
          </Route>

          {/* Cases & Legal Management Protected Routes with Specific Roles */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'company_manager', 'assistant_manager', 'sales_employee', 'law_firm_manager', 'law_firm_assistant']} />}>
            <Route element={<MainLayout />}>
              <Route path="/cases" element={<CasesListPage />} />
              <Route path="/cases/:caseId" element={<CaseDetailsPage />} />
            </Route>
          </Route>

          {/* Recycle Bin accessible by managers */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'company_manager', 'assistant_manager']} />}>
            <Route element={<MainLayout />}>
              <Route path="/recycle-bin" element={<RecycleBinPage />} />
            </Route>
          </Route>

          {/* Admin Restricted Routes */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route element={<MainLayout />}>
              <Route path="/users" element={<UserManagementPage />} />
              <Route path="/settings/execution" element={<ExecutionSettingsHomePage />} />
              <Route path="/settings/notifications" element={<NotificationSettingsPage />} />
              <Route path="/admin/permissions" element={<PermissionsPanel />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}
