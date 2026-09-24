import React from 'react';

interface RadioCardOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface RadioCardGroupProps {
  label: string;
  options: RadioCardOption[];
  value?: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  columns?: 2 | 3 | 4;
}

export default function RadioCardGroup({
  label,
  options,
  value,
  onChange,
  error,
  required,
  columns = 2,
}: RadioCardGroupProps) {
  /* One card per row on a phone. Four options across a 320px screen gave each
   * card ~68px, which truncated every label it was meant to make readable. */
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4',
  };

  return (
    <div className="space-y-1">
      <label className="block text-label font-medium text-foreground">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </label>
      <div className={`grid ${gridCols[columns]} gap-2`}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`
              relative flex min-h-11 w-full items-center justify-center rounded-md border-2 px-4 py-2 pr-8 text-sm transition-colors
              ${
                value === option.value
                  ? 'border-primary bg-accent'
                  : 'border-input bg-background hover:bg-accent/40'
              }
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
              cursor-pointer
            `}
          >
            <span
              className={`min-w-0 break-words text-center font-medium ${
                value === option.value ? 'text-primary' : 'text-foreground'
              }`}
            >
              {option.label}
            </span>
            {value === option.value && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <svg
                  className="h-4 w-4 text-primary"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>
      {error && <p className="mt-1 text-label text-destructive">{error}</p>}
    </div>
  );
}
