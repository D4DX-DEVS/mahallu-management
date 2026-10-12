import { useState, useRef, useEffect, ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { FiChevronDown } from 'react-icons/fi';
import Button from './Button';

export interface DropdownItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  className?: string;
}

export default function Dropdown({
  trigger,
  items,
  align = 'right',
  className,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn('relative inline-block text-left', className)} ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)}>{trigger}</div>

      {isOpen && (
        <div
          className={cn(
            'absolute z-10 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-white shadow-pop focus:outline-none dark:border-surface-border dark:bg-surface-raised',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          <div className="p-1" role="menu" aria-orientation="vertical">
            {items.map((item, index) => (
              <button
                key={index}
                onClick={() => {
                  item.onClick();
                  setIsOpen(false);
                }}
                disabled={item.disabled}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12.5px] font-semibold',
                  'text-[#3A4741] dark:text-surface-text',
                  'hover:bg-[#F4F7F5] dark:hover:bg-surface-hover focus-visible:outline-none focus-visible:bg-[#F4F7F5]',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  item.className
                )}
                role="menuitem"
              >
                {item.icon && <span className="flex items-center justify-center w-4 h-4">{item.icon}</span>}
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

