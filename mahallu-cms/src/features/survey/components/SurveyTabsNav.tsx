import { useLocation, useNavigate } from 'react-router-dom';
import Tabs from '@/components/ui/Tabs';

const ITEMS = [
  { value: '/survey', label: 'Surveys' },
  { value: '/survey/snapshots', label: 'Demographic snapshots' },
];

/** Switches between configurable surveys and the demographic snapshots generated from live records. */
export default function SurveyTabsNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const value = pathname.startsWith('/survey/snapshots') ? '/survey/snapshots' : '/survey';
  return (
    <div className="mb-4">
      <Tabs ariaLabel="Survey sections" items={ITEMS} value={value} onChange={(next) => navigate(next)} />
    </div>
  );
}
