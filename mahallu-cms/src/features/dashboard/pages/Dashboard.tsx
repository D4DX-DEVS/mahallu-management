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
import { formatDate } from '@/utils/format';
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
        {
          label: 'Income this month',
          value: '₹' + (financialSummary?.monthlyIncome || 0).toLocaleString('en-IN'),
          icon: <FiDollarSign className="h-4 w-4" />,
          hint: financialSummary
            ? 'Bank balance ₹' + (financialSummary.totalBankBalance || 0).toLocaleString('en-IN')
            : undefined,
          trend:
            financialSummary?.incomeGrowthPercent != null
              ? {
                  value: Math.abs(financialSummary.incomeGrowthPercent),
                  isPositive: financialSummary.incomeGrowthPercent >= 0,
                }
              : undefined,
        },
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
  return (
    <>
      <PageHeader
        title={firstName ? 'Welcome back, ' + firstName : 'Dashboard'}
        description="What needs your attention across the mahallu today."
      />
      <div className="space-y-4">
        <CommunitySnapshot>
          {statCards.map((stat) => (
            <DashboardStatCard key={stat.label} {...stat} />
          ))}
        </CommunitySnapshot>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-foreground">New registrations</h2>
              <p className="text-xs text-muted-foreground">Family registrations, last 7 days</p>
            </div>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activityTimeline}>
                  <defs>
                    <linearGradient id="registrationsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chart.primary} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={chart.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
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
                    contentStyle={tooltipStyle(chart)}
                    formatter={(value: number) => [
                      value + (value === 1 ? ' registration' : ' registrations'),
                      '',
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={chart.primary}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#registrationsFill)"
                    dot={{ r: 3, fill: chart.primary, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: chart.primary, strokeWidth: 2, stroke: chart.tooltipBg }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card>
            <div className="mb-4">
              <h2 className="text-base font-semibold text-foreground">Latest registrations</h2>
              <p className="text-xs text-muted-foreground">Recent family entries</p>
            </div>
            {recentFamilies.length > 0 ? (
              <ul className="space-y-1">
                {recentFamilies.map((family) => (
                  <li key={family.id}>
                    <button
                      type="button"
                      onClick={() => navigate('/families/' + family.id)}
                      className="flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
                        aria-hidden="true"
                      >
                        {getInitials(family.familyName)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {family.familyName}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {getTimeAgo(family.createdAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState variant="empty" entity="families" className="py-8" />
            )}
          </Card>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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
          <Card>
            <div className="mb-4">
              <h2 className="text-base font-semibold text-foreground">Family status</h2>
              <p className="text-xs text-muted-foreground">Registration status across all families</p>
            </div>
            {familyStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
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
            ) : (
              <EmptyState variant="empty" entity="families" className="py-8" />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
