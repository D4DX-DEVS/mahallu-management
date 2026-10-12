/**
 * QUICK VIEW SYSTEM  (row "eye" action -> pop-up modal instead of a full detail page)
 * -----------------------------------------------------------------------------------
 * Pieces
 *   DetailModal            this file. Presentational shell: gradient header (avatar, title, subtitle,
 *                          badges, Prev/Next "n of N", Close), optional Tabs, scroll body, sticky footer
 *                          (Open full page / Edit / primary action). Built on ui/Modal (focus trap,
 *                          Escape, scroll lock, role=dialog, aria-labelledby). Full-screen sheet < 640px.
 *   DetailSection/Field/Stats/List/Skeleton/Error   building blocks (same file) for the body.
 *   useDetailModal(ids)    hooks/useDetailModal.ts. `?view=<id>` in the URL + prev/next over the page's ids.
 *   useDetailRecord(...)   hooks/useDetailRecord.ts. fetch-by-id with cache, neighbour prefetch, abort.
 *   <Thing>QuickView       one small component per entity (see features/families/components/FamilyQuickView.tsx).
 *
 * Wiring a list page (the whole recipe)
 *   1. const detail = useDetailModal(rows.map((r) => String(r.id)));
 *   2. Eye button:  onClick={() => detail.open(String(row.id))}  aria-label="Quick view"
 *      Row:         onRowClick={(row) => detail.open(String(row.id))}   (Table gives Enter + click; dbl-click is not needed)
 *   3. Render once, outside the Table:  <ThingQuickView detail={detail} rows={rows} canEdit />
 *   4. ThingQuickView = useDetailRecord({ key, id: detail.viewId, fetcher, prefetchIds: [prev, next] })
 *      + <DetailModal ...> with DetailSection/DetailField/DetailStats/DetailList children.
 *   5. fullPageHref = existing DETAIL route, editHref = existing EDIT route (omit when the role may not edit).
 * Keep the full detail page untouched; it stays reachable through "Open full page".
 */
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiAlertCircle, FiArrowUpRight, FiCheck, FiChevronLeft, FiChevronRight, FiCopy, FiEdit2, FiX } from 'react-icons/fi';
import Modal from './Modal';
import Tabs, { TabOption } from './Tabs';
import Alert from './Alert';
import Button from './Button';
import Skeleton from './Skeleton';
import StatCard, { StatCardProps } from './StatCard';
import { toast } from '@/store/toastStore';
import { cn } from '@/utils/cn';

/* ----------------------------------------------------------------------------------------- */
/* DetailModal                                                                                */
/* ----------------------------------------------------------------------------------------- */

/** Matches what useDetailModal() returns, so a page can pass `nav={detail}` directly. */
export interface DetailNav {
  index: number;
  total: number;
  hasPrev: boolean;
  hasNext: boolean;
  prev: () => void;
  next: () => void;
}

export interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Main title (house name, person name...). Shown in the header and used as the dialog's accessible name. */
  title: string;
  /** Line under the title: head of family, ID, age / gender... */
  subtitle?: ReactNode;
  /** Icon inside the avatar tile. Falls back to initials of `title`. */
  icon?: ReactNode;
  /** Replaces the icon tile entirely, e.g. <Avatar size={56} name=... src=... /> for people and families. */
  avatar?: ReactNode;
  /** Status / grade badges shown under the subtitle. */
  badges?: ReactNode;
  /** Prev / Next + "n of N" + keyboard J/K or arrow keys. Hidden when index < 0 or total < 2. */
  nav?: DetailNav;
  /** Optional tabs (Overview / Members ...). Controlled; render the active panel as `children`. */
  tabs?: TabOption[];
  tab?: string;
  onTabChange?: (tab: string) => void;
  /** Body states. `loading` shows DetailSkeleton, `error` shows DetailError with Retry. */
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Existing detail route. Renders the ghost "Open full page" link. */
  fullPageHref?: string;
  /** Existing edit route. Pass ONLY when the current role may edit (same check as the list's edit button). */
  editHref?: string;
  /** Optional primary action (Approve, Collect...). Rendered at the right end of the footer. */
  primaryAction?: ReactNode;
  children?: ReactNode;
}

