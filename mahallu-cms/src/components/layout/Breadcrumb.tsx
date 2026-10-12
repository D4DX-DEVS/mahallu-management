import { Link } from 'react-router-dom';
import { FiChevronRight, FiHome } from 'react-icons/fi';
import { cn } from '@/utils/cn';

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

/**
 * In-page breadcrumb. The global Header already shows the trail for menu routes, so list pages
 * should not render this; keep it for detail/create/edit screens that sit below a menu entry.
 */
export default function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-2 text-xs text-[#7B8983] dark:text-surface-muted', className)}>
      <Link to="/dashboard" aria-label="Dashboard" className="hover:text-[#18231E] dark:hover:text-surface-text">
        <FiHome className="h-3.5 w-3.5" />
      </Link>
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <FiChevronRight className="h-3 w-3" aria-hidden="true" />
          {item.path && index < items.length - 1 ? (
            <Link to={item.path} className="hover:text-[#18231E] dark:hover:text-surface-text">
              {item.label}
            </Link>
          ) : (
            <span className="font-bold text-[#18231E] dark:text-surface-text">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}
