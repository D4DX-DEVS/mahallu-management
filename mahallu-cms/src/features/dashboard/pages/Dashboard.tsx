import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiHome, FiUsers, FiDollarSign, FiClock } from 'react-icons/fi';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import Card from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/layout/PageHeader';
import CommunitySnapshot from '../components/CommunitySnapshot';
import DashboardStatCard from '../components/DashboardStatCard';
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
import { loadErrorMessage } from '@/utils/errors';
import { useChartTheme, tooltipStyle } from '@/utils/chartTheme';
import { useAuthStore } from '@/store/authStore';
export default function Dashboard() {
  const navigate = useNavigate();
  const chart = useChartTheme();
  const user = useAuthStore((state) => state.user);
  const firstName = user?.name?.split(' ')[0];
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentFamilies, setRecentFamilies] = useState<RecentFamily[]>([]);
  const [activityTimeline, setActivityTimeline] = useState<ActivityTimelineData[]>([]);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      setError(loadErrorMessage(err, 'the dashboard'));
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
  /*
   *
   * Tiles lead with what a Mahall admin can act on today.
   *
   * "Total Users" — the count of admin accounts — used to be the first figure
   * on a community operations dashboard. A tile earns its place if someone
   * would click it or act on it. */
  const statCards = stats
    ? [
        {
          label: 'Families awaiting approval',
          value: stats.families.pending,
          icon: <FiClock className="h-4 w-4" />,
          hint: 'of ' + stats.families.total + ' families',
          onClick: () => navigate(ROUTES.FAMILIES.LIST),
        },
        {
          label: 'Families',
          value: stats.families.total,
          icon: <FiHome className="h-4 w-4" />,
          onClick: () => navigate(ROUTES.FAMILIES.LIST),
        },
        {
          label: 'Members',
          value: stats.members.total,
          icon: <FiUsers className="h-4 w-4" />,
          onClick: () => navigate(ROUTES.MEMBERS.LIST),
        },
        /*
         * Financial summary is only fetched successfully for roles the backend
         * grants it to (super_admin, mahall, institute) - a survey admin gets a
         * 403 that the fetch swallows into `null`. Only show the tile once real
         * data has loaded, so a role without finance access sees no tile
         * instead of a fabricated "₹0" that reads as a real, empty balance.
         */
        ...(financialSummary
          ? [
              {
                label: 'Income this month',
                value: '₹' + (financialSummary.monthlyIncome || 0).toLocaleString('en-IN'),
                icon: <FiDollarSign className="h-4 w-4" />,
                hint: 'Bank balance ₹' + (financialSummary.totalBankBalance || 0).toLocaleString('en-IN'),
                trend:
                  financialSummary.incomeGrowthPercent != null
                    ? {
                        value: Math.abs(financialSummary.incomeGrowthPercent),
                        isPositive: financialSummary.incomeGrowthPercent >= 0,
                      }
                    : undefined,
              },
            ]
          : []),
      ]
    : [];
  const genderData = stats
    ? [
        { name: 'Male', value: stats.members.male },
        { name: 'Female', value: stats.members.female },
      ]
    : [];
  const familyStatusData = stats
    ? [
        { name: 'Approved', value: stats.families.approved },
        { name: 'Pending', value: stats.families.pending },
        { name: 'Unapproved', value: stats.families.unapproved },
      ]
    : [];
  if (loading) return <PageSkeleton />;
  if (error) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <Alert
          variant="error"
          title="Couldn't load the dashboard"
          action={{ label: 'Try again', onClick: fetchDashboardData }}
        >
          {error}
        </Alert>
      </>
    );
  }
  // Hierarchical overview: awaiting approval is the actionable hero, others are quiet totals.
  const pendingStat = statCards.find((s) => s.label === 'Families awaiting approval');
  const otherStats = statCards.filter((s) => s.label !== 'Families awaiting approval');

  return (
    <>
      <div className="border-b border-border/60 bg-card/50">
        <div className="mx-auto max-w-content px-3 py-3 sm:px-0 sm:py-4">
          <PageHeader
            title={firstName ? `Welcome back, ${firstName}` : 'Dashboard'}
            description="What needs your attention across the mahallu today."
          />
        </div>
      </div>
      <div className="space-y-4 py-3 sm:py-4">
        {/* OVERVIEW — four equal-sized cards, not a hero + siblings */}
        {statCards.length > 0 && (
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {pendingStat && (
              <div className="flex min-h-[136px] flex-col justify-between rounded-xl bg-amber-500/10 p-3.5 ring-1 ring-amber-500/20">
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                    <FiClock className="h-3.5 w-3.5" aria-hidden="true" /> Needs attention
                  </p>
                  <p className="mt-1.5 text-2xl font-bold tracking-tight text-foreground tabular-nums">{pendingStat.value}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{pendingStat.label} — {pendingStat.hint}</p>
                </div>
                <button
                  type="button"
                  onClick={pendingStat.onClick}
                  className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
                >
                  Review families <span aria-hidden="true">→</span>
                </button>
              </div>
            )}
            {otherStats.map((stat) => (
              <div
                key={stat.label}
                className="flex min-h-[136px] flex-col justify-between rounded-xl border border-border bg-card p-3.5"
              >
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-muted text-muted-foreground">{stat.icon}</span>
                    {stat.label}
                  </p>
                  <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{stat.value}</p>
                </div>
                <div>
                  {stat.hint && <p className="truncate text-xs tabular-nums text-muted-foreground">{stat.hint}</p>}
                  {stat.trend && (
                    <p className={`mt-0.5 inline-flex items-center gap-1 text-xs font-medium tabular-nums ${stat.trend.isPositive ? 'text-success' : 'text-destructive'}`}>
                      <span aria-hidden="true">{stat.trend.isPositive ? '↑' : '↓'}</span> {stat.trend.value}% vs last month
                    </p>
                  )}
                </div>
              </div>
            ))}
          </section>
        )}

        <CommunitySnapshot>{null}</CommunitySnapshot>
        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-5">
          <div className="flex h-full flex-col rounded-xl border border-border bg-card p-3 sm:p-3.5 lg:col-span-3 lg:min-h-[230px]">
            <div className="mb-2.5 flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">New registrations</h2>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground">Last 7 days</span>
            </div>
            {activityTimeline.every((d) => d.value === 0) ? (
              <div className="flex min-h-[120px] flex-1 items-center justify-center rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground">No registrations this week</p>
              </div>
            ) : (
              <div className="min-h-[120px] w-full flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activityTimeline}>
                    <defs>
                      <linearGradient id="registrationsFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chart.primary} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={chart.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.grid} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: chart.axis, fontSize: 11 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: chart.axis, fontSize: 11 }} allowDecimals={false} width={28} />
                    <Tooltip contentStyle={tooltipStyle(chart)} formatter={(value: number) => [value + (value === 1 ? ' registration' : ' registrations'), '']} />
                    <Area type="monotone" dataKey="value" stroke={chart.primary} strokeWidth={2} fillOpacity={1} fill="url(#registrationsFill)" dot={{ r: 3, fill: chart.primary, strokeWidth: 0 }} activeDot={{ r: 5, fill: chart.primary, strokeWidth: 2, stroke: chart.tooltipBg }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <div className="flex h-full flex-col rounded-xl border border-border bg-card p-3 sm:p-3.5 lg:col-span-2 lg:min-h-[230px]">
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Latest registrations</h2>
              <span className="text-xs tabular-nums text-muted-foreground">{recentFamilies.length} recent</span>
            </div>
            {recentFamilies.length > 0 ? (
              <div className="flex-1 divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60">
                {recentFamilies.map((family) => (
                  <button
                    key={family.id}
                    type="button"
                    onClick={() => navigate('/families/' + family.id)}
                    className="flex w-full items-center gap-3 px-3 py-1.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary" aria-hidden="true">
                      {getInitials(family.familyName)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{toTitleCase(family.familyName)}</span>
                      <span className="block truncate text-xs text-muted-foreground">{getTimeAgo(family.createdAt)}</span>
                    </span>
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center text-muted-foreground" aria-hidden="true">→</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex min-h-[100px] flex-1 items-center justify-center rounded-lg border border-dashed border-border text-center">
                <p className="text-sm text-muted-foreground">No recent families</p>
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 items-stretch gap-3 xl:grid-cols-2">
          <Card className="flex h-full flex-col xl:min-h-[240px]">
            <div className="mb-2.5">
              <h2 className="text-base font-semibold text-foreground">Gender split</h2>
              <p className="text-xs text-muted-foreground">Across {stats?.members.total ?? 0} members</p>
            </div>
            {genderData.length > 0 && stats ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 sm:flex-row sm:justify-around">
                <div className="relative h-[150px] w-[150px] flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={genderData}
                        cx="50%"
                        cy="50%"
                        innerRadius={42}
                        outerRadius={60}
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
              <EmptyState variant="empty" entity="member records" className="flex-1 py-8" />
            )}
          </Card>
          <Card className="flex h-full flex-col xl:min-h-[240px]">
            <div className="mb-2.5">
              <h2 className="text-base font-semibold text-foreground">Family status</h2>
              <p className="text-xs text-muted-foreground">Registration status across all families</p>
            </div>
            {familyStatusData.length > 0 ? (
              <div className="min-h-[150px] flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={familyStatusData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.grid} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: chart.axis, fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: chart.axis, fontSize: 12 }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ fill: chart.grid, fillOpacity: 0.3 }}
                    contentStyle={tooltipStyle(chart)}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                    {familyStatusData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={
                          entry.name === 'Approved'
                            ? chart.success
                            : entry.name === 'Pending'
                              ? chart.warning
                              : chart.destructive
                        }
                      />
                    ))}
                    <LabelList
                      dataKey="value"
                      position="top"
                      offset={8}
                      style={{ fill: chart.label, fontSize: 12, fontWeight: 600 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState variant="empty" entity="families" className="flex-1 py-8" />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
