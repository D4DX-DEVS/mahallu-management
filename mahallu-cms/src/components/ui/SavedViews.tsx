import { useEffect, useRef, useState } from 'react';
import { FiBookmark, FiCheck, FiChevronDown, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { cn } from '@/utils/cn';
import { useDismiss } from '@/hooks/useDismiss';
import { toast } from '@/store/toastStore';
import type { FilterRecord } from '@/hooks/useUrlFilters';

interface SavedView {
  id: string;
  name: string;
  filters: FilterRecord;
}

const storeKey = (pageKey: string) => `mahallu.views.${pageKey}`;

function loadViews(pageKey: string): SavedView[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(storeKey(pageKey)) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(pageKey: string, views: SavedView[]) {
  try {
    localStorage.setItem(storeKey(pageKey), JSON.stringify(views));
  } catch {
    /* storage unavailable */
  }
}

export interface SavedViewsProps {
  /** Unique key for this list page, e.g. "families". */
  pageKey: string;
  /** The useUrlFilters() result for the page. */
  filters: {
    activeFilters: FilterRecord;
    activeCount: number;
    apply: (record: FilterRecord) => void;
    clear: () => void;
  };
  className?: string;
}

const same = (a: FilterRecord, b: FilterRecord) => {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
};

/** "Views" dropdown for FilterBar: save / apply / rename / delete filter sets, plus the active-count chip and Clear all. */
export default function SavedViews({ pageKey, filters, className }: SavedViewsProps) {
  const [open, setOpen] = useState(false);
  const [views, setViews] = useState<SavedView[]>(() => loadViews(pageKey));
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));

  useEffect(() => {
    setViews(loadViews(pageKey));
  }, [pageKey]);

  const update = (next: SavedView[]) => {
    setViews(next);
    persist(pageKey, next);
  };

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed || filters.activeCount === 0) return;
    const existing = views.find((v) => v.name.toLowerCase() === trimmed.toLowerCase());
    const entry: SavedView = { id: existing?.id ?? `${Date.now()}`, name: trimmed, filters: { ...filters.activeFilters } };
    update(existing ? views.map((v) => (v.id === existing.id ? entry : v)) : [...views, entry]);
    setName('');
    toast.success(`View "${trimmed}" saved`);
  };

  const commitRename = () => {
    const trimmed = editName.trim();
    if (trimmed && editingId) update(views.map((v) => (v.id === editingId ? { ...v, name: trimmed } : v)));
    setEditingId(null);
  };

  const iconBtn =
    'rounded-md p-1 text-[#7B8983] hover:bg-white hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-lime dark:hover:bg-surface-card dark:hover:text-brand-lime';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="inline-flex h-[34px] max-sm:h-10 items-center gap-1.5 rounded-[10px] border border-line-strong bg-white px-3 text-xs font-semibold text-[#3A4741] transition-colors hover:bg-[#F4F7F5] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28] dark:border-surface-border-strong dark:bg-surface-raised dark:text-surface-text dark:hover:bg-surface-hover"
        >
          <FiBookmark className="h-3.5 w-3.5" aria-hidden="true" />
          Views
          <FiChevronDown className="h-3 w-3 opacity-60" aria-hidden="true" />
        </button>
        {open && (
          <div role="dialog" aria-label="Saved views" className="absolute left-0 z-50 mt-1.5 w-72 rounded-xl border border-line bg-white p-2 shadow-pop dark:border-surface-border dark:bg-surface-raised">
            <p className="px-2 pb-1 pt-1 text-[12px] font-bold uppercase tracking-[0.03em] text-[#7B8983] dark:text-surface-muted">Saved views</p>
            {views.length === 0 ? (
              <p className="px-2 pb-2 text-xs text-[#7B8983] dark:text-surface-muted">No saved views yet. Set some filters, name them below and save.</p>
            ) : (
              <ul className="max-h-56 overflow-y-auto">
                {views.map((v) => {
                  const isActive = same(v.filters, filters.activeFilters);
                  return (
                    <li key={v.id} className="group flex items-center gap-1 rounded-lg px-1 hover:bg-[#F4F7F5] dark:hover:bg-surface-hover">
                      {editingId === v.id ? (
                        <input
                          autoFocus
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename();
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          onBlur={commitRename}
                          aria-label="Rename view"
                          className="my-1 h-7 min-w-0 flex-1 rounded-md border border-primary-600 bg-white px-2 text-xs focus:outline-none dark:bg-surface-card dark:text-surface-text"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            filters.apply(v.filters);
                            setOpen(false);
                          }}
                          className="flex min-w-0 flex-1 items-center gap-1.5 px-1.5 py-2 text-left text-[12.5px] font-semibold text-[#3A4741] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-lime dark:text-surface-text"
                        >
                          {isActive ? <FiCheck className="h-3.5 w-3.5 flex-shrink-0 text-primary-700 dark:text-brand-lime" /> : <span className="w-3.5 flex-shrink-0" />}
                          <span className="truncate">{v.name}</span>
                        </button>
                      )}
                      <button type="button" className={iconBtn} aria-label={`Rename view ${v.name}`} onClick={() => { setEditingId(v.id); setEditName(v.name); }}>
                        <FiEdit2 className="h-3 w-3" />
                      </button>
                      <button type="button" className={iconBtn} aria-label={`Delete view ${v.name}`} onClick={() => update(views.filter((x) => x.id !== v.id))}>
                        <FiTrash2 className="h-3 w-3" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-1 border-t border-line-soft pt-2 dark:border-surface-border">
              <div className="flex gap-1.5 px-1">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && save()}
                  placeholder={filters.activeCount ? 'Name this view' : 'Apply a filter first'}
                  disabled={filters.activeCount === 0}
                  aria-label="View name"
                  maxLength={40}
                  className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-[#F4F7F5] px-2.5 text-xs focus:border-primary-600 focus:bg-white focus:outline-none disabled:opacity-60 dark:border-surface-border dark:bg-surface-card dark:text-surface-text"
                />
                <button
                  type="button"
                  onClick={save}
                  disabled={!name.trim() || filters.activeCount === 0}
                  className="h-8 rounded-lg bg-primary-700 px-3 text-xs font-semibold text-white transition-colors hover:bg-primary-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28] disabled:opacity-40 dark:bg-brand-lime dark:text-primary-950"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {filters.activeCount > 0 && (
        <>
          <span className="inline-flex h-[22px] items-center rounded-full bg-mint px-2 text-[12px] font-bold text-primary-700 dark:bg-brand-lime/15 dark:text-brand-lime" aria-label={`${filters.activeCount} active filters`}>
            {filters.activeCount} {filters.activeCount === 1 ? 'filter' : 'filters'}
          </span>
          <button type="button" onClick={filters.clear} className="text-xs font-semibold text-[#5B6963] underline-offset-2 hover:text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-lime dark:text-surface-muted dark:hover:text-brand-lime">
            Clear all
          </button>
        </>
      )}
    </div>
  );
}

