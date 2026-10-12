import { useState } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import { TableColumn } from '@/types';
import { cn } from '@/utils/cn';

interface Props<T> {
  columns: TableColumn<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  rowId: (row: T, index: number) => string;
  selectable?: boolean;
  selected: string[];
  setSelected: (ids: string[]) => void;
}

const STATUS_KEY = /(^|_|\b)(status|state|active|approval|stage|grade)(s)?$/i;
const isActions = (c: TableColumn<any>) => c.key === 'actions' || (c.label.trim() === '' && c.key !== 'name');

/** Split the columns into card roles: primary (name), secondary, status, actions, key fields and the rest. */
const INDEX_COL = /^(#|no\.?|sl\.?\s?no\.?|s\.?\s?no\.?|sr\.?\s?no\.?|sl|sr)$/i;
const NAME_COL = /(^|[^a-z])(name|title)([^a-z]|$)|^(house|family|member|campaign|institute|committee|donor|patient|beneficiary)$/i;
export function planCard<T>(columns: TableColumn<T>[]) {
  const actions = columns.find(isActions);
  // a bare row-number column is noise on a card
  const rest = columns.filter((c) => c !== actions && !(INDEX_COL.test(c.label.trim()) || /^(index|serial|slNo|sno|rowNo)$/i.test(c.key)));
  const status = rest.find((c, i) => i > 0 && (STATUS_KEY.test(c.key) || /status/i.test(c.label)));
  const body = rest.filter((c) => c !== status);
  // the title is the first name-like column, otherwise simply the first column
  const primary = body.find((c) => NAME_COL.test(c.key) || NAME_COL.test(c.label)) ?? body[0];
  const fields = body.filter((c) => c !== primary);
  return { primary, status, actions, fields };
}

/**
 * Phone layout for <Table>: one card per row.
 * Header: first column (name/avatar) + status chip + actions. Then up to 4 key fields in a 2-column grid,
 * every remaining column behind a "More" toggle so no data is lost.
 */
export default function TableCards<T extends Record<string, any>>({ columns, data, onRowClick, rowId, selectable, selected, setSelected }: Props<T>) {
  const plan = planCard(columns);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const render = (c: TableColumn<T>, row: T, i: number) => (c.render ? c.render(row[c.key], row, i) : row[c.key] ?? '-');
  const KEY = 4;

  return (
    <ul className="divide-y divide-line-soft bg-white dark:divide-surface-border dark:bg-surface-card" aria-label="Results">
      {data.map((row, i) => {
        const id = rowId(row, i);
        const isSel = selectable && selected.includes(id);
        // one leftover field is shown directly instead of behind "1 more"
        const cut = plan.fields.length === KEY + 1 ? KEY + 1 : KEY;
        const shown = plan.fields.slice(0, cut);
        const more = plan.fields.slice(cut);
        const expanded = !!open[id];
        return (
          <li
            key={i}
            onClick={() => onRowClick?.(row)}
            className={cn(
              'relative px-3.5 py-3 text-[13px] text-[#18231E] dark:text-surface-text',
              onRowClick && 'cursor-pointer active:bg-[#F6FAF8] dark:active:bg-surface-hover/60',
              isSel && 'bg-[#F3F9F5] dark:bg-brand-lime/10'
            )}
          >
            <div className="flex items-start gap-2.5">
              {selectable && (
                <label className="-m-2 flex h-11 w-11 flex-shrink-0 items-center justify-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label="Select row"
                    className="h-5 w-5 cursor-pointer rounded accent-primary-700 dark:accent-brand-lime"
                    checked={!!isSel}
                    onChange={(e) => setSelected(e.target.checked ? [...selected, id] : selected.filter((x) => x !== id))}
                  />
                </label>
              )}
              <div className="min-w-0 flex-1 break-words">
                {plan.primary ? render(plan.primary, row, i) : null}
              </div>
              {(plan.status || plan.actions) && (
                <div className="flex flex-shrink-0 flex-col items-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {plan.actions && <div className="flex items-center">{render(plan.actions, row, i)}</div>}
                  {plan.status && <div>{render(plan.status, row, i)}</div>}
                </div>
              )}
            </div>
            {shown.length > 0 && (
              <dl className={cn('mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2', selectable && 'pl-[34px]')}>
                {shown.map((c) => (
                  <Field key={c.key} c={c} row={row} i={i} render={render} />
                ))}
                {expanded && more.map((c) => <Field key={c.key} c={c} row={row} i={i} render={render} />)}
              </dl>
            )}
            {more.length > 0 && (
              <button
                type="button"
                aria-expanded={expanded}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen((o) => ({ ...o, [id]: !o[id] }));
                }}
                className={cn('mt-1.5 inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-bold text-primary-600 hover:bg-mint dark:text-brand-lime dark:hover:bg-surface-hover', selectable ? 'ml-[26px]' : '-ml-2')}
              >
                {expanded ? 'Less' : `${more.length} more`}
                <FiChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Field<T extends Record<string, any>>({ c, row, i, render }: { c: TableColumn<T>; row: T; i: number; render: (c: TableColumn<T>, row: T, i: number) => React.ReactNode }) {
  return (
    <div className="min-w-0">
      {c.label && <dt className="text-xs font-bold uppercase tracking-[0.03em] text-[#7B8983] dark:text-surface-muted">{c.label}</dt>}
      <dd className="mt-0.5 min-w-0 break-words text-[13px]">{render(c, row, i)}</dd>
    </div>
  );
}
