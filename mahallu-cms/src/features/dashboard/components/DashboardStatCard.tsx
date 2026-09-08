import { ReactNode } from 'react';
import StatCard from '@/components/ui/StatCard'; /** * Adapter kept so existing call sites compile. It now renders the single * `StatCard`. * * The nine `accent` colours this component used to carry are deliberately * ignored: they were assigned to register categories arbitrarily (students * emerald, marriageable rose, job-seekers indigo) and encoded nothing a user * could read. Colour is reserved for state that needs acting on. */
export type StatCardAccent =
  'slate' | 'rose' | 'violet' | 'emerald' | 'amber' | 'indigo' | 'lime' | 'orange' | 'red';

export interface DashboardStatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  /** @deprecated Ignored. Colour is not decorative. */
  accent?: StatCardAccent;
  hint?: string;
  trend?: { value: number; isPositive: boolean };
  onClick?: () => void;
  className?: string;
}

export default function DashboardStatCard({
  label,
  value,
  icon,
  hint,
  trend,
  onClick,
  className,
}: DashboardStatCardProps) {
  return (
    <StatCard
      title={label}
      value={value}
      icon={icon}
      hint={hint}
      trend={trend}
      onClick={onClick}
      className={className}
    />
  );
}
