import { useState, useRef, useEffect, useCallback, useLayoutEffect, useId, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/utils/cn';
export interface DropdownItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}
interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  className?: string;
  label?: string;
} /** * Menu with keyboard navigation, portalled so it is not clipped by the * `overflow-x-auto` wrapper a data table puts around its toolbar. */
export default function Dropdown({
  trigger,
  items,
  align = 'right',
  className,
  label = 'Menu',
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [rect, setRect] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const enabled = items.map((item, i) => (item.disabled ? -1 : i)).filter((i) => i >= 0);
  const itemCount = items.length;
  /* A fixed-position menu placed past the bottom of the viewport cannot be
   * scrolled to. It flips above the trigger when the room is there, and caps
   * its height so a long menu scrolls inside itself. */
  const position = useCallback(() => {
    const box = triggerRef.current?.getBoundingClientRect();
    if (!box) return;
    const width = 224;
    const left = align === 'right' ? box.right - width : box.left;
    const estimated = itemCount * 40 + 8;
    const below = window.innerHeight - box.bottom - 12;
    const above = box.top - 12;
    const flipUp = estimated > below && above > below;
    const maxHeight = Math.max(120, flipUp ? above : below);
    setRect({
      top: flipUp ? Math.max(8, box.top - 4 - Math.min(estimated, maxHeight)) : box.bottom + 4,
      left: Math.max(8, Math.min(left, window.innerWidth - width - 8)),
      maxHeight,
    });
  }, [align, itemCount]);
  useLayoutEffect(() => {
    if (!isOpen) return;
    position();
    window.addEventListener('scroll', position, true);
    window.addEventListener('resize', position);
    return () => {
      window.removeEventListener('scroll', position, true);
      window.removeEventListener('resize', position);
    };
  }, [isOpen, position]);
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
  const close = () => {
    setIsOpen(false);
    setFocusedIndex(-1);
  };
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!isOpen) {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setIsOpen(true);
        setFocusedIndex(enabled[0] ?? -1);
      }
      return;
    }
    const at = enabled.indexOf(focusedIndex);
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        close();
        break;
      case 'ArrowDown':
        event.preventDefault();
        setFocusedIndex(enabled[Math.min(at + 1, enabled.length - 1)] ?? -1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setFocusedIndex(enabled[Math.max(at - 1, 0)] ?? -1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (focusedIndex >= 0 && !items[focusedIndex].disabled) {
          items[focusedIndex].onClick();
          close();
        }
        break;
      case 'Tab':
        close();
        break;
      default:
        break;
    }
  };
  const menu = isOpen && rect && (
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      aria-label={label}
      style={{ position: 'fixed', top: rect.top, left: rect.left, width: 224, maxHeight: rect.maxHeight }}
      className="z-[100] overflow-y-auto overscroll-contain rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
      onKeyDown={onKeyDown}
    >
      {items.map((item, index) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          tabIndex={index === focusedIndex ? 0 : -1}
          ref={(node) => {
            if (index === focusedIndex) node?.focus();
          }}
          onMouseEnter={() => !item.disabled && setFocusedIndex(index)}
          onClick={() => {
            item.onClick();
            close();
          }}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-left text-sm text-foreground transition-colors',
            'hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
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
    <div className={cn('relative inline-block', className)}>
      <div
        ref={triggerRef}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={onKeyDown}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
      >
        {trigger}
      </div>
      {menu && createPortal(menu, document.body)}
    </div>
  );
}
