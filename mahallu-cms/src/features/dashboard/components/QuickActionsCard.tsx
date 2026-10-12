import { Link } from 'react-router-dom';
import Card from '@/components/ui/Card';
import { useQuickActions } from '../quickActions';

/** Soft-button shortcuts, filtered by role and tenant modules (same rules as the menu). */
export default function QuickActionsCard() {
  const actions = useQuickActions();
  if (actions.length === 0) return null;
  return (
    <Card padding="lg">
      <h2 className="text-sm font-extrabold text-primary-700 dark:text-surface-text">Quick actions</h2>
      <p className="mb-3 text-[12px] text-[#7B8983] dark:text-surface-muted">Most common daily tasks</p>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.id}
              to={a.path}
              className="inline-flex h-[34px] max-sm:h-10 items-center gap-1.5 rounded-[10px] bg-mint px-3.5 text-[12.5px] font-bold text-primary-700 transition-all duration-150 hover:bg-[#DCEBE3] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28] active:scale-[0.98] dark:bg-brand-lime/15 dark:text-brand-lime dark:hover:bg-brand-lime/25"
            >
              <Icon className="h-3.5 w-3.5" /> {a.label}
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
