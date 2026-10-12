import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiChevronDown, FiChevronLeft, FiChevronRight, FiSearch, FiStar, FiX } from 'react-icons/fi';
import type { MenuItem } from '@/constants/menuItems';
import { cn } from '@/utils/cn';
import { buildGroups } from './navModel';
import type { SidebarModel } from './useSidebarState';

type Icon = React.ComponentType<{ className?: string }>;

const focusRing = 'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28]';
/* Level-1: 36px row, 10px inner padding, 17px icon, 13px/600 label. */
const row1 =
  'relative flex h-9 min-w-0 flex-1 items-center gap-[11px] rounded-[10px] px-2.5 text-left text-[13px] font-semibold leading-tight transition-colors motion-reduce:transition-none ' +
  focusRing;
/* Level-2+: 32px row, no icon, 12.5px/500, 8px tick into the guide line. */
const row2 =
  'relative flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 text-left text-[12.5px] font-medium leading-tight transition-colors motion-reduce:transition-none ' +
  "before:absolute before:-left-[15px] before:top-1/2 before:h-[1.5px] before:w-2 before:-translate-y-1/2 before:bg-[#DCE5E0] before:content-[''] dark:before:bg-surface-border " +
  focusRing;
const idle1 = 'text-[#2E3B35] hover:bg-[#F4F7F5] dark:text-surface-muted dark:hover:bg-surface-hover dark:hover:text-surface-text';
const idle2 = 'text-[#4A5A52] hover:bg-[#F4F7F5] dark:text-surface-muted dark:hover:bg-surface-hover dark:hover:text-surface-text';
const active1 = 'bg-mint font-bold text-primary-700 dark:bg-brand-lime/[.12] dark:text-brand-lime';
const active2 = 'bg-mint font-bold text-primary-700 before:h-0.5 before:bg-brand-lime dark:bg-brand-lime/[.12] dark:text-brand-lime';

interface Accordion {
  openId: string | null;
  toggle: (id: string) => void;
}

interface LeafRowProps {
  item: MenuItem;
  level: number;
  model: SidebarModel;
  pathname: string;
  onNavigate: () => void;
  hint?: string;
}

