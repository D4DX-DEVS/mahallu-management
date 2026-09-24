import { ReactNode } from 'react';
import { FiAlertCircle, FiAlertTriangle, FiCheckCircle, FiInfo } from 'react-icons/fi';
import { cn } from '@/utils/cn';
import Button from './Button';
export type AlertVariant = 'error' | 'warning' | 'success' | 'info';
export interface AlertProps {
  variant?: AlertVariant; /** Short, specific. "Couldn't load families" — not "Error". */
  title?: string;
  children?: ReactNode;
  /** Recovery action. Every error alert should offer one. */
  action?: { label: string; onClick: () => void };
  className?: string;
}

const VARIANTS: Record<
  AlertVariant,
  {
    wrap: string;
    icon: React.ComponentType<{ className?: string }>;
    iconColor: string;
    role: 'alert' | 'status';
  }
> = {
  error: {
    wrap: 'border-destructive/30 bg-destructive/5',
    icon: FiAlertCircle,
    iconColor: 'text-destructive',
    role: 'alert',
  },
  warning: {
    wrap: 'border-warning/30 bg-warning/5',
    icon: FiAlertTriangle,
    iconColor: 'text-warning',
    role: 'alert',
  },
  success: {
    wrap: 'border-success/30 bg-success/5',
    icon: FiCheckCircle,
    iconColor: 'text-success',
    role: 'status',
  },
  info: { wrap: 'border-info/30 bg-info/5', icon: FiInfo, iconColor: 'text-info', role: 'status' },
}; /** * The one inline message component. Replaces five different hand-rolled error * treatments that existed across Dashboard, list pages, forms and login. */
export default function Alert({ variant = 'info', title, children, action, className }: AlertProps) {
  const { wrap, icon: Icon, iconColor, role } = VARIANTS[variant];
  return (
    <div
      role={role}
      aria-live={role === 'alert' ? 'assertive' : 'polite'}
      className={cn('flex items-start gap-3 rounded-md border p-4 text-sm', wrap, className)}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 flex-shrink-0', iconColor)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold text-foreground">{title}</p>}
        {children && <div className={cn('text-muted-foreground', title && 'mt-1')}>{children}</div>}
      </div>
      {action && (
        <Button variant="outline" size="sm" onClick={action.onClick} className="flex-shrink-0">
          {action.label}
        </Button>
      )}
    </div>
  );
}
