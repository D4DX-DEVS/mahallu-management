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
    // HIDDEN per CEO decision (Youth Volunteer Wing / Sevana Vedi + Women's Forum) — volunteer summary fetching disabled; import retained for future reactivation.
    void volunteerService;
    void activeVolunteerCount;
    void setActiveVolunteerCount;
  }, []);
  const COUNT_OVERRIDES: Record<string, number> = {
    marriageable: approvedNikahCount,
  };
  // HIDDEN per CEO decision — Employment (job-seekers) and Volunteers hidden from dashboard snapshot. Retained in service layer for future reactivation.
  const HIDDEN_REGISTER_KEYS = new Set<string>([
    'volunteers', // Youth Volunteer Wing / Sevana Vedi + Women's Forum / Vanitha Vedi
    'job-seekers', // Employment Database
  ]);
  /*
   * Zero-count registers are kept. They used to be filtered out, so a register
   * that fell to zero vanished without explanation — which is exactly when
   * someone needs to see it. */
  const filteredRegisters = registers.filter((row) => !HIDDEN_REGISTER_KEYS.has(row.key));
  const topRegisters = filteredRegisters
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
      {children && <div className="space-y-4">{children}</div>}
      {topRegisters.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
            <h2 className="text-sm font-semibold text-foreground">Community registers</h2>
            <Link
              to="/registers"
              className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              View all
            </Link>
          </div>
          <div className="divide-y divide-border/60">
            {topRegisters.map((row) => (
              <button
                key={row.key}
                type="button"
                onClick={() => navigate('/registers/' + row.key)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    {REGISTER_ICONS[row.key] ?? <FiUsers className="h-4 w-4" />}
                  </span>
                  <span className="truncate text-sm font-medium text-foreground">{row.label}</span>
                </span>
                <span className="flex-shrink-0 text-lg font-semibold tabular-nums text-foreground">{row.count}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
