import { ReactNode, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Location, Route, Routes, useLocation, useNavigationType } from 'react-router-dom';
import { FiX } from 'react-icons/fi';
import Modal from '@/components/ui/Modal';
import Skeleton from '@/components/ui/Skeleton';
import ProtectedRoute from '@/components/ui/ProtectedRoute';
import { ModalPageContext, ModalPageSize, RefreshKeyContext, modalNav } from '@/hooks/useModalContext';
import { getMutationCount } from '@/services/mutationTracker';
import { getModalSize, getResolvedRoutes } from '@/routes/modalRegistry';

/**
 * Modal-route layer. When the user navigates in-app (PUSH) from a page to a modal-able route
 * (see routes/modalRegistry.ts), the previous page stays rendered via <Routes location={background}>
 * and the target page renders inside a Modal on top. Deep links, refresh and POP navigation
 * to an entry that has no remembered background render the full page.
 *
 * The background is remembered in memory keyed by history entry key (so Back/Forward re-open the
 * modal), which means existing navigate()/<Link> call sites need no changes.
 */

interface Entry {
  bg: Location;
  /** history index of the background entry */
  bgIdx: number;
}

const histIdx = () => ((window.history.state as { idx?: number } | null)?.idx ?? 0);

export default function ModalRoutes({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navType = useNavigationType();
  const entries = useRef(new Map<string, Entry | null>());
  const closing = useRef(new Map<string, { modalLoc: Location; entry: Entry }>());
  const lastLoc = useRef<Location | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // --- decide, per history entry, whether it is shown as a modal (idempotent per location.key)
  let entry = entries.current.get(location.key);
  if (entry === undefined) {
    const prev = lastLoc.current;
    const prevEntry = prev ? entries.current.get(prev.key) ?? null : null;
    entry = null;
    if (prev && navType !== 'POP') {
      const targetIsModal = !!getModalSize(location);
      if (targetIsModal) {
        if (prevEntry) entry = prevEntry;
        else if (navType === 'PUSH' && !getModalSize(prev)) entry = { bg: prev, bgIdx: histIdx() - 1 };
      } else if (prevEntry && navType === 'PUSH' && location.pathname === prevEntry.bg.pathname) {
        // navigate(LIST) from a modal => close the modal instead of stacking a second list entry
        closing.current.set(location.key, { modalLoc: prev, entry: prevEntry });
      }
    }
    entries.current.set(location.key, entry);
  }
  const closingNow = navType === 'PUSH' ? closing.current.get(location.key) : undefined;

  const modalLoc = closingNow ? closingNow.modalLoc : entry ? location : null;
  const activeEntry = closingNow ? closingNow.entry : entry;
  const bgLoc = activeEntry ? activeEntry.bg : null;
  const modalSize = modalLoc ? getModalSize(modalLoc) : null;

  useEffect(() => {
    lastLoc.current = location;
  });

  const closingDone = useRef<string | null>(null);
  useEffect(() => {
    if (!closingNow || closingDone.current === location.key) return;
    closingDone.current = location.key;
    modalNav.bypassGuard = true;
    window.history.go(closingNow.entry.bgIdx - histIdx());
    window.setTimeout(() => {
      modalNav.bypassGuard = false;
    }, 400);
  }, [closingNow, location.key]);

  // --- refetch the background page when a modal closed after a successful write
  const openInfo = useRef<{ count: number; path: string } | null>(null);
  const isOpen = !!modalLoc && !!modalSize;
  useEffect(() => {
    if (isOpen && !openInfo.current) {
      openInfo.current = { count: getMutationCount(), path: bgLoc?.pathname ?? '' };
    } else if (!isOpen && openInfo.current) {
      const info = openInfo.current;
      openInfo.current = null;
      if (getMutationCount() !== info.count && location.pathname === info.path) setRefreshKey((k) => k + 1);
    }
  }, [isOpen, bgLoc, location.pathname]);

  const close = useCallback(() => {
    const e = activeEntry;
    if (!e) return;
    window.history.go(e.bgIdx - histIdx());
  }, [activeEntry]);

  return (
    <>
      <RefreshKeyContext.Provider value={refreshKey}>
        <Routes location={bgLoc ?? location}>{children}</Routes>
      </RefreshKeyContext.Provider>
      {isOpen && modalLoc && modalSize && <ModalLayer location={modalLoc} size={modalSize} onClose={close} />}
    </>
  );
}

function ModalSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

function ModalLayer({ location, size, onClose }: { location: Location; size: ModalPageSize; onClose: () => void }) {
  const routes = useMemo(() => getResolvedRoutes().filter((r) => r.size), []);
  const [headerEl, setHeaderEl] = useState<HTMLElement | null>(null);
  const titleId = 'route-modal-title';

  // Esc is handled by Modal; skip it when a nested dialog (confirm / unsaved prompt) is on top.
  const guardedClose = useCallback(() => {
    if (document.querySelectorAll('[role="dialog"][aria-modal="true"]').length > 1) return;
    onClose();
  }, [onClose]);

  const ctx = useMemo(
    () => ({ isInModal: true, close: onClose, size, headerEl, titleId }),
    [onClose, size, headerEl]
  );

  return (
    <ModalPageContext.Provider value={ctx}>
      <Modal
        isOpen
        onClose={guardedClose}
        size={size}
        mobileSheet
        labelledBy={titleId}
        bodyClassName="route-modal-body relative"
        header={
          <div className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-line-soft px-4 py-3 sm:px-5 sm:py-3.5 dark:border-surface-border">
            <div ref={setHeaderEl} className="min-w-0 flex-1" />
            <button
              type="button"
              onClick={guardedClose}
              aria-label="Close dialog"
              className="-mr-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-[#7B8983] sm:h-8 sm:w-8 transition-colors hover:bg-[#F4F7F5] hover:text-[#18231E] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28] dark:text-surface-muted dark:hover:bg-surface-hover dark:hover:text-surface-text"
            >
              <FiX className="h-4 w-4" />
            </button>
          </div>
        }
      >
        <Suspense fallback={<ModalSkeleton />}>
          <Routes location={location}>
            {routes.map((r) => (
              <Route
                key={r.path}
                path={r.path}
                element={
                  <ProtectedRoute superAdminOnly={r.entry.superAdminOnly} allowedRoles={r.entry.allowedRoles}>
                    {r.entry.element}
                  </ProtectedRoute>
                }
              />
            ))}
            <Route path="*" element={null} />
          </Routes>
        </Suspense>
      </Modal>
    </ModalPageContext.Provider>
  );
}
