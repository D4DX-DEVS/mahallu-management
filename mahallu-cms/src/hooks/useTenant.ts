import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { tenantService } from '@/services/tenantService';
import { canReadTenantInfo } from '@/utils/apiAccess';
import { Tenant } from '@/types/tenant';

export function useTenant() {
  const currentTenantId = useAuthStore((state) => state.currentTenantId);
  const role = useAuthStore((state) => state.user?.role);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const setTenantFeatures = useAuthStore((state) => state.setTenantFeatures);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const allowed = canReadTenantInfo(role, isSuperAdmin);

  const loadTenant = useCallback(
    async (force = false) => {
      if (!currentTenantId) return;
      // Member (portal) accounts may not read the tenant: leave every module enabled and
      // let the role's own menu decide what is shown.
      if (!allowed) {
        setTenantFeatures(null);
        return;
      }
      try {
        setIsLoading(true);
        // Shared, cached read (see tenantService.getById): one request for the whole app.
        const data = await tenantService.getById(currentTenantId, { force });
        setTenant(data);
        setTenantFeatures((data as any)?.settings?.features ?? null);
      } catch (error) {
        console.error('Error loading tenant:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [currentTenantId, allowed, setTenantFeatures]
  );

  // Loads for every role that may read it: module gating needs settings.features, not just super admins.
  useEffect(() => {
    loadTenant();
  }, [loadTenant]);

  return { tenant, isLoading, reload: () => loadTenant(true) };
}
