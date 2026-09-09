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
    <div className="mt-4 pt-6 border-t border-gray-200 dark:border-gray-700">
      <h3 className="text-base font-semibold mb-3 text-foreground">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{description}</p>

      <div className="space-y-3">
        {values.map((value, index) => (
          <div key={index} className="flex items-center gap-4">
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
              variant="outline"
              onClick={() => onChange(values.filter((_, i) => i !== index))}
              className="whitespace-nowrap"
            >
              Remove
            </Button>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          onClick={() => onChange([...values, ''])}
          className="w-full mt-2"
        >
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
