import { useAuthStore } from '@/store/authStore';

/**
 * Who may build, publish and review surveys (Mahallu admin, Super Admin) versus who only fills them
 * (survey worker). Display only: the API enforces the same split on every endpoint.
 */
export function useSurveyAccess() {
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const isAdmin = isSuperAdmin || user?.role === 'mahall' || user?.role === 'super_admin';
  return { isAdmin, userId: user?.id || '' };
}