const GHOST_LINK =
  'inline-flex h-[34px] items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] px-3 max-sm:h-11 text-[12.5px] font-bold transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28] ';
const GHOST = GHOST_LINK + 'sm:-ml-3 bg-transparent text-primary-600 hover:bg-mint dark:text-brand-lime dark:hover:bg-surface-hover';
const SECONDARY =
  GHOST_LINK +
  'border border-line-strong bg-white font-semibold text-[#18231E] hover:bg-[#F4F7F5] dark:border-surface-border-strong dark:bg-surface-raised dark:text-surface-text dark:hover:bg-surface-hover';

const ICON_BTN =
  'flex h-8 w-8 items-center justify-center rounded-lg text-[#5B6963] transition-colors max-sm:h-10 max-sm:w-10 hover:bg-white/80 hover:text-[#18231E] ' +
  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28] disabled:pointer-events-none disabled:opacity-35 ' +
  'dark:text-surface-muted dark:hover:bg-surface-hover dark:hover:text-surface-text';

function initials(text: string) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export default function DetailModal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  avatar,
  badges,
  nav,
  tabs,
  tab,
  onTabChange,
  loading,
  error,
  onRetry,
  fullPageHref,
  editHref,
  primaryAction,
  children,
}: DetailModalProps) {
  const showNav = !!nav && nav.index >= 0 && nav.total > 1;

  // J / K or Left / Right arrows step through the list rows.
  useEffect(() => {
    if (!isOpen || !showNav || !nav) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      if ((e.key === 'j' || e.key === 'ArrowRight') && nav.hasNext) {
        e.preventDefault();
        nav.next();
      } else if ((e.key === 'k' || e.key === 'ArrowLeft') && nav.hasPrev) {
        e.preventDefault();
        nav.prev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, showNav, nav]);

  const titleId = 'detail-modal-title';

  const header = (
    <div className="flex-shrink-0 rounded-t-none border-b border-line-soft bg-gradient-to-br from-mint via-[#F4FAF6] to-white sm:rounded-t-modal dark:border-surface-border dark:from-brand-lime/[.12] dark:via-surface-card dark:to-surface-card">
      <div className="flex items-start gap-3 px-4 pb-3 pt-4 sm:px-5">
        {avatar ? (
          <div className="flex-shrink-0">{avatar}</div>
        ) : (
          <div
            aria-hidden="true"
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary-700 text-[15px] font-extrabold text-white shadow-sm dark:bg-brand-lime dark:text-primary-950 [&>svg]:h-5 [&>svg]:w-5"
          >
            {icon ?? initials(title)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="line-clamp-2 break-words text-[17px] font-extrabold leading-tight tracking-tight text-primary-700 dark:text-surface-text">
            {title}
          </h2>
          {subtitle && <div className="mt-0.5 text-[12.5px] text-[#5B6963] dark:text-surface-muted">{subtitle}</div>}
          {badges && <div className="mt-2 flex flex-wrap items-center gap-1.5">{badges}</div>}
        </div>
        <div className="flex flex-shrink-0 items-center gap-0.5 max-sm:-mr-1">
          {showNav && nav && (
            <>
              <button type="button" className={ICON_BTN} onClick={nav.prev} disabled={!nav.hasPrev} aria-label="Previous (K)" title="Previous (K)">
                <FiChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[3.25rem] text-center text-[12px] font-semibold tabular-nums text-[#5B6963] dark:text-surface-muted" aria-live="polite">
                {nav.index + 1} of {nav.total}
              </span>
              <button type="button" className={ICON_BTN} onClick={nav.next} disabled={!nav.hasNext} aria-label="Next (J)" title="Next (J)">
                <FiChevronRight className="h-4 w-4" />
              </button>
              <span aria-hidden="true" className="mx-1 h-5 w-px bg-line dark:bg-surface-border" />
            </>
          )}
          <button type="button" className={ICON_BTN} onClick={onClose} aria-label="Close quick view" title="Close (Esc)">
            <FiX className="h-4 w-4" />
          </button>
        </div>
      </div>
      {tabs && tabs.length > 0 && tab !== undefined && onTabChange && (
        <Tabs aria-label={`${title} sections`} tabs={tabs} value={tab} onChange={onTabChange} className="px-4 sm:px-5" />
      )}
    </div>
  );

  const footer =
    fullPageHref || editHref || primaryAction ? (
      <div className="flex w-full flex-wrap items-center gap-2 max-sm:justify-between">
        {fullPageHref && (
          <Link to={fullPageHref} className={GHOST}>
            Open full page <FiArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
        <div className="ml-auto flex items-center gap-2">
          {editHref && (
            <Link to={editHref} className={SECONDARY}>
              <FiEdit2 className="h-3.5 w-3.5" aria-hidden="true" /> Edit
            </Link>
          )}
          {primaryAction}
        </div>
      </div>
    ) : undefined;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="detail"
      mobileSheet
      header={header}
      labelledBy={titleId}
      footer={footer}
      bodyClassName="px-4 py-4 sm:px-5"
    >
      {error ? <DetailError message={error} onRetry={onRetry} /> : loading ? <DetailSkeleton /> : children}
    </Modal>
  );
}

/* ----------------------------------------------------------------------------------------- */
/* Building blocks                                                                            */
/* ----------------------------------------------------------------------------------------- */

/** Badge row helper; keeps header badge markup consistent. Just a flex wrapper for <Badge/> / <StatusBadge/>. */
export function DetailHeader({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-1.5">{children}</div>;
}

export interface DetailSectionProps {
  title: string;
  children: ReactNode;
  /** Grid columns on >= 640px. Default 2. Use 1 for long text. */
  columns?: 1 | 2 | 3;
  className?: string;
}

/** Titled group of DetailFields in a responsive key-value grid. */
export function DetailSection({ title, children, columns = 2, className }: DetailSectionProps) {
  return (
    <section className={cn('mb-5 last:mb-0', className)}>
      <h3 className="mb-2.5 border-b border-line-soft pb-1.5 text-[12px] font-extrabold uppercase tracking-[0.06em] text-primary-700 dark:border-surface-border dark:text-brand-lime">
        {title}
      </h3>
      <dl className={cn('grid grid-cols-1 gap-x-6 gap-y-3', columns === 2 && 'sm:grid-cols-2', columns === 3 && 'sm:grid-cols-3')}>{children}</dl>
    </section>
  );
}

export interface DetailFieldProps {
  label: string;
  value?: ReactNode;
  /** Render as a link: tel:, mailto: or an external URL. */
  kind?: 'text' | 'tel' | 'mailto' | 'link';
  /** Show a copy-to-clipboard button (IDs, phone numbers). Only for string/number values. */
  copy?: boolean;
  /** Malayalam text: applies the font-malayalam face. */
  ml?: boolean;
  /** Make the field span both columns. */
  wide?: boolean;
}

const isEmpty = (v: ReactNode) => v === undefined || v === null || v === '' || v === false;

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1400);
    } catch {
      toast.error("Couldn't copy. Select the text and copy it manually.");
    }
  }, [text]);
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={done ? 'Copied' : `Copy ${label}`}
      title={done ? 'Copied' : 'Copy'}
      className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded text-[#7B8983] hover:bg-mint hover:text-primary-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28] dark:text-surface-muted dark:hover:bg-surface-hover"
    >
      {done ? <FiCheck className="h-3 w-3 text-primary-600 dark:text-brand-lime" /> : <FiCopy className="h-3 w-3" />}
    </button>
  );
}

/** One label / value pair. Empty values render "-". */
export function DetailField({ label, value, kind = 'text', copy, ml, wide }: DetailFieldProps) {
  const empty = isEmpty(value);
  const text = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  let content: ReactNode = empty ? '-' : value;
  if (!empty && text) {
    const linkCls = 'font-semibold text-primary-600 hover:underline dark:text-brand-lime';
    if (kind === 'tel') content = <a href={`tel:${text.replace(/\s+/g, '')}`} className={linkCls}>{text}</a>;
    else if (kind === 'mailto') content = <a href={`mailto:${text}`} className={linkCls}>{text}</a>;
    else if (kind === 'link') content = <a href={text} target="_blank" rel="noreferrer noopener" className={linkCls}>{text}</a>;
  }
  return (
    <div className={cn('min-w-0', wide && 'sm:col-span-full')}>
      <dt className="text-[12px] font-bold uppercase tracking-[0.05em] text-[#7B8983] dark:text-surface-muted">{label}</dt>
      <dd className={cn('mt-0.5 break-words text-[13px] text-[#18231E] dark:text-surface-text', ml && 'font-malayalam', empty && 'text-[#98A59F] dark:text-surface-muted')}>
        {content}
        {copy && !empty && text && <CopyButton text={text} label={label} />}
      </dd>
    </div>
  );
}

/** Row of small stat cards (inline StatCard). Pass only real data; omit what the API does not return. */
export function DetailStats({ items }: { items: StatCardProps[] }) {
  if (items.length === 0) return null;
  return (
    <div className={cn('mb-5 grid grid-cols-1 gap-2.5', items.length >= 3 ? 'sm:grid-cols-3' : items.length === 2 ? 'sm:grid-cols-2' : '')}>
      {items.map((s) => (
        <StatCard key={s.title} variant="inline" {...s} />
      ))}
    </div>
  );
}

export interface DetailListItem {
  id: string;
  primary: ReactNode;
  secondary?: ReactNode;
  /** Right-hand side: badges, amount, date... */
  meta?: ReactNode;
  /** Makes the whole row a router link. */
  to?: string;
  /** Leading avatar/icon. */
  leading?: ReactNode;
}

export interface DetailListProps {
  title: string;
  items: DetailListItem[];
  emptyText?: string;
  className?: string;
}

/** Compact related rows (family members, payments timeline). */
export function DetailList({ title, items, emptyText = 'Nothing to show yet', className }: DetailListProps) {
  return (
    <section className={cn('mb-5 last:mb-0', className)}>
      <h3 className="mb-2.5 flex items-center gap-2 border-b border-line-soft pb-1.5 text-[12px] font-extrabold uppercase tracking-[0.06em] text-primary-700 dark:border-surface-border dark:text-brand-lime">
        {title}
        <span className="rounded-full bg-[#EEF3F0] px-1.5 text-[12px] font-bold normal-case tracking-normal text-[#5B6963] dark:bg-surface-raised dark:text-surface-muted">{items.length}</span>
      </h3>
      {items.length === 0 ? (
        <p className="py-3 text-center text-[12.5px] text-[#7B8983] dark:text-surface-muted">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-line-soft overflow-hidden rounded-xl border border-line-soft dark:divide-surface-border dark:border-surface-border">
          {items.map((it) => {
            const body = (
              <>
                {it.leading}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-[#18231E] dark:text-surface-text">{it.primary}</div>
                  {it.secondary && <div className="truncate text-[12px] text-[#7B8983] dark:text-surface-muted">{it.secondary}</div>}
                </div>
                {it.meta && <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-1.5">{it.meta}</div>}
              </>
            );
            const row = 'flex items-center gap-3 px-3 py-2';
            return (
              <li key={it.id}>
                {it.to ? (
                  <Link to={it.to} className={cn(row, 'transition-colors hover:bg-[#F6FAF8] focus-visible:bg-[#F6FAF8] focus-visible:outline-none dark:hover:bg-surface-hover')}>
                    {body}
                  </Link>
                ) : (
                  <div className={row}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Loading placeholder shaped like the body (stats row + a couple of sections). */
export function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading details" className="space-y-5">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[70px] rounded-[14px]" />
        ))}
      </div>
      {[0, 1].map((s) => (
        <div key={s} className="space-y-3">
          <Skeleton className="h-3 w-28" />
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-2.5 w-20" />
                <Skeleton className="h-3.5 w-36" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Error state with Retry. */
export function DetailError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert
      tone="danger"
      title="Could not load this record"
      action={
        onRetry ? (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        ) : undefined
      }
    >
      <span className="inline-flex items-center gap-1">
        <FiAlertCircle className="h-3.5 w-3.5" aria-hidden="true" /> {message}
      </span>
    </Alert>
  );
}

/** "needs_assistance" -> "Needs assistance". For enum-like API values shown in DetailFields. */
export function humanize(v?: string | null): string {
  if (!v) return '';
  const t = v.replace(/[_-]+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
