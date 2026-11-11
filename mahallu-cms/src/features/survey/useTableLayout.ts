import type { TableConfig } from './formEngine';
import { useNarrowerThan } from './useNarrowerThan';

/** Below this width a table question always shows as cards, whatever its size. */
const CARD_BREAKPOINT = 480;
const ROW_LABEL_WIDTH = 160;
const COLUMN_WIDTH = 112;
const ACTIONS_WIDTH = 40;

/** The width a table question needs to show as a table without scrolling sideways. */
const tableWidth = (table: TableConfig | undefined, withActions: boolean) =>
  ROW_LABEL_WIDTH + (table?.columns.length || 1) * COLUMN_WIDTH + (withActions ? ACTIONS_WIDTH : 0);

/** Whether a table question should show its rows as cards, judged by the width it has. */
export function useTableAsCards<T extends HTMLElement>(table: TableConfig | undefined, withActions = false) {
  return useNarrowerThan<T>(Math.max(CARD_BREAKPOINT, tableWidth(table, withActions)));
}
