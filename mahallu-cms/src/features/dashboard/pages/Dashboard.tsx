import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiActivity,
  FiAlertCircle,
  FiArrowRight,
  FiCalendar,
  FiClock,
  FiUser,
  FiUsers,
} from 'react-icons/fi';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import Card from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import CommunitySnapshot from '../components/CommunitySnapshot';
import FinanceSnapshot from '../components/FinanceSnapshot';
import { PageSkeleton } from '@/components/ui/Skeleton';
import {
  dashboardService,
  DashboardStats,
  RecentFamily,
  ActivityTimelineData,
  FinancialSummary,
} from '@/services/dashboardService';
import { ROUTES } from '@/constants/routes';
import { formatDate, toTitleCase } from '@/utils/format';
import { loadErrorInfo, LoadErrorInfo } from '@/utils/errors';
import { useChartTheme, tooltipStyle } from '@/utils/chartTheme';
export default function Dashboard() {
  const navigate = useNavigate();
  const chart = useChartTheme();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentFamilies, setRecentFamilies] = useState<RecentFamily[]>([]);
  const [activityTimeline, setActivityTimeline] = useState<ActivityTimelineData[]>([]);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<LoadErrorInfo | null>(null);
  useEffect(() => {
    fetchDashboardData();
  }, []);
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsData, familiesData, timelineData, financialData] = await Promise.all([
        dashboardService.getStats(),
        dashboardService.getRecentFamilies(5),
        dashboardService.getActivityTimeline(7),
        dashboardService.getFinancialSummary().catch(() => null),
      ]);
      setStats(statsData);
      setRecentFamilies(familiesData);
      setActivityTimeline(timelineData);
      setFinancialSummary(financialData);
    } catch (err: any) {
      setError(loadErrorInfo(err, 'the dashboard'));
    } finally {
      setLoading(false);
    }
  };
  const getInitials = (name: string | undefined) => {
    if (!name) return '—';
    const words = name.split(' ').filter(Boolean);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };
  const getTimeAgo = (dateString: string) => {
    const diffInDays = Math.floor((Date.now() - new Date(dateString).getTime()) / 86400000);
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return diffInDays + ' days ago';
    if (diffInDays < 30) return Math.floor(diffInDays / 7) + ' weeks ago';
    return formatDate(dateString);
  };
  const genderData = stats
    ? [
        { name: 'Male', value: stats.members.male },
        { name: 'Female', value: stats.members.female },
      ]
    : [];
  const totalFamilies = stats?.families.total ?? 0;
  const approvedFamilies = stats?.families.approved ?? 0;
  const pendingFamilies = stats?.families.pending ?? 0;
  const approvalPercent = totalFamilies > 0 ? Math.round((approvedFamilies / totalFamilies) * 100) : 0;
  const maxActivity = Math.max(1, ...activityTimeline.map((item) => item.value));
  const latestFamily = recentFamilies[0];
  const latestFamilyInitials = latestFamily ? getInitials(latestFamily.familyName) : '';
  if (loading) return <PageSkeleton />;
  if (error) {
    return (
      <>
        <Alert
          variant={error.variant}
          title={error.title}
          action={error.variant === 'info' ? undefined : { label: 'Try again', onClick: fetchDashboardData }}
        >
          {error.message}
        </Alert>
      </>
    );
  }
  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card padding="none" className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FiClock className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Pending approvals</h2>
                  <p className="text-xs text-muted-foreground">Work that needs a decision</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate(ROUTES.FAMILIES.LIST)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Review families <FiArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex items-center gap-5 p-4 sm:gap-8 sm:p-5">
              <div
                className="relative mx-auto flex h-32 w-32 items-center justify-center rounded-full sm:h-36 sm:w-36"
                style={{
                  background: `conic-gradient(hsl(var(--primary)) ${approvalPercent}%, hsl(var(--muted)) 0)`,
                }}
                role="img"
                aria-label={`${approvalPercent}% of families approved`}
              >
                <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-card sm:h-28 sm:w-28">
                  <span className="text-3xl font-semibold leading-none tabular-nums text-foreground">
                    {pendingFamilies}
                  </span>
                  <span className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    pending
                  </span>
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Family approvals</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {pendingFamilies > 0
                    ? `${pendingFamilies} family registration${pendingFamilies === 1 ? '' : 's'} need review.`
                    : 'All family registrations are up to date.'}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">{totalFamilies} families registered in total</p>
              </div>
            </div>
          </Card>

          <FinanceSnapshot
            summary={financialSummary}
            onViewAccounts={() => navigate(ROUTES.MAHALLU_FINANCE.ACCOUNTS)}
            onOpenDayBook={() => navigate(ROUTES.MAHALLU_FINANCE.DAY_BOOK)}
          />

          <Card padding="none" className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FiActivity className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Community pulse</h2>
                  <p className="text-xs text-muted-foreground">A quick view of your mahallu</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/reports/community')}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                View report <FiArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-4 p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {latestFamily ? (
                    <span className="text-sm font-semibold">{latestFamilyInitials}</span>
                  ) : (
                    <FiUser className="h-5 w-5" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">Latest family registration</p>
                  <p className="truncate text-sm font-semibold text-foreground">
                    {latestFamily ? toTitleCase(latestFamily.familyName) : 'No registrations yet'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {latestFamily ? getTimeAgo(latestFamily.createdAt) : 'New entries will appear here'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 divide-x divide-border rounded-lg border border-border bg-muted/30">
                <div className="px-3 py-3 text-center">
                  <p className="text-lg font-semibold tabular-nums text-foreground">{totalFamilies}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Families</p>
                </div>
                <div className="px-3 py-3 text-center">
                  <p className="text-lg font-semibold tabular-nums text-foreground">{stats?.members.total ?? 0}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">Members</p>
                </div>
              </div>
            </div>
          </Card>

          <Card padding="none" className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FiCalendar className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Registration activity</h2>
                  <p className="text-xs text-muted-foreground">New family entries over the last 7 days</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate(ROUTES.FAMILIES.LIST)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                See all <FiArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            <div className="p-4 sm:p-5">
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {activityTimeline.map((item) => {
                  const date = new Date(item.date);
                  const dateLabel = Number.isNaN(date.getTime()) ? item.name : date.toLocaleDateString('en', { weekday: 'short' });
                  const dayNumber = Number.isNaN(date.getTime()) ? '' : date.getDate();
                  const isPeak = item.value === maxActivity && item.value > 0;
                  return (
                    <div key={`${item.date}-${item.name}`} className="flex min-w-0 flex-col items-center gap-2">
                      <span className="text-[11px] font-medium text-muted-foreground">{dateLabel}</span>
                      <div className="flex h-24 w-full items-end justify-center rounded-lg bg-muted/40 p-1.5">
                        <div
                          className={isPeak ? 'w-full rounded-md bg-primary' : 'w-full rounded-md bg-primary/25'}
                          style={{ height: `${Math.max(item.value > 0 ? 18 : 5, (item.value / maxActivity) * 100)}%` }}
                          title={`${item.value} registrations`}
                        />
                      </div>
                      <span className="text-xs font-semibold tabular-nums text-foreground">{dayNumber || item.value}</span>
                    </div>
                  );
                })}
              </div>
              {activityTimeline.length === 0 && (
                <EmptyState variant="empty" entity="registration activity" className="py-4" />
              )}
            </div>
          </Card>

          <Card padding="none" className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FiAlertCircle className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Status tracker</h2>
                  <p className="text-xs text-muted-foreground">Where the community stands today</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate(ROUTES.FAMILIES.LIST)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Manage <FiArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-3 p-4 sm:p-5">
              {recentFamilies.length > 0 ? (
                <div className="divide-y divide-border">
                  {recentFamilies.slice(0, 3).map((family) => {
                    const status = family.status?.replace(/_/g, ' ') || 'pending';
                    const statusClass =
                      family.status === 'approved'
                        ? 'bg-success/10 text-success'
                        : family.status === 'rejected'
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-warning/10 text-warning';
                    return (
                      <button
                        type="button"
                        key={family.id}
                        onClick={() => navigate(`/families/${family.id}`)}
                        className="flex w-full items-center gap-3 py-3 text-left first:pt-0 last:pb-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {getInitials(family.familyName)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {toTitleCase(family.familyName)}
                          </span>
                          <span className="block text-xs text-muted-foreground">{getTimeAgo(family.createdAt)}</span>
                        </span>
                        <span className={`rounded-full px-2 py-1 text-[11px] font-medium capitalize ${statusClass}`}>
                          {status}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <EmptyState variant="empty" entity="family statuses" className="py-4" />
              )}
              <div className="flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                <FiUsers className="h-4 w-4" aria-hidden="true" />
                {stats?.members.total ?? 0} members are currently recorded in the mahallu register.
              </div>
            </div>
          </Card>
        </div>

        <CommunitySnapshot />
        <div className="grid grid-cols-1 gap-4">
          <Card>
            <div className="mb-4">
              <h2 className="text-base font-semibold text-foreground">Gender split</h2>
              <p className="text-xs text-muted-foreground">Across {stats?.members.total ?? 0} members</p>
            </div>
            {genderData.length > 0 && stats ? (
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-around">
                <div className="relative h-[200px] w-[200px] flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={genderData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {genderData.map((entry, index) => (
                          <Cell key={entry.name} fill={chart.categorical[index % chart.categorical.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle(chart)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-semibold tabular-nums text-foreground">
                      {stats.members.total}
                    </span>
                    <span className="text-xs text-muted-foreground">Members</span>
                  </div>
                </div>
                <dl className="w-full space-y-3 sm:w-auto">
                  {genderData.map((entry, index) => {
                    const percent =
                      stats.members.total > 0 ? Math.round((entry.value / stats.members.total) * 100) : 0;
                    return (
                      <div key={entry.name} className="flex items-center justify-between gap-8">
                        <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: chart.categorical[index % chart.categorical.length] }}
                            aria-hidden="true"
                          />
                          {entry.name}
                        </dt>
                        <dd className="text-right">
                          <span className="block text-sm font-semibold tabular-nums text-foreground">
                            {percent}%
                          </span>
                          <span className="block text-xs tabular-nums text-muted-foreground">
                            {entry.value} members
                          </span>
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            ) : (
              <EmptyState variant="empty" entity="member records" className="py-8" />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
