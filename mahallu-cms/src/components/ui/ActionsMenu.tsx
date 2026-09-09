import { ReactNode } from 'react';
import {
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
import { ROW_ACTION_BASE, ROW_ACTION_VARIANT, RowActionVariant } from './rowAction';

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

/**
 * Row actions, rendered as the actions themselves.
 *
 * This used to be a three-dot button that opened a portalled menu: every row
 * action cost two clicks and was invisible until the first one. A row carries
 * two to four actions across the whole product, which fits on one line, so the
 * buttons are the row's actions — one icon each, named by `title` for a mouse
 * and by `aria-label` for a screen reader.
 *
 * The props are unchanged from the menu it replaces, so the twenty-odd tables
 * that build `items` keep working: `icon`, `disabled`, `disabledReason`,
 * `variant` and `className` all still mean what they meant.
 *
 * Disabled items stay visible and disabled rather than being filtered out, so
 * an action never silently disappears from a row.
 */
export default function ActionsMenu({ items, className, label = 'Actions' }: ActionsMenuProps) {
  if (items.length === 0) return null;

  return (
    <div
      role="group"
      aria-label={label}
      /* `md:-my-1` gives the 32px buttons back the 4px they add to a 2.5-padded
       * table cell, so a row of three buttons is no taller than a row of text.
       * Below `md` these sit in the phone card's own actions footer, which has
       * the room and needs the 36px touch targets. */
      className={cn('inline-flex items-center gap-0.5 md:-my-1', className)}
    >
      {items.map((item) => {
        const icon = item.icon ?? fallbackIcon(item.label);
        /* The tooltip is the label when the action is available and the reason
         * when it is not — the menu showed the same two strings. A disabled
         * button fires no pointer events, so its own `title` never appears;
         * the reason an action is unavailable is exactly the tooltip a user
         * needs most, so it hangs on a wrapper the pointer can still reach. */
        const button = (
          <button
            key={item.label}
            type="button"
            disabled={item.disabled}
            aria-disabled={item.disabled || undefined}
            title={item.disabled ? undefined : item.label}
            aria-label={item.label}
            onClick={(event) => {
              /* Rows are clickable on most of these tables: without this an
               * action also navigates to the record it acted on. */
              event.stopPropagation();
              if (item.disabled) return;
              item.onClick();
            }}
            className={cn(
              ROW_ACTION_BASE,
              ROW_ACTION_VARIANT[item.variant ?? 'default'],
              item.disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent',
              item.className
            )}
          >
            <span
              className="flex h-4 w-4 items-center justify-center [&>svg]:h-4 [&>svg]:w-4"
              aria-hidden="true"
            >
              {icon}
            </span>
          </button>
        );

        if (!item.disabled) return button;
        return (
          <span key={item.label} title={item.disabledReason ?? item.label} className="inline-flex">
            {button}
          </span>
        );
      })}
    </div>
  );
}
