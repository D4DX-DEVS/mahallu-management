import { useCallback, useMemo, useState } from 'react';
import { TableColumn } from '@/types';

export type TableDensity = 'comfortable' | 'compact';

interface Stored {
  hidden?: string[];
  density?: TableDensity;
}

const keyOf = (id: string) => `mahallu.table.${id}`;

function load(id: string): Stored | null {
  try {
    const raw = localStorage.getItem(keyOf(id));
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

function save(id: string, value: Stored) {
  try {
    localStorage.setItem(keyOf(id), JSON.stringify(value));
  } catch {
    /* storage unavailable: keep in-memory only */
  }
}

const isLocked = <T,>(c: TableColumn<T>) => c.hideable === false || c.key === 'actions';

/**
 * Column visibility + row density for one table, persisted per table id in localStorage.
 * Pass the result's `columns` to <Table columns> and `density` to <Table density>, and
 * spread `menuProps` into <TableColumnMenu>.
 */
export function useTableView<T>(tableId: string, allColumns: TableColumn<T>[]) {
  const [state, setState] = useState<Required<Stored>>(() => {
    const stored = load(tableId);
    return {
      hidden: stored?.hidden ?? allColumns.filter((c) => c.defaultHidden).map((c) => c.key),
      density: stored?.density ?? 'comfortable',
    };
  });

  const update = useCallback(
    (next: Required<Stored>) => {
      setState(next);
      save(tableId, next);
    },
    [tableId]
  );

  const toggle = (key: string) => {
    const col = allColumns.find((c) => c.key === key);
    if (!col || isLocked(col)) return;
    const hidden = state.hidden.includes(key) ? state.hidden.filter((k) => k !== key) : [...state.hidden, key];
    update({ ...state, hidden });
  };
  const setDensity = (density: TableDensity) => update({ ...state, density });
  const reset = () =>
    update({ hidden: allColumns.filter((c) => c.defaultHidden).map((c) => c.key), density: 'comfortable' });

  const columns = useMemo(
    () => allColumns.filter((c) => isLocked(c) || !state.hidden.includes(c.key)),
    [allColumns, state.hidden]
  );

  return {
    columns,
    density: state.density,
    hidden: state.hidden,
    menuProps: {
      columns: allColumns,
      hidden: state.hidden,
      density: state.density,
      onToggle: toggle,
      onDensityChange: setDensity,
      onReset: reset,
    },
  };
}
