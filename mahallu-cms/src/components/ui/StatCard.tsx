import { ReactNode } from 'react';
import { FiTrendingUp, FiTrendingDown } from 'react-icons/fi';
import Card from './Card';
import { cn } from '@/utils/cn';

export interface StatCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  onClick?: () => void;
  className?: string;
}

export default function StatCard({
  title,
  value,
  icon,
  trend,
  onClick,
  className,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
      padding="md"
      hoverEffect={true}
    >
      <div className="flex items-center justify-between overflow-hidden">
        <div className="flex-1 min-w-0">
          <p className="text-[0.72rem] font-medium uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
            {title}
          </p>
          <p className="mt-1.5 text-xl sm:text-[1.75rem] font-bold text-gray-900 dark:text-gray-100 tracking-tight truncate leading-none">
            {value}
          </p>
          {trend && (
            <div className="mt-1.5 flex items-center">
              {trend.isPositive ? (
                <FiTrendingUp className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <FiTrendingDown className="h-3.5 w-3.5 text-red-500" />
              )}
              <span
                className={cn(
                  'ml-1 text-xs font-medium',
                  trend.isPositive ? 'text-green-600' : 'text-red-600'
                )}
              >
                {Math.abs(trend.value)}%
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div className="ml-3 flex-shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400 ring-1 ring-primary-100 dark:ring-primary-800">
              {icon}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

