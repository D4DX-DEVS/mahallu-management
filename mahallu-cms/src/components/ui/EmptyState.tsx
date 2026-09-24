import { ReactNode } from 'react';
import { FiInbox, FiSearch, FiAlertCircle, FiLock } from 'react-icons/fi';
import Button from './Button';
import { cn } from '@/utils/cn';
export type EmptyStateVariant = 'empty' | 'no-results' | 'error' | 'no-access';
export interface EmptyStateProps {
  /*
   *
   * `empty` — nothing exists yet. `no-results` — filters matched nothing.
   * `error` — the request failed. `no-access` — the user lacks permission.
   * These are different situations and need different copy and different
   * actions; treating them all as "No data available" strands the user. */
  variant?: EmptyStateVariant;
  /*
   * Entity name, e.g. "families". Used to write the default copy. */
  entity?: string;
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  className?: string;
}
const DEFAULT_ICON: Record<EmptyStateVariant, React.ComponentType<{ className?: string }>> = {
  empty: FiInbox,
  'no-results': FiSearch,
  error: FiAlertCircle,
  'no-access': FiLock,
};
const ICON_TONE: Record<EmptyStateVariant, string> = {
  empty: 'text-muted-foreground',
  'no-results': 'text-muted-foreground',
  error: 'text-destructive',
  'no-access': 'text-warning',
};
function defaultCopy(variant: EmptyStateVariant, entity?: string) {
  const thing = entity ?? 'records';
  switch (variant) {
    case 'no-results':
      return { title: 'No matches', description: 'No ' + thing + ' match your search or filters.' };
    case 'error':
      return {
        title: 'Couldn’t load ' + thing,
        description: 'Something went wrong on our side. Try again in a moment.',
      };
    case 'no-access':
      return {
        title: 'You don’t have access',
        description: 'Ask a Mahall admin to grant you access to this section.',
      };
    default:
      return { title: 'No ' + thing + ' yet', description: 'Once ' + thing + ' are added they appear here.' };
  }
}
export default function EmptyState({
  variant = 'empty',
  entity,
  title,
  description,
  icon,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  const copy = defaultCopy(variant, entity);
  const Icon = DEFAULT_ICON[variant];
  return (
    <div className={cn('flex flex-col items-center justify-center px-4 py-10 text-center', className)}>
      {icon ?? <Icon className={cn('mb-3 h-8 w-8', ICON_TONE[variant])} aria-hidden="true" />}
      <h3 className="text-base font-semibold text-foreground">{title ?? copy.title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description ?? copy.description}</p>
      {(action || secondaryAction) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {action && <Button onClick={action.onClick}>{action.label}</Button>}
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
