import { KeyboardEvent, useId, useState } from 'react';
import { RiAddLine, RiCloseLine } from 'react-icons/ri';

interface OptionTagsEditorProps {
  values: string[];
  onChange: (values: string[]) => void;
  /** Singular noun for the field label and button, e.g. "education option". */
  noun: string;
  placeholder?: string;
}

/**
 * A list of plain-text options edited as chips: type and press Enter (or paste
 * a comma-separated list) to add, × to remove. Duplicates, ignoring case, are
 * skipped so a list cannot hold "SSLC" twice.
 */
export default function OptionTagsEditor({ values, onChange, noun, placeholder }: OptionTagsEditorProps) {
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const inputId = useId();

  const add = (raw: string) => {
    const incoming = raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (incoming.length === 0) return;
    const seen = new Set(values.map((value) => value.toLowerCase()));
    const fresh: string[] = [];
    incoming.forEach((value) => {
      if (seen.has(value.toLowerCase())) return;
      seen.add(value.toLowerCase());
      fresh.push(value);
    });
    setNotice(fresh.length < incoming.length ? 'Already in the list — skipped.' : null);
    if (fresh.length > 0) onChange([...values, ...fresh]);
    setDraft('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      add(draft);
    } else if (event.key === 'Backspace' && !draft && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {values.length === 0 && <p className="py-1 text-sm text-muted-foreground">No options yet.</p>}
        {values.map((value, index) => (
          <span
            key={value + index}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-card pl-3 pr-1 text-sm text-foreground shadow-sm"
          >
            {value}
            <button
              type="button"
              onClick={() => onChange(values.filter((_, i) => i !== index))}
              aria-label={`Remove ${value}`}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RiCloseLine className="h-4 w-4" aria-hidden="true" />
            </button>
          </span>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <label htmlFor={inputId} className="sr-only">
          Add {noun}
        </label>
        <input
          id={inputId}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onPaste={(event) => {
            const text = event.clipboardData.getData('text');
            if (text.includes(',')) {
              event.preventDefault();
              add(text);
            }
          }}
          placeholder={placeholder ?? `Add ${noun}…`}
          className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-card px-3 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10"
        />
        <button
          type="button"
          onClick={() => add(draft)}
          disabled={!draft.trim()}
          className="inline-flex h-10 flex-shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 text-sm font-medium text-foreground/80 shadow-sm transition-colors hover:bg-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        >
          <RiAddLine className="h-4 w-4" aria-hidden="true" />
          Add
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
        {notice ?? 'Press Enter to add. Paste a comma-separated list to add several at once.'}
      </p>
    </div>
  );
}
