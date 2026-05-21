import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { AuthProvider } from './hooks/useAuth';
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute';
import MainLayout from './components/MainLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UserManagementPage from './pages/UserManagementPage';
import CasesListPage from './pages/CasesListPage';
import CaseDetailsPage from './pages/CaseDetailsPage';
import ProfilePage from './pages/ProfilePage';
import ExecutionSettingsHomePage from './pages/ExecutionSettingsHomePage';
import NotificationSettingsPage from './pages/NotificationSettingsPage';

import RequestsListPage from './pages/RequestsListPage';

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
          
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/requests" element={<RequestsListPage />} />
              <Route path="/cases" element={<CasesListPage />} />
              <Route path="/cases/:caseId" element={<CaseDetailsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              
              <Route element={<AdminRoute />}>
                <Route path="/users" element={<UserManagementPage />} />
                <Route path="/settings/execution" element={<ExecutionSettingsHomePage />} />
                <Route path="/settings/notifications" element={<NotificationSettingsPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <SpeedInsights />
      </AuthProvider>
    </Router>
  );
}
