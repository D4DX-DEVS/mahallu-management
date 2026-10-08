import React, { useId } from 'react';
import { cn } from '@/utils/cn';

interface RadioCardOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface RadioCardGroupProps {
  label: string;
  options: RadioCardOption[];
  value?: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  /** Chips per row. 8 is for a short code list (blood groups): 4 on a phone, one row from `md` up. */
  columns?: 2 | 3 | 4 | 8;
}

/* Compact, control-height chips. The grid carries `radio-card-grid` so the
 * create/edit modal's "every .grid is one or two columns" rule (index.css)
 * leaves it alone; without it every chip became a full-width row. */
const GRID_COLS = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  8: 'grid-cols-4 md:grid-cols-8',
};

export default function RadioCardGroup({
  label,
  options,
  value,
  onChange,
  error,
  required,
  columns = 2,
}: RadioCardGroupProps) {
  const labelId = useId();

  return (
    <div className="w-full">
      <p id={labelId} className="mb-1.5 block text-label font-medium text-foreground/90">
        {label}
        {required && (
          <span className="ml-1 text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className={cn('radio-card-grid grid gap-2', GRID_COLS[columns])}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                'flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2 text-sm font-medium shadow-sm',
                'transition-[border-color,background-color,color] duration-150 cursor-pointer',
                'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:border-primary',
                selected
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-input/40 bg-card text-foreground hover:border-input/70 hover:bg-accent/40'
              )}
            >
              {option.icon}
              <span className="truncate">{option.label}</span>
            </button>
          );
        })}
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
