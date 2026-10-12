import Alert from './Alert';
import Button from './Button';

/** "Draft restored" notice with a discard action, shown at the top of a wizard form. */
export default function DraftAlert({ savedAt, onDiscard }: { savedAt?: number | null; onDiscard: () => void }) {
  return (
    <Alert
      tone="info"
      title="Draft restored"
      action={
        <Button type="button" size="sm" variant="secondary" onClick={onDiscard}>
          Discard draft
        </Button>
      }
    >
      We restored the draft you saved{savedAt ? ` on ${new Date(savedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}. Review it and continue.
    </Alert>
  );
}
