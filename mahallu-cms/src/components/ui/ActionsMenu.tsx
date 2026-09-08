import { useState, useRef, useEffect, useCallback, useLayoutEffect, useId, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FiMoreVertical } from 'react-icons/fi';
import { cn } from '@/utils/cn';

export interface ActionMenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  /** Why the action is unavailable. Shown to the user instead of hiding it. */
  disabledReason?: string;
  className?: string;
  variant?: 'default' | 'danger' | 'warning';
}

interface ActionsMenuProps {
  items: ActionMenuItem[];
  className?: string;
  /** Names the menu for assistive tech, e.g. "Actions for Al-Hamd House". */
  label?: string;
}

/**
 * Row-action menu.
 *
 * Disabled items stay visible and disabled rather than being filtered out, so
 * an action never silently disappears from a row.
 *
 * The menu is portalled: an absolutely positioned menu is clipped by the
 * overflow-x-auto wrapper the data table puts around every row.
 */
export default function ActionsMenu({ items, className, label = 'Actions' }: ActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [rect, setRect] = useState<{ top: number; left: number; maxHeight: number } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const enabledIndexes = items.map((item, i) => (item.disabled ? -1 : i)).filter((i) => i >= 0);
  const itemCount = items.length;

  /* The menu is position:fixed, so anything placed past the viewport edge is
   * unreachable — there is nothing to scroll. On a phone the row actions of the
   * last record sit just above the tab bar, which is exactly where a menu that
   * only ever opens downwards falls off the screen. It flips up instead when
   * there is more room above, and caps its height either way. */
  const place = useCallback(() => {
    const box = triggerRef.current?.getBoundingClientRect();
    if (!box) return;
    const width = 208;
    const left = Math.min(box.right - width, window.innerWidth - width - 8);
    const estimated = itemCount * 40 + 8;
    const below = window.innerHeight - box.bottom - 12;
    const above = box.top - 12;
    const flipUp = estimated > below && above > below;
    const maxHeight = Math.max(120, flipUp ? above : below);
    setRect({
      top: flipUp ? Math.max(8, box.top - 4 - Math.min(estimated, maxHeight)) : box.bottom + 4,
      left: Math.max(8, left),
      maxHeight,
    });
  }, [itemCount]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [isOpen, place]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [isOpen]);

  const close = (restoreFocus = true) => {
    setIsOpen(false);
    setFocusedIndex(-1);
    if (restoreFocus) triggerRef.current?.focus();
  };

  const activate = (item: ActionMenuItem) => {
    if (item.disabled) return;
    item.onClick();
    close();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!isOpen) {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setIsOpen(true);
        setFocusedIndex(enabledIndexes[0] ?? -1);
      }
      return;
    }

    const at = enabledIndexes.indexOf(focusedIndex);

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        close();
        break;
      case 'ArrowDown':
        event.preventDefault();
        setFocusedIndex(enabledIndexes[Math.min(at + 1, enabledIndexes.length - 1)] ?? -1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setFocusedIndex(enabledIndexes[Math.max(at - 1, 0)] ?? -1);
        break;
      case 'Home':
        event.preventDefault();
        setFocusedIndex(enabledIndexes[0] ?? -1);
        break;
      case 'End':
        event.preventDefault();
        setFocusedIndex(enabledIndexes[enabledIndexes.length - 1] ?? -1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (focusedIndex >= 0) activate(items[focusedIndex]);
        break;
      case 'Tab':
        close(false);
        break;
      default:
        break;
    }
  };

  /* Hooks above run unconditionally; the early exit sits below them. The
   * previous build returned null before useEffect, which changed hook order
   * whenever the item count crossed zero. */
  if (items.length === 0) return null;

  const variantClasses = (variant: ActionMenuItem['variant'] = 'default') => {
    switch (variant) {
      case 'danger':
        return 'text-destructive hover:bg-destructive/10';
      case 'warning':
        return 'text-warning hover:bg-warning/10';
      default:
        return 'text-foreground hover:bg-accent hover:text-accent-foreground';
    }
  };

  const menu = isOpen && rect && (
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      aria-label={label}
      style={{ position: 'fixed', top: rect.top, left: rect.left, width: 208, maxHeight: rect.maxHeight }}
      className="z-[100] overflow-y-auto overscroll-contain rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
      onKeyDown={onKeyDown}
    >
      {items.map((item, index) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          title={item.disabled ? item.disabledReason : undefined}
          aria-disabled={item.disabled || undefined}
          tabIndex={index === focusedIndex ? 0 : -1}
          ref={(node) => {
            if (index === focusedIndex) node?.focus();
          }}
          onMouseEnter={() => !item.disabled && setFocusedIndex(index)}
          onClick={(event) => {
            event.stopPropagation();
            activate(item);
          }}
          className={cn(
            'flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            variantClasses(item.variant),
            item.disabled && 'pointer-events-none opacity-50',
            item.className
          )}
        >
          {item.icon && (
            <span className="flex h-4 w-4 items-center justify-center" aria-hidden="true">
              {item.icon}
            </span>
          )}
          {item.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className={cn('relative inline-flex', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen((open) => !open);
          setFocusedIndex(-1);
        }}
        onKeyDown={onKeyDown}
        className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-8 sm:w-8"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
      >
        <FiMoreVertical className="h-4 w-4" aria-hidden="true" />
      </button>
      {menu && createPortal(menu, document.body)}
    </div>
  );
}
