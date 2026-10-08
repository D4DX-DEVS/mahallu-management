import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

/**
 * Lets a Table put its "Sort by" control inside the TableToolbar above it.
 *
 * Toolbar and table are siblings inside a TableCard, so the card owns this
 * context: the toolbar registers an element for the control, the table
 * portals into it. The sort used to render as its own row between the toolbar
 * and the table. A toolbar that brings its own sort (`sortOptions`) sets
 * `toolbarSorts`, and the table then renders no second one.
 */
interface TableSlotValue {
  slot: HTMLElement | null;
  setSlot: (node: HTMLElement | null) => void;
  toolbarSorts: boolean;
  setToolbarSorts: (value: boolean) => void;
}

const TableSlotContext = createContext<TableSlotValue | null>(null);

export function TableSlotProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [toolbarSorts, setToolbarSorts] = useState(false);
  const value = useMemo(() => ({ slot, setSlot, toolbarSorts, setToolbarSorts }), [slot, toolbarSorts]);
  return <TableSlotContext.Provider value={value}>{children}</TableSlotContext.Provider>;
}

export function useTableSlot() {
  return useContext(TableSlotContext);
}
