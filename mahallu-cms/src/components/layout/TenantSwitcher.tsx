import { useState, useEffect, useRef } from 'react';
import { FiChevronDown, FiLayers, FiCheck, FiSearch, FiX } from 'react-icons/fi';
import { useAuthStore } from '@/store/authStore';
import { tenantService } from '@/services/tenantService';
import { Tenant } from '@/types/tenant';
import { cn } from '@/utils/cn';
import { loadErrorMessage } from '@/utils/errors';

export default function TenantSwitcher() {
  const { isSuperAdmin, currentTenantId, setCurrentTenant } = useAuthStore();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenant, setCurrentTenantData] = useState<Tenant | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isViewingAsTenant = isSuperAdmin && currentTenantId;

  useEffect(() => {
    if (isSuperAdmin) {
      loadTenants();
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin && isOpen) {
      loadTenants();
    }
  }, [isOpen]);

  useEffect(() => {
    if (currentTenantId && tenants.length > 0) {
      const tenant = tenants.find((t) => t.id === currentTenantId);
      setCurrentTenantData(tenant || null);
    }
  }, [currentTenantId, tenants]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Reset search when closing dropdown
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  const loadTenants = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const response = await tenantService.getAll({ limit: 100 });
      setTenants(response.data || []);
    } catch (error: any) {
      console.error('Error loading tenants:', error);
      setTenants([]);
      setLoadError(loadErrorMessage(error, 'tenants'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleTenantSelect = (tenant: Tenant) => {
    setCurrentTenant(tenant.id);
    setCurrentTenantData(tenant);
    setIsOpen(false);
    // Reload page data with new tenant context
    window.location.reload();
  };

  const handleSwitchToSuperAdmin = () => {
    setCurrentTenant(null);
    setCurrentTenantData(null);
    setIsOpen(false);
    // Reload to switch back to super admin view
    window.location.reload();
  };

  const filteredTenants = tenants.filter((tenant) => {
    const query = searchQuery.toLowerCase();
    return (
      tenant.name.toLowerCase().includes(query) ||
      tenant.code.toLowerCase().includes(query) ||
      tenant.location.toLowerCase().includes(query)
    );
  });

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors border',
          isViewingAsTenant
            ? 'bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-900/20 dark:text-primary-400 dark:border-primary-800'
            : isOpen
              ? 'bg-gray-100 text-gray-900 border-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700'
              : 'border-transparent text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
        )}
      >
        <FiLayers className="h-4 w-4" />
        <span className="hidden md:inline max-w-[150px] truncate">
          {currentTenant ? currentTenant.name : 'Select Tenant'}
        </span>
        {isViewingAsTenant && (
          <span className="text-xs px-1.5 py-0.5 bg-primary-100 dark:bg-primary-800 rounded">Viewing</span>
        )}
        <FiChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        /* Anchored by its left edge, not right: on mobile this button sits near the
         * screen's left edge (right after the hamburger), and a right-anchored panel
         * this wide pushed almost entirely off-screen to the left. */
        <div className="absolute left-0 z-50 mt-2 flex max-h-[500px] w-80 max-w-[calc(100vw-2rem)] flex-col rounded-lg border border-gray-200 bg-white py-2 shadow-xl dark:border-gray-700 dark:bg-gray-900">
          {/* Switch back to Super Admin option */}
          {isViewingAsTenant && (
            <div className="px-3 pb-2 mb-2 border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={handleSwitchToSuperAdmin}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium rounded-md bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-700 dark:text-red-400 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FiX className="h-4 w-4" />
                  <span>Exit Tenant View</span>
                </div>
                <span className="text-xs opacity-75">Back to Super Admin</span>
              </button>
            </div>
          )}

          <div className="px-3 pb-2 border-b border-gray-100 dark:border-gray-800">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                aria-label="Search tenants"
                type="text"
                placeholder="Search tenants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all placeholder:text-gray-400 dark:text-white"
                autoFocus
              />
            </div>
          </div>

          <div className="overflow-y-auto max-h-[400px]">
            {isLoading ? (
              <div className="px-4 py-8 text-sm text-gray-500 text-center">Loading...</div>
            ) : loadError ? (
              <div className="px-4 py-8 text-sm text-red-600 dark:text-red-400 text-center">
                {loadError}
                <p className="mt-2 text-gray-500 dark:text-gray-400">
                  Check that you are logged in as Super Admin.
                </p>
              </div>
            ) : filteredTenants.length === 0 ? (
              <div className="px-4 py-8 text-sm text-gray-500 text-center">
                {searchQuery
                  ? 'No tenants found matching your search'
                  : 'No tenants available. Create a tenant first.'}
              </div>
            ) : (
              <div className="space-y-1 py-1">
                {filteredTenants.map((tenant) => (
                  <button
                    key={tenant.id}
                    onClick={() => handleTenantSelect(tenant)}
                    className={cn(
                      'w-full text-left px-4 py-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-l-4',
                      currentTenantId === tenant.id
                        ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/10 text-primary-700 dark:text-primary-400'
                        : 'border-transparent text-gray-700 dark:text-gray-300'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate text-base mb-0.5">{tenant.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
                          <span className="opacity-75">{tenant.code}</span>
                          <span>•</span>
                          <span>{tenant.location}</span>
                        </p>
                      </div>
                      {currentTenantId === tenant.id && (
                        <FiCheck className="h-5 w-5 mt-0.5 flex-shrink-0 text-primary-600 dark:text-primary-400" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
