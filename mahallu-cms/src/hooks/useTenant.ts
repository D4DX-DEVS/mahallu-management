import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { tenantService } from '@/services/tenantService';
import { Tenant } from '@/types/tenant';

export function useTenant() {
  const { currentTenantId } = useAuthStore();
  const role = useAuthStore((state) => state.user?.role);
  const setTenantFeatures = useAuthStore((state) => state.setTenantFeatures);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Loads for every staff role: module gating needs settings.features.
  // Members are not gated by modules and cannot read tenant settings, so
  // asking for them only produced a 403 on every member-portal page.
  const isMember = role === 'member';

  useEffect(() => {
    if (currentTenantId && !isMember) {
      loadTenant();
    }
  }, [currentTenantId, isMember]);

  const loadTenant = async () => {
    if (!currentTenantId || isMember) return;
    try {
      setIsLoading(true);
      const data = await tenantService.getById(currentTenantId);
      setTenant(data);
      setTenantFeatures((data as any)?.settings?.features ?? null);
    } catch (error) {
      console.error('Error loading tenant:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return { tenant, isLoading, reload: loadTenant };
}
