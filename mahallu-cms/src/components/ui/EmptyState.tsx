import { ReactNode } from 'react';
import { FiInbox } from 'react-icons/fi';
import Button from './Button';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({
  title = 'No data available',
  description = 'There are no items to display at the moment.',
  icon,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12">
      {icon || (
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-mint text-primary-600 dark:bg-brand-lime/10 dark:text-brand-lime">
          <FiInbox className="h-6 w-6" />
        </span>
      )}
      <h3 className="mb-1 text-sm font-bold text-[#18231E] dark:text-surface-text">{title}</h3>
      <p className="mb-5 max-w-md text-center text-xs text-[#7B8983] dark:text-surface-muted">{description}</p>
      {action && <Button onClick={action.onClick}>{action.label}</Button>}
    </div>
  );
}
