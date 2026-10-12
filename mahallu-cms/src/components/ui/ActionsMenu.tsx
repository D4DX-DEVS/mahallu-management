import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiMoreVertical } from 'react-icons/fi';
import { cn } from '@/utils/cn';

export interface ActionMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  variant?: 'default' | 'danger' | 'warning';
}

interface ActionsMenuProps {
  items: ActionMenuItem[];
  className?: string;
}

export default function ActionsMenu({ items, className }: ActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter out disabled items and check if we have any items
  const visibleItems = items.filter(item => !item.disabled);

  const close = (refocus = false) => {
    setIsOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  // Position the menu in a fixed layer so scrolling table containers never clip it.
  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const menuH = visibleItems.length * (window.innerWidth < 640 ? 40 : 36) + 12;
    const below = r.bottom + 4 + menuH <= window.innerHeight;
    setPos({ top: below ? r.bottom + 4 : Math.max(8, r.top - 4 - menuH), left: Math.max(8, r.right - 192) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const t = event.target as Node;
      if (menuRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setIsOpen(false);
    };
    const onScroll = () => setIsOpen(false);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    // Focus the first item for keyboard users.
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus());
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [isOpen]);

  // Don't render if no items
  if (visibleItems.length === 0) {
    return null;
  }

  const handleItemClick = (item: ActionMenuItem) => {
    if (!item.disabled) {
      item.onClick();
      close(true);
    }
  };

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const els = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
    const i = els.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); els[(i + 1) % els.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); els[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); els[els.length - 1]?.focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
    else if (e.key === 'Tab') close();
  };

  const getVariantStyles = (variant: ActionMenuItem['variant'] = 'default') => {
    switch (variant) {
      case 'danger':
        return 'text-[#B3261E] hover:bg-[#FDECEA] focus:bg-[#FDECEA] dark:hover:bg-red-900/20 dark:text-red-300';
      case 'warning':
        return 'text-yellow-600 hover:bg-yellow-50 focus:bg-yellow-50 dark:hover:bg-yellow-900/20 dark:text-yellow-400';
      default:
        return 'text-[#3A4741] hover:bg-[#F4F7F5] focus:bg-[#F4F7F5] dark:text-surface-text dark:hover:bg-surface-hover dark:focus:bg-surface-hover';
    }
  };

  return (
    <div ref={menuRef} className={cn('relative', className)} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !isOpen) { e.preventDefault(); setIsOpen(true); }
        }}
        className="inline-flex h-10 w-10 items-center sm:h-8 sm:w-8 justify-center rounded-[10px] border border-transparent text-[#5B6963] transition-colors hover:bg-[#F4F7F5] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28] dark:text-surface-muted dark:hover:bg-surface-hover"
        aria-label="Actions" title="More actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <FiMoreVertical className="h-4 w-4" aria-hidden="true" />
      </button>

      {isOpen && pos &&
        createPortal(
          <div
            ref={listRef}
            role="menu"
            data-floating-panel
            aria-label="Row actions"
            onKeyDown={onMenuKeyDown}
            style={{ position: 'fixed', top: pos.top, left: pos.left }}
            className="z-[1000] w-48 rounded-xl border border-line bg-white p-1 shadow-pop dark:border-surface-border dark:bg-surface-raised"
          >
            {visibleItems.map((item, index) => (
              <button
                key={index}
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  handleItemClick(item);
                }}
                className={cn(
                  'flex min-h-[40px] w-full items-center gap-2 rounded-lg px-3 py-2 text-left sm:min-h-0 text-[12.5px] font-semibold transition-colors focus:outline-none',
                  getVariantStyles(item.variant),
                  item.className
                )}
              >
                {item.icon && <span className="flex items-center justify-center h-4 w-4">{item.icon}</span>}
                {item.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
