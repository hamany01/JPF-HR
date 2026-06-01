import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { UserRole } from '../types/user';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && profile) {
    if (!allowedRoles.includes(profile.role)) {
      return <Navigate to="/not-authorized" replace />;
    }
  }

  return <Outlet />;
}

export function AdminRoute() {
  const { user, profile, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user || !isAdmin) return <Navigate to="/" replace />;

  return <Outlet />;
}
