import { useLayoutEffect, useRef, useState } from 'react';
import type { TableConfig } from './formEngine';

/** Below this width a table question always shows as cards, whatever its size. */
const CARD_BREAKPOINT = 480;
const ROW_LABEL_WIDTH = 160;
const COLUMN_WIDTH = 112;
const ACTIONS_WIDTH = 40;

/** The width a table question needs to show as a table without scrolling sideways. */
const tableWidth = (table: TableConfig | undefined, withActions: boolean) =>
  ROW_LABEL_WIDTH + (table?.columns.length || 1) * COLUMN_WIDTH + (withActions ? ACTIONS_WIDTH : 0);

/**
 * Whether a table question should show its rows as cards. It follows the width of the element the
 * ref is on, not the window, so the builder's phone preview gets the same layout as a real phone.
 */
export function useTableAsCards<T extends HTMLElement>(table: TableConfig | undefined, withActions = false) {
  const ref = useRef<T>(null);
  const [cards, setCards] = useState(false);
  const threshold = Math.max(CARD_BREAKPOINT, tableWidth(table, withActions));

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = (width: number) => setCards(width < threshold);
    update(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => update(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, cards] as const;
}
