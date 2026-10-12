import { ReactNode } from 'react';
import { FiAlertCircle, FiAlertTriangle, FiCheckCircle, FiInfo } from 'react-icons/fi';
import { cn } from '@/utils/cn';

export interface AlertProps {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

const TONES = {
  info: { wrap: 'bg-[#EAF1FB] text-[#1F4E8C] border-[#D3E2F6] dark:bg-blue-400/10 dark:text-blue-300 dark:border-blue-400/20', Icon: FiInfo },
  success: { wrap: 'bg-mint text-primary-700 border-mint-deep dark:bg-brand-lime/10 dark:text-brand-lime dark:border-brand-lime/20', Icon: FiCheckCircle },
  warning: { wrap: 'bg-[#FFF6CC] text-[#7A5B00] border-[#F3E39B] dark:bg-secondary-500/10 dark:text-secondary-300 dark:border-secondary-500/20', Icon: FiAlertTriangle },
  danger: { wrap: 'bg-[#FDECEA] text-[#B3261E] border-[#F7D0CC] dark:bg-red-500/10 dark:text-red-300 dark:border-red-400/20', Icon: FiAlertCircle },
};

export default function Alert({ tone = 'info', title, children, action, className }: AlertProps) {
  const { wrap, Icon } = TONES[tone];
  return (
    <div role="alert" className={cn('flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[12.5px]', wrap, className)}>
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className={cn('font-medium', title && 'mt-0.5 opacity-90')}>{children}</div>}
      </div>
      {action}
    </div>
  );
}
