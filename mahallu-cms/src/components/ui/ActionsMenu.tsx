import { ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FiMoreHorizontal,
  FiEye,
  FiEdit2,
  FiTrash2,
  FiDownload,
  FiCheck,
  FiX,
  FiPrinter,
  FiSend,
  FiCopy,
  FiList,
  FiDollarSign,
  FiUpload,
  FiRefreshCw,
  FiExternalLink,
} from 'react-icons/fi';
import { cn } from '@/utils/cn';
import { ROW_ACTION_BASE, RowActionVariant } from './rowAction';

export interface ActionMenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  /** Why the action is unavailable. Shown to the user instead of hiding it. */
  disabledReason?: string;
  className?: string;
  variant?: RowActionVariant;
}

interface ActionsMenuProps {
  items: ActionMenuItem[];
  className?: string;
  /** Names the group for assistive tech, e.g. "Actions for Al-Hamd House". */
  label?: string;
}

/* Every call site passes an icon today. The fallback exists so a new action
 * added without one gets a recognisable glyph rather than an empty square, and
 * so the icon for a given verb is the same icon on every table. */
const ICON_BY_VERB: Array<[RegExp, ReactNode]> = [
  [/^view|^open|^details/i, <FiEye />],
  [/^edit|^update|^rename/i, <FiEdit2 />],
  [/^delete|^remove/i, <FiTrash2 />],
  [/^download|^export/i, <FiDownload />],
  [/^upload|^import/i, <FiUpload />],
  [/^approve|^accept|^mark/i, <FiCheck />],
  [/^reject|^cancel|^decline/i, <FiX />],
  [/^print/i, <FiPrinter />],
  [/^send|^notify|^share/i, <FiSend />],
  [/^duplicate|^copy|^clone/i, <FiCopy />],
  [/^pay|^collect|^wallet|^transaction/i, <FiDollarSign />],
  [/^refresh|^sync|^retry/i, <FiRefreshCw />],
  [/^all |^back|^go to/i, <FiExternalLink />],
];

function fallbackIcon(label: string): ReactNode {
  const match = ICON_BY_VERB.find(([pattern]) => pattern.test(label));
  return match ? match[1] : <FiList />;
}

const VARIANT_TEXT: Record<RowActionVariant, string> = {
  default: 'text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent',
  danger: 'text-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:bg-destructive/10 focus-visible:text-destructive',
  warning: 'text-foreground hover:bg-warning/10 hover:text-warning focus-visible:bg-warning/10 focus-visible:text-warning',
};

const VIEWPORT_MARGIN = 8;
const MENU_WIDTH = 192; // w-48

/**
 * A row's actions, behind a single three-dot trigger.
 *
 * Opens a compact, text-labelled menu next to the button it was opened from —
 * portalled to `document.body` so it can never be clipped by a table's own
 * `overflow-x` scroll container, and positioned from the trigger's own
 * bounding rect (flipping above the trigger, or clamping off the right edge,
 * whenever the viewport doesn't have room) the same way Sidebar's own
 * `SubmenuFlyout` already does for the nav's flyout panels.
 *
 * The props are unchanged from before: every call site's `items` array —
 * `icon`, `disabled`, `disabledReason`, `variant`, `className` — still means
 * exactly what it meant. Disabled items stay visible and disabled rather than
 * being filtered out, so an action never silently disappears from a row.
 */
export default function ActionsMenu({ items, className, label = 'Actions' }: ActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; openUpward: boolean } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const computePosition = () => {
    const anchor = triggerRef.current?.getBoundingClientRect();
    if (!anchor) return;
    const estimatedHeight = Math.min(items.length * 40 + 16, 360);
    const spaceBelow = window.innerHeight - anchor.bottom - VIEWPORT_MARGIN;
    const openUpward = spaceBelow < estimatedHeight && anchor.top > estimatedHeight;
    const top = openUpward ? Math.max(VIEWPORT_MARGIN, anchor.top - estimatedHeight) : anchor.bottom + 4;
    // Right-align to the trigger by default (actions columns sit at the row's
    // right edge); clamp so the panel never crosses the left edge either.
    let left = anchor.right - MENU_WIDTH;
    left = Math.min(left, window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN);
    left = Math.max(VIEWPORT_MARGIN, left);
    setPosition({ top, left, openUpward });
  };

  const open = () => {
    computePosition();
    setIsOpen(true);
  };

  const close = (returnFocus = false) => {
    setIsOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!isOpen) return;
    itemRefs.current[0]?.focus();

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close(true);
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const enabledIndexes = items.reduce<number[]>((acc, item, i) => {
          if (!item.disabled) acc.push(i);
          return acc;
        }, []);
        if (enabledIndexes.length === 0) return;
        const current = itemRefs.current.findIndex((el) => el === document.activeElement);
        const currentPos = enabledIndexes.indexOf(current);
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        const nextPos = currentPos === -1 ? 0 : (currentPos + delta + enabledIndexes.length) % enabledIndexes.length;
        itemRefs.current[enabledIndexes[nextPos]]?.focus();
      }
    };
    const handleReposition = () => computePosition();

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (items.length === 0) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={label}
        title={label}
        onClick={(event) => {
          event.stopPropagation();
          if (isOpen) {
            close();
          } else {
            open();
          }
        }}
        className={cn(ROW_ACTION_BASE, 'hover:bg-accent hover:text-accent-foreground', className)}
      >
        <FiMoreHorizontal aria-hidden="true" />
      </button>

      {isOpen &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={label}
            style={{ position: 'fixed', top: position.top, left: position.left, width: MENU_WIDTH }}
            className="z-[70] max-h-[360px] overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
          >
            {items.map((item, index) => {
              const icon = item.icon ?? fallbackIcon(item.label);
              const row = (
                <button
                  key={item.label}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  aria-disabled={item.disabled || undefined}
                  title={item.disabled ? item.disabledReason ?? item.label : undefined}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (item.disabled) return;
                    close(true);
                    item.onClick();
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-left text-sm transition-colors',
                    'focus-visible:outline-none',
                    VARIANT_TEXT[item.variant ?? 'default'],
                    item.disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-foreground',
                    item.className
                  )}
                >
                  <span
                    className="flex h-4 w-4 flex-shrink-0 items-center justify-center [&>svg]:h-4 [&>svg]:w-4"
                    aria-hidden="true"
                  >
                    {icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </button>
              );
              return row;
            })}
          </div>,
          document.body
        )}
    </>
  );
}
