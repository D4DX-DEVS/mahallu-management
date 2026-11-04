import Field, { useFieldIds } from '@/components/ui/Field';
import { cn } from '@/utils/cn';
import { ENTRY_TYPE_LABEL, UNTYPED_LEDGER_MESSAGE } from '@/utils/ledgerType';
import type { EntryTypeState } from '@/utils/ledgerType';

interface LedgerTypeFieldProps {
  state: EntryTypeState;
}

/**
 * Income or expense for a ledger entry, as read-only text.
 *
 * The chosen ledger decides it (`Ledger.type`; the API refuses an entry that disagrees), so it is shown, not asked
 * for. Same pattern as the derived household in CreateMember: read-only text, not a disabled required input.
 */
export default function LedgerTypeField({ state }: LedgerTypeFieldProps) {
  const helperText =
    state.status === 'typed'
      ? 'Set by the selected ledger.'
      : state.status === 'none'
        ? 'Choose a ledger and the type is filled in for you.'
        : undefined;
  const error = state.status === 'untyped' ? UNTYPED_LEDGER_MESSAGE : undefined;
  const ids = useFieldIds({ error, helperText });
  const text =
    state.status === 'typed' ? ENTRY_TYPE_LABEL[state.type] : state.status === 'none' ? 'Choose a ledger first' : 'Not set on this ledger';

  return (
    <Field ids={ids} label="Type" error={error} helperText={helperText}>
      <output
        id={ids.id}
        aria-describedby={ids.controlProps['aria-describedby']}
        className={cn(
          'flex h-10 w-full items-center rounded-lg border border-border bg-subtle px-3 text-sm',
          state.status === 'typed' && 'font-medium text-foreground',
          state.status === 'none' && 'text-muted-foreground',
          state.status === 'untyped' && 'text-destructive'
        )}
      >
        {text}
      </output>
    </Field>
  );
}
