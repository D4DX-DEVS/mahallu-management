/**
 * IconActionButton - the 32px square icon button used for row actions (and any
 * other compact toolbar action), plus the tooltip that explains it.
 *
 * Usage
 *   <IconActionButton variant="view" label="Quick view" icon={<FiEye />} onClick={...} />
 *   <IconActionButton variant="danger" label="Archive family" icon={<FiArchive />}
 *     disabled disabledReason="Only the mahall admin can archive" />
 *
 * Variants: view (green tint), edit (neutral), danger (red tint), ghost (no fill).
 * Accessibility: `label` becomes aria-label AND the tooltip text (exact verb, e.g.
 * "Edit member"). Tooltip shows on hover (after a short delay) and on keyboard
 * focus. A disabled button keeps focus (aria-disabled, not `disabled`) so the
 * `disabledReason` tooltip is reachable; clicks are ignored while disabled.
 * The tooltip renders in a portal so scrolling table containers never clip it.
 * Prefer <RowActions/> in tables; use this directly only for one-off icon buttons.
 */
import { ReactNode, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/utils/cn';

export type IconActionVariant = 'view' | 'edit' | 'danger' | 'ghost';

const VARIANT: Record<IconActionVariant, string> = {
  view:
    'border-[#D8E8DF] bg-[#F1F8F4] text-[#0B4837] hover:bg-[#E4F1EA] dark:border-brand-lime/20 dark:bg-brand-lime/10 dark:text-brand-lime dark:hover:bg-brand-lime/20',
  edit:
    'border-[#E3EAE6] bg-[#F4F7F5] text-[#2E3B35] hover:bg-[#E9EFEC] dark:border-surface-border dark:bg-surface-raised dark:text-surface-text dark:hover:bg-surface-hover',
  danger:
    'border-[#F6D6D3] bg-[#FDF2F1] text-[#B3261E] hover:bg-[#FBE3E1] dark:border-red-400/25 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20',
  ghost:
    'border-transparent bg-transparent text-[#5B6963] hover:bg-[#F4F7F5] dark:text-surface-muted dark:hover:bg-surface-hover',
};

/** Small dark tooltip bubble, positioned above (or below when there is no room) its anchor. */
export function Tooltip({ text, anchor, id }: { text: string; anchor: HTMLElement | null; id: string }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!anchor || !ref.current) return;
    const a = anchor.getBoundingClientRect();
    const t = ref.current.getBoundingClientRect();
    const above = a.top - t.height - 8 >= 4;
    const left = Math.min(Math.max(4, a.left + a.width / 2 - t.width / 2), window.innerWidth - t.width - 4);
    setPos({ top: above ? a.top - t.height - 6 : a.bottom + 6, left });
  }, [anchor, text]);

  return createPortal(
    <div
      ref={ref}
      id={id}
      role="tooltip"
      style={{ position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
      className="pointer-events-none z-[1100] max-w-[260px] rounded-lg bg-[#0F1F19] px-2.5 py-1.5 text-[11.5px] font-semibold leading-snug text-white shadow-pop dark:bg-[#F1F4F2] dark:text-[#0F1F19]"
    >
      {text}
    </div>,
    document.body
  );
}

export interface IconActionButtonProps {
  /** Exact verb shown as tooltip and used as the accessible name, e.g. "Quick view". */
  label: string;
  icon: ReactNode;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  variant?: IconActionVariant;
  disabled?: boolean;
  /** Tooltip shown instead of `label` while disabled, explaining why. */
  disabledReason?: string;
  className?: string;
}

export default function IconActionButton({
  label,
  icon,
  onClick,
  variant = 'ghost',
  disabled,
  disabledReason,
  className,
}: IconActionButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const timer = useRef<number>();
  const [show, setShow] = useState(false);
  const tipId = useId();
  const text = disabled && disabledReason ? `${label}: ${disabledReason}` : label;

  const open = useCallback((delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setShow(true), delay);
  }, []);
  const close = useCallback(() => {
    window.clearTimeout(timer.current);
    setShow(false);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={label}
        aria-disabled={disabled || undefined}
        aria-describedby={show ? tipId : undefined}
        onClick={(e) => {
          e.stopPropagation();
          if (disabled) return;
          onClick?.(e);
        }}
        onMouseEnter={() => open(250)}
        onMouseLeave={close}
        onFocus={(e) => {
          if (e.currentTarget.matches(':focus-visible')) open(0);
        }}
        onBlur={close}
        onKeyDown={(e) => {
          if (e.key === 'Escape') close();
        }}
        className={cn(
          'inline-flex h-10 w-10 shrink-0 sm:h-8 sm:w-8 items-center justify-center rounded-[10px] border text-[16px] transition-colors',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28]',
          VARIANT[variant],
          disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent',
          className
        )}
      >
        <span className="flex h-4 w-4 items-center justify-center [&>svg]:h-4 [&>svg]:w-4" aria-hidden="true">
          {icon}
        </span>
      </button>
      {show && <Tooltip id={tipId} text={text} anchor={ref.current} />}
    </>
  );
}
