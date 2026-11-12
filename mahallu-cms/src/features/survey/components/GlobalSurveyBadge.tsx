import { FiGlobe } from 'react-icons/fi';
import Badge from '@/components/ui/Badge';

/** Marks a survey shared with every Mahallu. */
export default function GlobalSurveyBadge() {
  return (
    <Badge variant="info" className="gap-1 whitespace-nowrap">
      <FiGlobe className="h-3 w-3" aria-hidden="true" />
      All Mahallus
    </Badge>
  );
}
