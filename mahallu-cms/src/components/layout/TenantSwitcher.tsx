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

  // Close dropdown on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

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
      setLoadError(loadErrorMessage(error, 'Mahallus'));
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
        title={currentTenant ? `Mahallu: ${currentTenant.name}` : 'Select Mahallu'}
        aria-label={currentTenant ? `Switch Mahallu (currently ${currentTenant.name})` : 'Select Mahallu'}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className={cn(
          /* A visible border at rest — not just on hover/active — is what makes
           * this read as a real dropdown control rather than a ghost icon
           * button a user could easily miss in a busy header. */
          'flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-2 text-sm font-medium transition-colors sm:gap-2 sm:px-3',
          isViewingAsTenant
            ? 'border-primary/25 bg-primary/10 text-primary'
            : isOpen
              ? 'border-border bg-accent text-accent-foreground'
              : 'border-border/60 text-foreground hover:border-border hover:bg-accent hover:text-accent-foreground'
        )}
      >
        <FiLayers className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        {/* Visible at every width, not just md+: a super admin on a phone saw only
         * this icon before, with nothing telling them it's a Mahallu switcher or
         * which Mahallu (if any) they're viewing. The max-w steps up with the
         * viewport so it never crowds the notification/profile cluster on the
         * narrowest phones. */}
        <span className="min-w-0 max-w-[76px] truncate sm:max-w-[150px] md:max-w-[190px]">
          {currentTenant ? (
            <>
              <span className="text-muted-foreground">Mahallu:</span> {currentTenant.name}
            </>
          ) : (
            'Select Mahallu'
          )}
        </span>
        {isViewingAsTenant && (
          <span className="hidden flex-shrink-0 rounded-sm bg-primary/15 px-1.5 py-0.5 text-xs text-primary sm:inline-block">
            Viewing
          </span>
        )}
        <FiChevronDown className={cn('h-4 w-4 flex-shrink-0 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        /* Below sm: fixed + inset-x-4 anchors to the viewport itself (not the
         * trigger button), so the panel can't run off-screen regardless of how
         * close the button sits to the left edge. From sm up, it reverts to the
         * original left-anchored dropdown under the trigger. */
        <div className="fixed inset-x-4 top-16 z-50 flex max-h-[70vh] flex-col rounded-lg border border-border bg-popover py-2 shadow-md sm:absolute sm:inset-x-auto sm:left-0 sm:top-auto sm:mt-2 sm:max-h-[500px] sm:w-96 sm:max-w-[calc(100vw-2rem)]">
          {/* Switch back to Super Admin option */}
          {isViewingAsTenant && (
            <div className="mb-2 border-b border-border px-3 pb-2">
              <button
                onClick={handleSwitchToSuperAdmin}
                className="flex w-full items-center justify-between gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/15"
              >
                <div className="flex items-center gap-2">
                  <FiX className="h-4 w-4" />
                  <span>Exit Mahallu View</span>
                </div>
                <span className="text-xs opacity-75">Back to Super Admin</span>
              </button>
            </div>
          )}

          <div className="border-b border-border px-3 pb-2">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                aria-label="Search Mahallus"
                type="text"
                placeholder="Search Mahallus..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading...</div>
            ) : loadError ? (
              <div className="px-4 py-8 text-center text-sm text-destructive">
                {loadError}
                <p className="mt-2 text-muted-foreground">Check that you are logged in as Super Admin.</p>
              </div>
            ) : filteredTenants.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                {searchQuery
                  ? 'No Mahallus found matching your search'
                  : 'No Mahallus available. Create a Mahallu first.'}
              </div>
            ) : (
              <div className="space-y-1 py-1">
                {filteredTenants.map((tenant) => (
                  <button
                    key={tenant.id}
                    onClick={() => handleTenantSelect(tenant)}
                    className={cn(
                      'w-full border-l-4 px-4 py-3 text-left text-sm transition-colors hover:bg-accent',
                      currentTenantId === tenant.id
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-transparent text-foreground'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="mb-0.5 truncate text-base font-semibold">{tenant.name}</p>
                        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                          <span className="opacity-75">{tenant.code}</span>
                          <span>•</span>
                          <span>{tenant.location}</span>
                        </p>
                      </div>
                      {currentTenantId === tenant.id && (
                        <FiCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
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
