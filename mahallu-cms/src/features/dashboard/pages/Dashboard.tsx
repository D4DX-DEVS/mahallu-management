import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUsers, FiHome, FiInbox, FiDollarSign, FiUser } from 'react-icons/fi';
import StatCard from '@/components/ui/StatCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PageHeader from '@/components/ui/PageHeader';
import HijriDate from '@/components/HijriDate';
import Button from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';
import {
  dashboardService,
  DashboardStats,
  RecentFamily,
  ActivityTimelineData,
  FinancialSummary,
  DashboardOverview,
} from '@/services/dashboardService';
import { welfareService, WelfareSummary } from '@/services/welfareService';
import { meetingService } from '@/services/meetingService';
import { masterAccountService, LedgerItem } from '@/services/masterAccountService';
import { ROUTES } from '@/constants/routes';
import { formatINR } from '@/utils/formatINR';
import PhaseAInsights from '../components/PhaseAInsights';
import NeedsAttention from '../components/NeedsAttention';
import QuickActionsCard from '../components/QuickActionsCard';
import OnboardingChecklist from '../components/OnboardingChecklist';
import InstituteHome from '../components/InstituteHome';
import {
  IncomeExpenseCard,
  CommunityMixCard,
  WardBarsCard,
  WelfarePipelineCard,
  NextMeetingCard,
  RegistrationsCard,
  RecentActivityCard,
  NextMeeting,
  ActivityItem,
} from '../components/DashboardWidgets';
import { getFriendlyError } from '@/utils/apiMessages';
import { canReadCommittees, canReadFinancialDashboard, canReadLedger, canReadWelfare } from '@/utils/apiAccess';

const initials = (name?: string) => {
  if (!name) return 'NA';
  const w = name.split(' ').filter(Boolean);
  return (w.length >= 2 ? w[0][0] + w[1][0] : name.substring(0, 2)).toUpperCase();
};

export default function Dashboard() {
  const role = useAuthStore((s) => s.user?.role);
  if (role === 'institute') return <InstituteHome />;
  return <CommunityDashboard />;
}

function CommunityDashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((st) => st.user);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentFamilies, setRecentFamilies] = useState<RecentFamily[]>([]);
  const [timeline, setTimeline] = useState<ActivityTimelineData[]>([]);
  const [financial, setFinancial] = useState<FinancialSummary | null>(null);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [welfare, setWelfare] = useState<WelfareSummary | null>(null);
  const [nextMeeting, setNextMeeting] = useState<NextMeeting | null>(null);
  const [ledger, setLedger] = useState<{ items: LedgerItem[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Core data must load; everything else is optional per role / tenant modules.
      const [statsData, familiesData, timelineData] = await Promise.all([
        dashboardService.getStats(),
        dashboardService.getRecentFamilies(5),
        dashboardService.getActivityTimeline(7),
      ]);
      setStats(statsData);
      setRecentFamilies(familiesData);
      setTimeline(timelineData);
      setLoading(false);

      // Only ask for what the role may read (the API would answer 403 and log a console error).
      const { user: u, isSuperAdmin: sa } = useAuthStore.getState();
      const [fin, ov, wf, meetings, items] = await Promise.all([
        canReadFinancialDashboard(u?.role, sa) ? dashboardService.getFinancialSummary().catch(() => null) : null,
        canReadFinancialDashboard(u?.role, sa) ? dashboardService.getOverview().catch(() => null) : null,
        canReadWelfare(u?.role, sa) ? welfareService.getSummary().catch(() => null) : null,
        canReadCommittees(u?.role, sa) ? meetingService.getAll({ status: 'scheduled', limit: 100 }).catch(() => null) : null,
        canReadLedger(u?.role, sa) ? masterAccountService.getLedgerItems({ limit: 5 }).catch(() => null) : null,
      ]);
      setFinancial(fin);
      setOverview(ov);
      setWelfare(wf);
      setLedger(items ? { items: items.data, total: items.pagination?.total ?? items.data.length } : null);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const upcoming = (meetings?.data ?? [])
        .filter((m) => new Date(m.meetingDate) >= today)
        .sort((a, b) => +new Date(a.meetingDate) - +new Date(b.meetingDate))[0];
      setNextMeeting(
        upcoming ? { id: upcoming.id, title: upcoming.title, committee: upcoming.committeeName || (upcoming as any).committeeId?.name, date: upcoming.meetingDate } : null
      );
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load dashboard data. Refresh the page or try again."));
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-100px)] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex h-[calc(100vh-100px)] flex-col items-center justify-center">
        <p className="mb-4 text-lg text-red-600 dark:text-red-400">{error}</p>
        <Button onClick={load}>Retry</Button>
      </div>
    );
  }

  const incomeSeries = overview?.monthlyTrend.map((m) => m.income) ?? [];
  const regSeries = timeline.map((t) => t.value);

  const statCards = [
    {
      title: 'Total Families',
      value: stats.families.total.toLocaleString('en-IN'),
      icon: <FiHome />,
      tone: 'lime' as const,
      pills: [`${stats.families.approved} approved`, `${stats.families.pending} pending`],
      viz: regSeries.some((v) => v > 0) ? { type: 'bars' as const, values: regSeries } : undefined,
      summary: `Total families ${stats.families.total}, ${stats.families.approved} approved, ${stats.families.pending} pending`,
      onClick: () => navigate(ROUTES.FAMILIES.LIST),
    },
    {
      title: 'Total Members',
      value: stats.members.total.toLocaleString('en-IN'),
      icon: <FiUser />,
      tone: 'green' as const,
      pills: [`${stats.members.male} male`, `${stats.members.female} female`],
      viz: { type: 'segments' as const, segments: [{ value: stats.members.male }, { value: stats.members.female, color: '#8EC13E' }] },
      summary: `Total members ${stats.members.total}: ${stats.members.male} male, ${stats.members.female} female`,
      onClick: () => navigate(ROUTES.MEMBERS.LIST),
    },
    ...(financial
      ? [
          {
            title: 'Monthly Income',
            value: formatINR(financial.monthlyIncome),
            icon: <FiDollarSign />,
            tone: 'gold' as const,
            viz: incomeSeries.some((v) => v > 0) ? { type: 'area' as const, values: incomeSeries } : undefined,
            trend:
              financial.incomeGrowthPercent != null
                ? { value: Math.abs(financial.incomeGrowthPercent), isPositive: financial.incomeGrowthPercent >= 0, suffix: 'vs last month' }
                : undefined,
          },
          { title: 'Bank Balance', value: formatINR(financial.totalBankBalance), icon: <FiInbox />, tone: 'green' as const, pills: [`${financial.bankAccountCount} accounts`] },
        ]
      : [
          {
            title: 'Total Users',
            value: stats.users.total.toLocaleString('en-IN'),
            icon: <FiUsers />,
            tone: 'green' as const,
            pills: [`${stats.users.active} active`, `${stats.users.inactive} inactive`],
            viz: { type: 'segments' as const, segments: [{ value: stats.users.active }, { value: stats.users.inactive, color: '#FDD817' }] },
            onClick: () => navigate(ROUTES.USERS.MAHALL),
          },
        ]),
  ];

  // Merge newest family registrations and ledger entries into one feed.
  const feed: (ActivityItem & { ts: number })[] = [
    ...recentFamilies.map((f) => ({
      id: `f-${f.id}`,
      title: f.familyName,
      sub: 'Family registered',
      at: f.createdAt,
      to: `/families/${f.id}`,
      status: f.status,
      initials: initials(f.familyName),
      avatarName: f.familyName,
      ts: +new Date(f.createdAt),
    })),
    ...(ledger?.items ?? []).map((l) => ({
      id: `l-${l.id}`,
      title: l.description || 'Ledger entry',
      sub: l.type === 'income' ? 'Income recorded' : 'Expense recorded',
      at: l.date || l.createdAt,
      to: '/master-accounts/ledger-items',
      initials: l.type === 'income' ? '+' : '−',
      badge: (
        <span className={l.type === 'income' ? 'text-[12.5px] font-extrabold text-primary-600 dark:text-brand-lime' : 'text-[12.5px] font-extrabold text-[#B3261E] dark:text-red-300'}>
          {l.type === 'income' ? '+' : '−'}
          {formatINR(l.amount)}
        </span>
      ),
      ts: +new Date(l.date || l.createdAt),
    })),
  ]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 7);

  const isMahall = user?.role === 'mahall' || user?.role === 'super_admin';

  return (
    <div className="space-y-4">
      <PageHeader
        title={user?.name ? `Assalamu alaikum, ${user.name.split(' ')[0]}` : 'Dashboard'}
        description={<>Here is how your Mahallu is doing today. <HijriDate withGregorian className="font-semibold" /></>}
      />

      {isMahall && (
        <OnboardingChecklist familyCount={stats.families.total} userCount={stats.users.total} ledgerCount={ledger ? ledger.total : null} />
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <NeedsAttention pendingFamilies={stats.families.pending} />
        </div>
        <div className="space-y-4">
          <QuickActionsCard />
          <NextMeetingCard meeting={nextMeeting} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((s) => (
          <StatCard key={s.title} {...s} />
        ))}
      </div>

      {overview && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <IncomeExpenseCard trend={overview.monthlyTrend} />
          </div>
          <CommunityMixCard male={stats.members.male} female={stats.members.female} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {overview && <WardBarsCard rows={overview.varisangyaByWard} />}
        {welfare && <WelfarePipelineCard summary={welfare} />}
        <RegistrationsCard data={timeline} />
        {!overview && <CommunityMixCard male={stats.members.male} female={stats.members.female} />}
      </div>

      <RecentActivityCard items={feed} />

      <PhaseAInsights />
    </div>
  );
}
