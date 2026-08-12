import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { tenantService } from '@/services/tenantService';
import { Tenant } from '@/types/tenant';

export function useTenant() {
  const { currentTenantId } = useAuthStore();
  const setTenantFeatures = useAuthStore((state) => state.setTenantFeatures);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Loads for every role: module gating needs settings.features, not just super admins.
  useEffect(() => {
    if (currentTenantId) {
      loadTenant();
    }
  }, [currentTenantId]);

  const loadTenant = async () => {
    if (!currentTenantId) return;
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

