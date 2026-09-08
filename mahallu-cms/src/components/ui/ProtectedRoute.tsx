import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

interface ProtectedRouteProps {
  children: ReactNode;
  superAdminOnly?: boolean;
  allowedRoles?: Array<'super_admin' | 'mahall' | 'survey' | 'institute' | 'member'>;
}

export default function ProtectedRoute({
  children,
  superAdminOnly = false,
  allowedRoles,
}: ProtectedRouteProps) {
  const { user, isSuperAdmin } = useAuthStore();
  const location = useLocation();
  const isMemberPortalPath = location.pathname === '/member' || location.pathname.startsWith('/member/');

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'member' && !isMemberPortalPath) {
    return <Navigate to="/member/overview" replace />;
  }

  if (user.role !== 'member' && isMemberPortalPath) {
    return <Navigate to="/dashboard" replace />;
  }

  if (superAdminOnly && !isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (allowedRoles && !isSuperAdmin && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'member' ? '/member/overview' : '/dashboard'} replace />;
  }

  return <>{children}</>;
}