function GroupTitle({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return (
    <h3
      className={cn(
        'flex items-center gap-2 px-2.5 text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#7B8983] after:h-px after:flex-1 after:bg-[#E3EAE6] after:content-[""] dark:text-surface-muted dark:after:bg-surface-border',
        first ? 'mb-1.5 mt-1' : 'mb-1.5 mt-4'
      )}
    >
      {children}
    </h3>
  );
}

function LeafRow({ item, level, model, pathname, onNavigate, hint }: LeafRowProps) {
  const Icon = item.icon as Icon;
  const exact = item.path === pathname;
  const active = model.activeLeafId === item.id || exact;
  const pinned = item.path ? model.pinnedPaths.includes(item.path) : false;
  const l1 = level === 0;
  return (
    <div className="group/row relative flex items-center">
      <Link
        to={item.path || '#'}
        onClick={onNavigate}
        aria-current={exact ? 'page' : undefined}
        className={cn(l1 ? row1 : row2, l1 ? (active ? active1 : idle1) : active ? active2 : idle2)}
      >
        {l1 && active && <span aria-hidden="true" className="absolute -left-2.5 bottom-2 top-2 w-[3px] rounded-[3px] bg-brand-lime" />}
        {l1 && <Icon className={cn('h-[17px] w-[17px] flex-shrink-0', active ? 'text-primary-700 dark:text-brand-lime' : 'text-[#5B6963] dark:text-surface-muted')} />}
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {hint && <span className="ml-1 max-w-[84px] flex-shrink-0 truncate text-[12px] font-medium text-[#98A59F] dark:text-surface-muted/70">{hint}</span>}
      </Link>
      {item.path && (
        <button
          type="button"
          onClick={() => model.togglePin(item.path!)}
          aria-label={pinned ? `Unpin ${item.label}` : `Pin ${item.label}`}
          aria-pressed={pinned}
          title={pinned ? 'Unpin' : 'Pin'}
          className={cn(
            'absolute right-1.5 flex h-6 w-6 items-center justify-center rounded-md text-[#98A59F] transition-opacity hover:text-[#B8860B] motion-reduce:transition-none',
            focusRing,
            pinned ? 'text-[#B8860B] opacity-100' : 'opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100'
          )}
        >
          <FiStar className={cn('h-3 w-3', pinned && 'fill-current')} />
        </button>
      )}
    </div>
  );
}

interface GroupProps {
  item: MenuItem;
  parentId: string;
  level: number;
  model: SidebarModel;
  pathname: string;
  onNavigate: () => void;
  accordion?: Accordion;
}

function Group({ item, parentId, level, model, pathname, onNavigate, accordion }: GroupProps) {
  const Icon = item.icon as Icon;
  const l1 = level === 0;
  const isOpen = l1 && accordion ? accordion.openId === item.id : model.openGroups[parentId] === item.id;
  const hasActive = containsLeaf(item, model.activeLeafId);
  const panelId = `grp-${item.id}`;
  // Nested parents open themselves when they hold the active page (one open at a time via the model).
  useEffect(() => {
    if (!l1 && hasActive && model.openGroups[parentId] !== item.id) model.toggleGroup(parentId, item.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasActive, model.activeLeafId]);
  const toggle = () => (l1 && accordion ? accordion.toggle(item.id) : model.toggleGroup(parentId, item.id));
  return (
    <div>
      <div className="relative flex items-center">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className={cn(
            l1 ? row1 : row2,
            'w-full flex-none',
            hasActive ? (l1 ? 'font-bold text-primary-700 hover:bg-[#F4F7F5] dark:text-brand-lime dark:hover:bg-surface-hover' : 'font-bold text-primary-700 hover:bg-[#F4F7F5] dark:text-brand-lime dark:hover:bg-surface-hover') : l1 ? idle1 : idle2
          )}
        >
          {l1 && <Icon className={cn('h-[17px] w-[17px] flex-shrink-0', hasActive ? 'text-primary-700 dark:text-brand-lime' : 'text-[#5B6963] dark:text-surface-muted')} />}
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          <FiChevronDown
            aria-hidden="true"
            className={cn('h-[13px] w-[13px] flex-shrink-0 transition-transform duration-150 motion-reduce:transition-none', isOpen ? 'text-current' : '-rotate-90 text-[#98A59F]')}
          />
        </button>
      </div>
      {isOpen && (
        <div
          id={panelId}
          className="mb-1 ml-5 mt-0.5 flex flex-col gap-px border-l-[1.5px] border-[#DCE5E0] pl-3.5 dark:border-surface-border"
        >
          {item.children!.map((child) => (
            <Node key={child.id} item={child} parentId={item.id} level={level + 1} model={model} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

function containsLeaf(item: MenuItem, leafId: string | null): boolean {
  if (!leafId) return false;
  if (item.id === leafId) return true;
  return item.children?.some((c) => containsLeaf(c, leafId)) ?? false;
}

function Node(props: GroupProps) {
  return props.item.children?.length ? <Group {...props} /> : <LeafRow {...props} />;
}

interface SidebarPanelProps {
  model: SidebarModel;
  pathname: string;
  onNavigate: () => void;
  variant: 'dock' | 'flyout' | 'drawer';
  /** dock: collapse to rail-only. flyout: pin the panel open. */
  onToggleDock?: () => void;
  onClose?: () => void;
}

export default function SidebarPanel({ model, pathname, onNavigate, variant, onToggleDock, onClose }: SidebarPanelProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const section = model.sections.find((s) => s.id === model.selectedId) ?? null;
  const q = query.trim().toLowerCase();

  const groups = useMemo(() => (section ? buildGroups(section) : []), [section]);
  // One accordion open at a time per panel; the parent of the active page opens on navigation.
  const [openBySection, setOpenBySection] = useState<Record<string, string | null>>({});
  const sectionKey = section?.id ?? '';
  useEffect(() => {
    if (!section || !model.activeLeafId || model.activeSectionId !== section.id) return;
    const holder = groups.flatMap((g) => g.items).find((i) => i.children?.length && containsLeaf(i, model.activeLeafId));
    if (holder) setOpenBySection((p) => (p[section.id] === holder.id ? p : { ...p, [section.id]: holder.id }));
  }, [section, groups, model.activeLeafId, model.activeSectionId]);
  const accordion: Accordion = {
    openId: openBySection[sectionKey] ?? null,
    toggle: (id) => setOpenBySection((p) => ({ ...p, [sectionKey]: p[sectionKey] === id ? null : id })),
  };

  const leaves = section ? model.leavesBySection[section.id] ?? [] : [];
  const pinned = useMemo(
    () => model.pinnedPaths.map((p) => leaves.find((l) => l.item.path === p)).filter(Boolean) as typeof leaves,
    [model.pinnedPaths, leaves]
  );
  const recent = useMemo(
    () =>
      model.recent
        .map((r) => leaves.find((l) => l.item.path === r.path))
        .filter((l): l is (typeof leaves)[number] => Boolean(l) && !model.pinnedPaths.includes(l!.item.path!) && l!.item.path !== pathname)
        .slice(0, 4),
    [model.recent, model.pinnedPaths, leaves, pathname]
  );

  const results = useMemo(() => {
    if (!q) return [];
    const ordered = [...model.sections].sort((a, b) => (a.id === model.selectedId ? -1 : b.id === model.selectedId ? 1 : 0));
    return ordered
      .map((s) => ({
        section: s,
        hits: (model.leavesBySection[s.id] ?? []).filter((l) => l.item.label.toLowerCase().includes(q) || l.trail.some((t) => t.toLowerCase().includes(q))),
      }))
      .filter((r) => r.hits.length > 0);
  }, [q, model.sections, model.selectedId, model.leavesBySection]);

  const sectionHint = (n: number) => `${n} result${n === 1 ? '' : 's'}`;

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', variant !== 'drawer' && 'h-full')}>
      {variant !== 'drawer' && (
        <div className="flex h-14 flex-shrink-0 items-center justify-between gap-2 px-3.5">
          <h2 className="truncate text-[13px] font-extrabold tracking-[0.01em] text-[#18231E] dark:text-surface-text">{section?.label ?? 'Menu'}</h2>
          {onToggleDock && (
            <button
              type="button"
              onClick={onToggleDock}
              aria-label={variant === 'dock' ? 'Collapse menu panel' : 'Pin menu panel open'}
              title={variant === 'dock' ? 'Collapse panel' : 'Pin panel open'}
              className={cn('flex h-7 w-7 items-center justify-center rounded-lg text-[#7B8983] hover:bg-[#F4F7F5] hover:text-primary-700 dark:text-surface-muted dark:hover:bg-surface-hover dark:hover:text-brand-lime', focusRing)}
            >
              {variant === 'dock' ? <FiChevronLeft className="h-4 w-4" /> : <FiChevronRight className="h-4 w-4" />}
            </button>
          )}
        </div>
      )}

      <div className="flex-shrink-0 px-3 pb-2">
        <label className="flex h-8 items-center gap-2 rounded-[10px] border border-line bg-[#F4F7F5] px-2.5 text-[#7B8983] transition-[border-color,box-shadow] focus-within:border-primary-600 focus-within:bg-white focus-within:shadow-focus dark:border-surface-border dark:bg-surface-raised dark:text-surface-muted dark:focus-within:border-brand-lime">
          <FiSearch className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && query) {
                e.stopPropagation();
                setQuery('');
              }
            }}
            placeholder="Filter menu"
            aria-label="Filter menu"
            className="w-full bg-transparent text-xs text-[#18231E] placeholder:text-[#7B8983] focus:outline-none dark:text-surface-text dark:placeholder:text-surface-muted"
          />
          {query && (
            <button type="button" aria-label="Clear filter" onClick={() => { setQuery(''); inputRef.current?.focus(); }} className={cn('rounded p-0.5 hover:text-primary-700', focusRing)}>
              <FiX className="h-3 w-3" />
            </button>
          )}
        </label>
      </div>

      <nav aria-label={q ? 'Menu search results' : `${section?.label ?? 'Menu'} pages`} className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
        {q ? (
          results.length === 0 ? (
            <p className="px-2 py-4 text-xs text-[#7B8983] dark:text-surface-muted">No menu items match "{query.trim()}".</p>
          ) : (
            results.map(({ section: s, hits }) => (
              <section key={s.id} aria-label={s.label} className="pb-1">
                <p className="flex items-center gap-1.5 px-2 pb-1 pt-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#98A59F] dark:text-surface-muted/70">
                  <span className="rounded-full bg-mint px-1.5 py-px text-primary-700 dark:bg-brand-lime/[.12] dark:text-brand-lime">{s.label}</span>
                  <span className="font-medium normal-case tracking-normal">{sectionHint(hits.length)}</span>
                </p>
                <div className="flex flex-col gap-px">
                  {hits.map((l) => (
                    <LeafRow key={l.item.id} item={l.item} level={0} model={model} pathname={pathname} onNavigate={() => { setQuery(''); onNavigate(); }} hint={l.trail[l.trail.length - 1]} />
                  ))}
                </div>
              </section>
            ))
          )
        ) : (
          section && (
            <>
              {pinned.length > 0 && (
                <section aria-label="Pinned">
                  <GroupTitle first>Pinned</GroupTitle>
                  <div className="flex flex-col gap-px">
                    {pinned.map((l) => (
                      <LeafRow key={`pin-${l.item.id}`} item={l.item} level={0} model={model} pathname={pathname} onNavigate={onNavigate} />
                    ))}
                  </div>
                </section>
              )}
              {recent.length > 0 && (
                <section aria-label="Recent">
                  <GroupTitle first={pinned.length === 0}>Recent</GroupTitle>
                  <div className="flex flex-col gap-px">
                    {recent.map((l) => (
                      <LeafRow key={`rec-${l.item.id}`} item={l.item} level={0} model={model} pathname={pathname} onNavigate={onNavigate} />
                    ))}
                  </div>
                </section>
              )}
              {groups.length === 0 ? (
                <div className="flex flex-col gap-px">
                  {[section].map((child) => (
                    <Node key={child.id} item={child} parentId={section.id} level={0} model={model} pathname={pathname} onNavigate={onNavigate} />
                  ))}
                </div>
              ) : (
                groups.map((g, gi) => (
                  <section key={g.title} aria-label={g.title}>
                    <GroupTitle first={gi === 0 && pinned.length === 0 && recent.length === 0}>{g.title}</GroupTitle>
                    <div className="flex flex-col gap-px">
                      {g.items.map((child) => (
                        <Node key={child.id} item={child} parentId={section.id} level={0} model={model} pathname={pathname} onNavigate={onNavigate} accordion={accordion} />
                      ))}
                    </div>
                  </section>
                ))
              )}
            </>
          )
        )}
      </nav>
      {variant === 'flyout' && onClose && <span className="sr-only">Press Escape to close</span>}
    </div>
  );
}
