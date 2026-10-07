import { ReactNode, useEffect, useState } from 'react';
import { cn } from '@/utils/cn';

export interface TabItem {
  value: string;
  label: string;
  count?: number;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  className?: string;
  ariaLabel?: string;
}

/**
 * The shared page-level tab strip. It mirrors the compact segmented navigation
 * used by Align UI while keeping the active state in the URL/page that owns
 * the content. Use `value` for route-backed tabs and `defaultValue` for local
 * panels.
 */
export default function Tabs({
  items,
  value,
  defaultValue,
  onChange,
  className,
  ariaLabel = 'Sections',
}: TabsProps) {
  const firstValue = items[0]?.value ?? '';
  const [internalValue, setInternalValue] = useState(defaultValue ?? firstValue);
  const activeValue = value ?? internalValue;

  useEffect(() => {
    if (value !== undefined) setInternalValue(value);
  }, [value]);

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('flex max-w-full items-center gap-1 overflow-x-auto border-b border-border', className)}
    >
      {items.map((item) => {
        const active = item.value === activeValue;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={item.disabled}
            onClick={() => {
              if (value === undefined) setInternalValue(item.value);
              onChange?.(item.value);
            }}
            className={cn(
              'relative inline-flex h-11 flex-shrink-0 items-center gap-2 px-3 text-sm font-medium text-muted-foreground transition-colors',
              'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
              'disabled:pointer-events-none disabled:opacity-40',
              active && 'text-primary after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary'
            )}
          >
            {item.icon && <span className="flex h-4 w-4 items-center justify-center [&>svg]:h-4 [&>svg]:w-4">{item.icon}</span>}
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span className={cn('rounded-full px-1.5 py-0.5 text-xs', active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
