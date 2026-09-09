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
import Card from '@/components/ui/Card';
import DashboardStatCard, { StatCardAccent } from './DashboardStatCard';
import { registerService, RegisterSummaryRow } from '@/services/registerService';
import { surveyService } from '@/services/surveyService';
import { committeeService } from '@/services/committeeService';
import { registrationService } from '@/services/registrationService';
import { volunteerService } from '@/services/volunteerService';

const REGISTER_ICONS: Record<string, { icon: ReactNode; accent: StatCardAccent }> = {
  'zakat-payers': { icon: <FiGift className="h-4 w-4" />, accent: 'amber' },
  'zakat-beneficiaries': { icon: <FiGift className="h-4 w-4" />, accent: 'rose' },
  'job-seekers': { icon: <FiBriefcase className="h-4 w-4" />, accent: 'indigo' },
  'skilled-workers': { icon: <FiTool className="h-4 w-4" />, accent: 'violet' },
  students: { icon: <FiBook className="h-4 w-4" />, accent: 'emerald' },
  marriageable: { icon: <FiHeart className="h-4 w-4" />, accent: 'rose' },
  volunteers: { icon: <FiUsers className="h-4 w-4" />, accent: 'lime' },
  widows: { icon: <FiUsers className="h-4 w-4" />, accent: 'slate' },
  orphans: { icon: <FiUsers className="h-4 w-4" />, accent: 'slate' },
  disabled: { icon: <FiLifeBuoy className="h-4 w-4" />, accent: 'orange' },
  elderly: { icon: <FiHeart className="h-4 w-4" />, accent: 'rose' },
  unemployed: { icon: <FiUserX className="h-4 w-4" />, accent: 'red' },
  welfare: { icon: <FiHome className="h-4 w-4" />, accent: 'emerald' },
};

const DEFAULT_REGISTER_ICON = { icon: <FiUsers className="h-4 w-4" />, accent: 'slate' as StatCardAccent };

interface PhaseAInsightsProps {
  /** Extra stat cards (e.g. dashboard totals) rendered in the same grid as the register cards. */
  children?: ReactNode;
}

/** Registers snapshot plus the survey / committee-term warnings (spec 5.3, 29). */
export default function PhaseAInsights({ children }: PhaseAInsightsProps) {
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
    // Card shows approved nikkah registrations, not the isMarriageable profile flag.
    registrationService
      .getAllNikah({ status: 'approved', limit: 1 })
      .then((result) => setApprovedNikahCount(result?.pagination?.total ?? 0))
      .catch(() => setApprovedNikahCount(0));
    // Card shows the Volunteers module's active profiles, not the isVolunteer
    // profile flag (which can be stale - set manually without a real profile).
    volunteerService
      .getSummary()
      .then((summary) => setActiveVolunteerCount(summary?.totalActiveVolunteers ?? 0))
      .catch(() => setActiveVolunteerCount(0));
  }, []);

  const COUNT_OVERRIDES: Record<string, number> = {
    marriageable: approvedNikahCount,
    volunteers: activeVolunteerCount,
  };

  const topRegisters = registers
    .map((row) => (row.key in COUNT_OVERRIDES ? { ...row, count: COUNT_OVERRIDES[row.key] } : row))
    .filter((row) => row.count > 0)
    .slice(0, 8);

  return (
    <div className="space-y-3">
      {(surveyOverdue || expiringCommittees > 0) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {surveyOverdue && (
            <Link to="/survey">
              <Card className="border-l-4 border-amber-500 p-3">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  Survey renewal overdue
                </p>
                <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
                  Generate a fresh demographic snapshot
                </p>
              </Card>
            </Link>
          )}
          {expiringCommittees > 0 && (
            <Link to="/committees">
              <Card className="border-l-4 border-red-500 p-3">
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                  {expiringCommittees} committee term(s) ending soon
                </p>
                <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
                  Schedule re-election within the next 60 days
                </p>
              </Card>
            </Link>
          )}
        </div>
      )}

      {(topRegisters.length > 0 || children) && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Community Registers</h2>
            <Link to="/registers" className="text-xs text-primary-600 hover:underline">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {topRegisters.map((row) => {
              const { icon, accent } = REGISTER_ICONS[row.key] || DEFAULT_REGISTER_ICON;
              return (
                <DashboardStatCard
                  key={row.key}
                  label={row.label}
                  value={row.count}
                  icon={icon}
                  accent={accent}
                  onClick={() => navigate(`/registers/${row.key}`)}
                />
              );
            })}
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
