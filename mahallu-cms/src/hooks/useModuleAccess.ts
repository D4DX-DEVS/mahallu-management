import { useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import type { ModuleKey } from '@/constants/modules';

/**
 * Module gating driven by tenant.settings.features (seeded from the Mahallu
 * classification). Unknown/absent keys default to ENABLED so tenants created
 * before classification existed keep every module.
 */
export function useModuleAccess() {
  const features = useAuthStore((state) => state.tenantFeatures);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);

  const isModuleEnabled = useCallback(
    (moduleKey?: ModuleKey) => {
      if (!moduleKey || isSuperAdmin) return true;
      if (!features) return true;
      return features[moduleKey] !== false;
    },
    [features, isSuperAdmin]
  );

  return { isModuleEnabled };
}
