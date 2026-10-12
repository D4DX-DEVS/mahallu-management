import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface StringListEditorProps {
  title: string;
  description: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  addLabel: string;
}

/**
 * Editable list of plain strings. Education and area options are the same
 * widget, so they share one component instead of two copies of the markup.
 */
export default function StringListEditor({
  title,
  description,
  values,
  onChange,
  placeholder,
  addLabel,
}: StringListEditorProps) {
  return (
    <div className="mt-6 border-t border-line pt-5 dark:border-surface-border">
      <h3 className="mb-0.5 text-[13.5px] font-bold text-[#18231E] dark:text-surface-text">{title}</h3>
      <p className="mb-3 text-xs text-[#7B8983] dark:text-surface-muted">{description}</p>

      <div className="space-y-3">
        {values.map((value, index) => (
          <div key={index} className="flex items-center gap-3">
            <div className="flex-1">
              <Input
                value={value}
                onChange={(e) => {
                  const next = [...values];
                  next[index] = e.target.value;
                  onChange(next);
                }}
                placeholder={placeholder}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onChange(values.filter((_, i) => i !== index))}
              className="whitespace-nowrap"
            >
              Remove
            </Button>
          </div>
        ))}

        <Button type="button" variant="secondary" onClick={() => onChange([...values, ''])} className="w-full mt-2">
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
