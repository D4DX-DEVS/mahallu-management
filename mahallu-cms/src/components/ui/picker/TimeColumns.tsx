import { useEffect, useRef } from 'react';
import { cn } from '@/utils/cn';

interface Props {
  /** 'HH:mm' or ''. */
  value: string;
  onChange: (hhmm: string) => void;
  step?: number;
  phone?: boolean;
  autoFocus?: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

function Column({ items, current, onPick, label, phone, autoFocus }: { items: number[]; current: number | null; onPick: (n: number) => void; label: string; phone?: boolean; autoFocus?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = ref.current;
    const cur = box?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (box && cur) box.scrollTop = cur.offsetTop - box.clientHeight / 2 + cur.clientHeight / 2;
    if (autoFocus) (cur ?? box?.querySelector<HTMLElement>('button'))?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const btns = Array.from(ref.current?.querySelectorAll<HTMLElement>('button') ?? []);
    const i = btns.indexOf(document.activeElement as HTMLElement);
    const n = btns[i + (e.key === 'ArrowDown' ? 1 : -1)];
    if (n) {
      e.preventDefault();
      e.stopPropagation();
      n.focus();
    }
  };
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="mb-1 text-center text-[12px] font-semibold uppercase tracking-wide text-[#7B8983] dark:text-surface-muted">{label}</div>
      <div ref={ref} role="listbox" aria-label={label} onKeyDown={onKey} className={cn('flex flex-col gap-0.5 overflow-y-auto overscroll-contain', phone ? 'max-h-[176px]' : 'max-h-[168px]')}>
        {items.map((n) => {
          const sel = n === current;
          return (
            <button
              key={n}
              type="button"
              role="option"
              aria-selected={sel}
              tabIndex={sel || (current === null && n === items[0]) ? 0 : -1}
              onClick={() => onPick(n)}
              className={cn(
                'flex flex-shrink-0 items-center justify-center rounded-lg text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 dark:focus-visible:ring-brand-lime',
                phone ? 'h-11' : 'h-8',
                sel ? 'bg-primary-700 font-bold text-white dark:bg-brand-lime dark:text-brand-night' : 'text-[#18231E] hover:bg-primary-50 dark:text-surface-text dark:hover:bg-surface-hover'
              )}
            >
              {pad(n)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function TimeColumns({ value, onChange, step = 5, phone, autoFocus }: Props) {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  const h = m ? +m[1] : null;
  const mi = m ? +m[2] : null;
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const mins = Array.from({ length: Math.ceil(60 / step) }, (_, i) => i * step);
  if (mi !== null && !mins.includes(mi)) mins.push(mi), mins.sort((a, b) => a - b);
  return (
    <div className="flex gap-2">
      <Column items={hours} current={h} label="Hour" phone={phone} autoFocus={autoFocus} onPick={(n) => onChange(`${pad(n)}:${pad(mi ?? 0)}`)} />
      <Column items={mins} current={mi} label="Min" phone={phone} onPick={(n) => onChange(`${pad(h ?? 0)}:${pad(n)}`)} />
    </div>
  );
}
