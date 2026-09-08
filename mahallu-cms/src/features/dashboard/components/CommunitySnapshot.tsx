import { ReactNode, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiUsers,
  FiHeart,
  FiBriefcase,
  FiTool,
  FiBook,
  FiUserX,
  FiLifeBuoy,
  FiHome,
  FiGift,
} from 'react-icons/fi';
import Alert from '@/components/ui/Alert';
import DashboardStatCard from './DashboardStatCard';
import { registerService, RegisterSummaryRow } from '@/services/registerService';
import { surveyService } from '@/services/surveyService';
import { committeeService } from '@/services/committeeService';
import { registrationService } from '@/services/registrationService';
import { volunteerService } from '@/services/volunteerService';
import { pluralise } from '@/utils/errors'; /* One icon per concept. Colour is not used to distinguish register categories — * it carried no meaning and made the grid read as a rainbow. */
const REGISTER_ICONS: Record<string, ReactNode> = {
  'zakat-payers': <FiGift className="h-4 w-4" />,
  'zakat-beneficiaries': <FiGift className="h-4 w-4" />,
  'job-seekers': <FiBriefcase className="h-4 w-4" />,
  'skilled-workers': <FiTool className="h-4 w-4" />,
  students: <FiBook className="h-4 w-4" />,
  marriageable: <FiHeart className="h-4 w-4" />,
  volunteers: <FiUsers className="h-4 w-4" />,
  widows: <FiUsers className="h-4 w-4" />,
  orphans: <FiUsers className="h-4 w-4" />,
  disabled: <FiLifeBuoy className="h-4 w-4" />,
  elderly: <FiHeart className="h-4 w-4" />,
  unemployed: <FiUserX className="h-4 w-4" />,
  welfare: <FiHome className="h-4 w-4" />,
};
interface CommunitySnapshotProps {
  /*
   * Extra stat cards rendered above the register grid. */
  children?: ReactNode;
} /** Alerts that need action, then the community registers snapshot. */
export default function CommunitySnapshot({ children }: CommunitySnapshotProps) {
  const navigate = useNavigate();
  const [registers, setRegisters] = useState<RegisterSummaryRow[]>([]);
  const [surveyOverdue, setSurveyOverdue] = useState(false);
  const [expiringCommittees, setExpiringCommittees] = useState(0);
  const [approvedNikahCount, setApprovedNikahCount] = useState(0);
  const [activeVolunteerCount, setActiveVolunteerCount] = useState(0);
  useEffect(() => {
    registerService
      .getSummary()
      .then(setRegisters)
      .catch(() => setRegisters([]));
    surveyService
      .getStatus()
      .then((status) => setSurveyOverdue(status.isOverdue))
      .catch(() => setSurveyOverdue(false));
    committeeService
      .getAll({ expiring: 'true', limit: 1 })
      .then((result) => setExpiringCommittees(result?.pagination?.total ?? 0))
      .catch(() => setExpiringCommittees(0));
    registrationService
      .getAllNikah({ status: 'approved', limit: 1 })
      .then((result) => setApprovedNikahCount(result?.pagination?.total ?? 0))
      .catch(() => setApprovedNikahCount(0));
    volunteerService
      .getSummary()
      .then((summary) => setActiveVolunteerCount(summary?.totalActiveVolunteers ?? 0))
      .catch(() => setActiveVolunteerCount(0));
  }, []);
  const COUNT_OVERRIDES: Record<string, number> = {
    marriageable: approvedNikahCount,
    volunteers: activeVolunteerCount,
  };
  /*
   * Zero-count registers are kept. They used to be filtered out, so a register
   * that fell to zero vanished without explanation — which is exactly when
   * someone needs to see it. */
  const topRegisters = registers
    .map((row) => (row.key in COUNT_OVERRIDES ? { ...row, count: COUNT_OVERRIDES[row.key] } : row))
    .slice(0, 8);
  return (
    <div className="space-y-4">
      {(surveyOverdue || expiringCommittees > 0) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {surveyOverdue && (
            <Alert
              variant="warning"
              title="Survey renewal overdue"
              action={{ label: 'Open survey', onClick: () => navigate('/survey') }}
            >
              Generate a fresh demographic snapshot.
            </Alert>
          )}
          {expiringCommittees > 0 && (
            <Alert
              variant="warning"
              title={pluralise(expiringCommittees, 'committee term') + ' ending soon'}
              action={{ label: 'Open committees', onClick: () => navigate('/committees') }}
            >
              Schedule re-election within the next 60 days.
            </Alert>
          )}
        </div>
      )}
      {children && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>}
      {topRegisters.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Community registers</h2>
            <Link
              to="/registers"
              className="rounded-sm text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              View all
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {topRegisters.map((row) => (
              <DashboardStatCard
                key={row.key}
                label={row.label}
                value={row.count}
                icon={REGISTER_ICONS[row.key] ?? <FiUsers className="h-4 w-4" />}
                onClick={() => navigate('/registers/' + row.key)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
