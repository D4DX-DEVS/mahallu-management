import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUsers, FiHome, FiInbox, FiDollarSign } from 'react-icons/fi';
import { PieChart, Pie, Cell, BarChart, Bar, LabelList, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import Card from '@/components/ui/Card';
import PhaseAInsights from '../components/PhaseAInsights';
import WelcomeBanner from '../components/WelcomeBanner';
import DashboardStatCard from '../components/DashboardStatCard';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { dashboardService, DashboardStats, RecentFamily, ActivityTimelineData, FinancialSummary } from '@/services/dashboardService';
import { ROUTES } from '@/constants/routes';
import { formatDate } from '@/utils/format';

const GENDER_COLORS = ['#16a34a', '#4ade80'];

export default function Dashboard() {
  const navigate = useNavigate();
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
      setError(err.response?.data?.message || 'Failed to load dashboard data');
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string | undefined) => {
    if (!name) return 'NA';
    const words = name.split(' ').filter(word => word.length > 0);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    return formatDate(dateString);
  };

  const statCards = stats
    ? [
        {
          label: 'Total Users',
          value: stats.users.total.toString(),
          icon: <FiUsers className="h-4 w-4" />,
          accent: 'violet' as const,
          onClick: () => navigate(ROUTES.USERS.MAHALL),
        },
        {
          label: 'Total Families',
          value: stats.families.total.toString(),
          icon: <FiHome className="h-4 w-4" />,
          accent: 'emerald' as const,
          onClick: () => navigate(ROUTES.FAMILIES.LIST),
        },
        {
          label: 'Monthly Income',
          value: `₹${(financialSummary?.monthlyIncome || 0).toLocaleString()}`,
          icon: <FiDollarSign className="h-4 w-4" />,
          accent: 'amber' as const,
          trend: financialSummary?.incomeGrowthPercent != null
            ? { value: Math.abs(financialSummary.incomeGrowthPercent), isPositive: financialSummary.incomeGrowthPercent >= 0 }
            : undefined,
        },
        {
          label: 'Bank Balance',
          value: `₹${(financialSummary?.totalBankBalance || 0).toLocaleString()}`,
          icon: <FiInbox className="h-4 w-4" />,
          accent: 'indigo' as const,
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

  if (loading) {
    return (
      <PageSkeleton />
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)]">
        <p className="text-red-600 dark:text-red-400 mb-4 text-lg">{error}</p>
        <button
          onClick={fetchDashboardData}
          className="px-6 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors shadow-sm font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <WelcomeBanner />

      <PhaseAInsights>
        {statCards.map((stat, index) => (
          <DashboardStatCard key={index} {...stat} />
        ))}
      </PhaseAInsights>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Main Chart Area */}
        <Card className="lg:col-span-2 h-full">
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                        Attendance Timeline
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Weekly overview</p>
                </div>
            </div>
            <div className="h-[250px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={activityTimeline}>
                        <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#16a34a" stopOpacity={0.18}/>
                                <stop offset="95%" stopColor="#16a34a" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#9ca3af', fontSize: 12 }}
                            dy={10}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#9ca3af', fontSize: 12 }}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#fff',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                            }}
                            formatter={(value: number) => [`${value} attendances`, '']}
                            labelFormatter={(label) => label}
                        />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#16a34a"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorValue)"
                            dot={{ r: 3, fill: '#16a34a', strokeWidth: 0 }}
                            activeDot={{ r: 5, fill: '#16a34a', strokeWidth: 2, stroke: '#fff' }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </Card>

        {/* Latest Registrations / List */}
        <Card className="h-full">
          <div className="mb-4">
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                    Latest Registrations
                </h2>
             <p className="text-xs text-gray-500 dark:text-gray-400">Recent family entries</p>
            </div>
          <div className="space-y-2.5">
                {recentFamilies.length > 0 ? (
                  recentFamilies.map((family) => (
                    <div 
                      key={family.id} 
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent p-2.5 transition-colors hover:border-gray-100 hover:bg-gray-50 dark:hover:border-gray-800 dark:hover:bg-gray-800/50"
                      onClick={() => navigate(`/families/${family.id}`)}
                    >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                            {getInitials(family.familyName)}
                        </div>
                        <div className="flex-1 min-w-0">
                  <p className="truncate text-[0.82rem] font-semibold text-gray-900 dark:text-white">
                                {family.familyName}
                            </p>
                  <p className="truncate text-[0.72rem] text-gray-500 dark:text-gray-400">
                                {getTimeAgo(family.createdAt)}
                            </p>
                        </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No recent families
                  </div>
                )}
            </div>
        </Card>
      </div>

      {/* Secondary Charts Section */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="h-full">
          <div className="mb-4">
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
              Gender Distribution
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Overview of member demographics</p>
          </div>
          {genderData.length > 0 && stats ? (
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-around">
              <div className="relative h-[220px] w-[220px] flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={genderData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {genderData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={GENDER_COLORS[index % GENDER_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {stats.members.total}
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">Total Members</span>
                </div>
              </div>
              <div className="w-full space-y-4 sm:w-auto">
                {genderData.map((entry, index) => {
                  const percent =
                    stats.members.total > 0 ? Math.round((entry.value / stats.members.total) * 100) : 0;
                  return (
                    <div key={entry.name} className="flex items-center justify-between gap-8">
                      <span className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: GENDER_COLORS[index % GENDER_COLORS.length] }}
                        />
                        {entry.name}
                      </span>
                      <span className="text-right">
                        <span className="block text-sm font-bold text-gray-900 dark:text-gray-100">
                          {percent}%
                        </span>
                        <span className="block text-[11px] text-gray-400 dark:text-gray-500">
                          {entry.value} members
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              No data available
            </div>
          )}
        </Card>
        <Card className="h-full">
          <div className="mb-4">
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
              Family Status
            </h2>
             <p className="text-xs text-gray-500 dark:text-gray-400">Registration status overview</p>
          </div>
          {familyStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={familyStatusData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                  contentStyle={{ 
                    backgroundColor: '#fff',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                />
                <Bar
                  dataKey="value"
                  fill="#16a34a"
                  radius={[6, 6, 0, 0]}
                  barSize={40}
                >
                  <LabelList
                    dataKey="value"
                    position="top"
                    offset={8}
                    style={{ fill: '#374151', fontSize: 12, fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
             <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              No data available
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

