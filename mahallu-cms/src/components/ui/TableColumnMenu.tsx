import { useRef, useState } from 'react';
import { FiColumns, FiRotateCcw } from 'react-icons/fi';
import { TableColumn } from '@/types';
import { cn } from '@/utils/cn';
import { useDismiss } from '@/hooks/useDismiss';
import type { TableDensity } from '@/hooks/useTableView';

export interface TableColumnMenuProps {
  columns: TableColumn<any>[];
  hidden: string[];
  density: TableDensity;
  onToggle: (key: string) => void;
  onDensityChange: (density: TableDensity) => void;
  onReset?: () => void;
  className?: string;
}

/** "Columns" popover: show/hide columns and switch row density. Pair with useTableView. */
export default function TableColumnMenu({ columns, hidden, density, onToggle, onDensityChange, onReset, className }: TableColumnMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));
  const choosable = columns.filter((c) => c.hideable !== false && c.key !== 'actions');
  const hiddenCount = choosable.filter((c) => hidden.includes(c.key)).length;

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex h-[34px] max-sm:h-10 items-center gap-1.5 rounded-[10px] border border-line-strong bg-white px-3 text-xs font-semibold text-[#3A4741] transition-colors hover:bg-[#F4F7F5] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28] dark:border-surface-border-strong dark:bg-surface-raised dark:text-surface-text dark:hover:bg-surface-hover"
      >
        <FiColumns className="h-3.5 w-3.5" aria-hidden="true" />
        Columns
        {hiddenCount > 0 && (
          <span className="rounded-full bg-mint px-1.5 text-[12px] font-bold text-primary-700 dark:bg-brand-lime/15 dark:text-brand-lime">-{hiddenCount}</span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Table columns"
          className="absolute right-0 z-50 mt-1.5 w-60 rounded-xl border border-line bg-white p-2 shadow-pop dark:border-surface-border dark:bg-surface-raised"
        >
          <p className="px-2 pb-1 pt-1 text-[12px] font-bold uppercase tracking-[0.03em] text-[#7B8983] dark:text-surface-muted">Columns</p>
          <div className="max-h-64 overflow-y-auto">
            {choosable.map((c) => (
              <label key={c.key} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[12.5px] font-semibold text-[#3A4741] hover:bg-[#F4F7F5] dark:text-surface-text dark:hover:bg-surface-hover">
                <input
                  type="checkbox"
                  className="h-4 w-4 cursor-pointer rounded accent-primary-700 dark:accent-brand-lime"
                  checked={!hidden.includes(c.key)}
                  onChange={() => onToggle(c.key)}
                />
                {c.label}
              </label>
            ))}
          </div>
          <div className="mt-2 border-t border-line-soft pt-2 dark:border-surface-border">
            <p className="px-2 pb-1.5 text-[12px] font-bold uppercase tracking-[0.03em] text-[#7B8983] dark:text-surface-muted">Row density</p>
            <div className="flex gap-1 px-1" role="radiogroup" aria-label="Row density">
              {([
                ['comfortable', 'Comfortable', '44px'],
                ['compact', 'Compact', '36px'],
              ] as const).map(([value, label, px]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={density === value}
                  onClick={() => onDensityChange(value)}
                  className={cn(
                    'flex-1 rounded-lg border px-2 py-1.5 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28]',
                    density === value
                      ? 'border-primary-700 bg-mint text-primary-700 dark:border-brand-lime dark:bg-brand-lime/10 dark:text-brand-lime'
                      : 'border-line bg-white text-[#5B6963] hover:bg-[#F4F7F5] dark:border-surface-border dark:bg-transparent dark:text-surface-muted'
                  )}
                >
                  {label} <span className="font-normal opacity-70">{px}</span>
                </button>
              ))}
            </div>
            {onReset && (
              <button type="button" onClick={onReset} className="mt-2 inline-flex items-center gap-1 px-2 py-1 text-[12px] font-semibold text-[#5B6963] hover:text-primary-700 dark:text-surface-muted dark:hover:text-brand-lime">
                <FiRotateCcw className="h-3 w-3" aria-hidden="true" /> Reset to default
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
