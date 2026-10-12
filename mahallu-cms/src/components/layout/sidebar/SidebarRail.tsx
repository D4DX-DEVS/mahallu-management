import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { FiMoon, FiSearch, FiSun } from 'react-icons/fi';
import type { MenuItem } from '@/constants/menuItems';
import { BRAND_NAME, LOGO_PATH } from '@/constants/theme';
import { cn } from '@/utils/cn';
import { railLabel } from './navModel';
import type { SidebarModel } from './useSidebarState';

type Icon = React.ComponentType<{ className?: string }>;
const focusRing = 'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28]';

interface SidebarRailProps {
  model: SidebarModel;
  /** Panel is docked open (selecting a section only switches the panel). */
  panelOpen: boolean;
  onSectionClick: (item: MenuItem) => void;
  onSectionHover: (item: MenuItem | null) => void;
  onNavigate: () => void;
  onSearch: () => void;
  theme: string;
  onToggleTheme: () => void;
  initials: string;
  userLabel: string;
  isOnline: boolean;
}

export default function SidebarRail({ model, panelOpen, onSectionClick, onSectionHover, onNavigate, onSearch, theme, onToggleTheme, initials, userLabel, isOnline }: SidebarRailProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    const els = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[data-rail-item]') ?? []);
    if (!els.length) return;
    const idx = els.indexOf(document.activeElement as HTMLElement);
    let next = idx;
    if (e.key === 'ArrowDown') next = (idx + 1) % els.length;
    else if (e.key === 'ArrowUp') next = (idx - 1 + els.length) % els.length;
    else if (e.key === 'Home') next = 0;
    else next = els.length - 1;
    e.preventDefault();
    els[next].focus();
  };

  const leafSections = model.sections.filter((s) => !s.children?.length);
  const groupSections = model.sections.filter((s) => s.children?.length);

  const renderItem = (item: MenuItem) => {
    const Icon = item.icon as Icon;
    const isLeaf = !item.children?.length;
    const active = model.activeSectionId === item.id;
    const selected = !isLeaf && model.selectedId === item.id;
    const cls = cn(
      'group relative mx-auto flex w-[60px] flex-col items-center gap-[3px] rounded-[11px] px-0.5 py-1.5 transition-colors motion-reduce:transition-none',
      focusRing,
      active || selected
        ? 'bg-mint text-primary-700 dark:bg-brand-lime/[.12] dark:text-brand-lime'
        : 'text-[#5B6B64] hover:bg-[#F4F7F5] hover:text-[#18231E] dark:text-surface-muted dark:hover:bg-surface-hover dark:hover:text-surface-text'
    );
    const inner = (
      <>
        {active && <span aria-hidden="true" className="absolute -left-[4px] bottom-2 top-2 w-[3px] rounded-r-[3px] bg-brand-lime" />}
        <Icon className="h-[18px] w-[18px] flex-shrink-0" />
        <span className="whitespace-nowrap text-[11px] font-semibold leading-tight tracking-[-0.02em]">{railLabel(item)}</span>
      </>
    );
    if (isLeaf) {
      return (
        <Link
          key={item.id}
          to={item.path || '#'}
          data-rail-item
          onClick={onNavigate}
          aria-current={active ? 'page' : undefined}
          aria-label={item.label}
          title={item.label}
          className={cls}
        >
          {inner}
        </Link>
      );
    }
    return (
      <button
        key={item.id}
        type="button"
        data-rail-item
        onClick={() => onSectionClick(item)}
        onMouseEnter={() => onSectionHover(item)}
        onFocus={() => onSectionHover(item)}
        aria-label={item.label}
        aria-pressed={panelOpen && selected}
        aria-current={active ? 'page' : undefined}
        title={item.label}
        className={cls}
      >
        {inner}
      </button>
    );
  };

  const railBtn = cn(
    'mx-auto flex h-9 w-9 items-center justify-center rounded-[10px] text-[#5B6B64] transition-colors hover:bg-[#F4F7F5] hover:text-primary-700 dark:text-surface-muted dark:hover:bg-surface-hover dark:hover:text-brand-lime',
    focusRing
  );

  return (
    <nav aria-label="Main sections" className="flex h-full w-16 flex-shrink-0 flex-col items-stretch border-r border-line bg-white dark:border-surface-border dark:bg-surface-card" onKeyDown={onKeyDown}>
      <Link to="/dashboard" aria-label={`${BRAND_NAME} home`} title={BRAND_NAME} className={cn('mx-auto mb-2 mt-3 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[11px] bg-mint ring-1 ring-mint-deep dark:bg-surface-raised dark:ring-surface-border-strong', focusRing)}>
        <img src={LOGO_PATH} alt="" className="h-6 w-6 object-contain" />
      </Link>

      <div ref={listRef} role="toolbar" aria-orientation="vertical" aria-label="Sections" className="no-scrollbar flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto py-1">
        {leafSections.map(renderItem)}
        {leafSections.length > 0 && groupSections.length > 0 && <div aria-hidden="true" className="mx-4 my-1 border-t border-line-soft dark:border-surface-border" />}
        {groupSections.map(renderItem)}
      </div>

      <div className="flex flex-shrink-0 flex-col items-center gap-1.5 border-t border-line px-1 py-3 dark:border-surface-border">
        <button type="button" onClick={onSearch} aria-label="Search (Ctrl+K)" title="Search (Ctrl+K)" className={railBtn}>
          <FiSearch className="h-[17px] w-[17px]" />
        </button>
        <button type="button" onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={theme === 'dark' ? 'Light mode' : 'Dark mode'} className={railBtn}>
          {theme === 'dark' ? <FiSun className="h-[17px] w-[17px]" /> : <FiMoon className="h-[17px] w-[17px]" />}
        </button>
        <div
          title={`${userLabel}${isOnline ? '' : ' (offline)'}`}
          role="img"
          aria-label={`${userLabel}, ${isOnline ? 'online' : 'offline'}`}
          className="relative mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-mint text-xs font-extrabold text-primary-700 shadow-[0_0_0_2px_#fff,0_0_0_3px_#CFE2D8] dark:bg-surface-raised dark:text-brand-lime dark:shadow-[0_0_0_2px_#171D1A,0_0_0_3px_#3A4741]"
        >
          {initials}
          <span aria-hidden="true" className={cn('absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-surface-card', isOnline ? 'bg-[#1E9B63]' : 'animate-pulse bg-rose-400')} />
        </div>
      </div>
    </nav>
  );
}
