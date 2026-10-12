import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FiCalendar, FiChevronRight } from 'react-icons/fi';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import Card from '@/components/ui/Card';
import StatusBadge from '@/components/ui/StatusBadge';
import Avatar from '@/components/ui/Avatar';
import { formatINR } from '@/utils/formatINR';
import { formatDate } from '@/utils/format';
import type { ActivityTimelineData, DashboardOverview } from '@/services/dashboardService';
import type { WelfareSummary } from '@/services/welfareService';
import { useChartTheme } from '../chartTheme';

export function WidgetCard({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card padding="lg" className={className}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-extrabold text-primary-700 dark:text-surface-text">{title}</h2>
          {subtitle && <p className="text-[12px] text-[#7B8983] dark:text-surface-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

export function EmptyChart({ message, height = 220 }: { message: string; height?: number }) {
  return (
    <div
      style={{ height }}
      className="flex items-center justify-center rounded-[10px] bg-[#F4F7F5] px-4 text-center text-[13px] text-[#7B8983] dark:bg-surface-raised dark:text-surface-muted"
    >
      {message}
    </div>
  );
}

const ViewAll = ({ to, label = 'View all' }: { to: string; label?: string }) => (
  <Link to={to} className="inline-flex items-center gap-0.5 max-sm:min-h-10 max-sm:px-1 text-xs font-bold text-primary-600 hover:underline dark:text-brand-lime">
    {label} <FiChevronRight className="h-3 w-3" />
  </Link>
);

/* ---------- Income vs expense ---------- */
export function IncomeExpenseCard({ trend }: { trend: DashboardOverview['monthlyTrend'] }) {
  const chart = useChartTheme();
  const hasData = trend.some((m) => m.income > 0 || m.expense > 0);
  return (
    <WidgetCard
      title="Income vs expense"
      subtitle="Ledger totals, last 6 months"
      className="h-full"
      action={
        <div className="flex items-center gap-3 text-[12px] font-semibold text-[#6A7771] dark:text-surface-muted">
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: chart.line }} /> Income</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: chart.gold }} /> Expense</span>
        </div>
      }
    >
      {hasData ? (
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ left: -8, right: 6, top: 6 }}>
              <defs>
                <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chart.line} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={chart.line} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chart.gold} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={chart.gold} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.grid} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: chart.tick, fontSize: 12 }} dy={8} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: chart.tick, fontSize: 12 }} tickFormatter={(v) => formatINR(v, { compact: true })} width={56} />
              <Tooltip contentStyle={chart.tooltip} formatter={(v: number, n: string) => [formatINR(v), n === 'income' ? 'Income' : 'Expense']} />
              <Area type="monotone" dataKey="income" stroke={chart.line} strokeWidth={2.5} fill="url(#gIncome)" />
              <Area type="monotone" dataKey="expense" stroke={chart.gold} strokeWidth={2.5} fill="url(#gExpense)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyChart message="No ledger entries in the last 6 months" height={240} />
      )}
    </WidgetCard>
  );
}

/* ---------- Community mix donut ---------- */
export function CommunityMixCard({ male, female }: { male: number; female: number }) {
  const chart = useChartTheme();
  const total = male + female;
  const data = [
    { name: 'Male', value: male, color: chart.dark ? '#8EC13E' : '#04563A' },
    { name: 'Female', value: female, color: '#FDD817' },
  ];
  return (
    <WidgetCard title="Community mix" subtitle="Members by gender" className="h-full">
      {total > 0 ? (
        <>
          <div className="relative h-[190px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" innerRadius={58} outerRadius={82} paddingAngle={3} stroke="none">
                  {data.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={chart.tooltip} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[22px] font-extrabold leading-none text-primary-700 dark:text-surface-text">{total.toLocaleString('en-IN')}</span>
              <span className="mt-1 text-[12px] text-[#7B8983] dark:text-surface-muted">members</span>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1 text-[12px] font-semibold text-[#4A5A52] dark:text-surface-muted">
            {data.map((d) => (
              <span key={d.name} className="flex items-center gap-1.5">
                <i className="h-2 w-2 rounded-full" style={{ background: d.color }} /> {d.name} {d.value.toLocaleString('en-IN')} ({Math.round((d.value / total) * 100)}%)
              </span>
            ))}
          </div>
        </>
      ) : (
        <EmptyChart message="No members recorded yet" height={220} />
      )}
    </WidgetCard>
  );
}

/* ---------- Varisangya by ward ---------- */
export function WardBarsCard({ rows }: { rows: DashboardOverview['varisangyaByWard'] }) {
  const max = Math.max(...rows.map((r) => r.amount), 1);
  const top = rows.slice(0, 7);
  return (
    <WidgetCard title="Varisangya by ward" subtitle="Approved collections, last 12 months" className="h-full">
      {top.length > 0 ? (
        <ul className="space-y-3">
          {top.map((r) => (
            <li key={r.ward}>
              <div className="mb-1 flex items-baseline justify-between text-[12px]">
                <span className="font-bold text-[#18231E] dark:text-surface-text">Ward {r.ward}</span>
                <span className="font-semibold text-[#4A5A52] dark:text-surface-muted">{formatINR(r.amount)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#EEF3F0] dark:bg-surface-raised">
                <div className="h-full rounded-full bg-gradient-to-r from-primary-600 to-brand-lime" style={{ width: `${Math.max((r.amount / max) * 100, 3)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyChart message="No ward-wise collections yet" height={200} />
      )}
    </WidgetCard>
  );
}

/* ---------- Welfare pipeline ---------- */
export function WelfarePipelineCard({ summary }: { summary: WelfareSummary }) {
  const stages = [
    { label: 'Pending', value: summary.pending, color: 'bg-secondary-500' },
    { label: 'Approved', value: summary.approved, color: 'bg-brand-lime' },
    { label: 'Disbursed', value: summary.disbursed, color: 'bg-primary-600 dark:bg-primary-400' },
  ];
  const max = Math.max(...stages.map((s) => s.value), 1);
  return (
    <WidgetCard title="Welfare pipeline" subtitle={`${summary.total} applications in total`} action={<ViewAll to="/welfare/applications" />} className="h-full">
      {summary.total > 0 ? (
        <>
          <ul className="space-y-3">
            {stages.map((s) => (
              <li key={s.label} className="flex items-center gap-3">
                <span className="w-[68px] text-[12px] font-bold text-[#4A5A52] dark:text-surface-muted">{s.label}</span>
                <div className="h-7 flex-1 overflow-hidden rounded-lg bg-[#EEF3F0] dark:bg-surface-raised">
                  <div className={`flex h-full items-center justify-end rounded-lg px-2 text-[12px] font-extrabold text-[#18231E] ${s.color} ${s.label === 'Disbursed' ? '!text-white' : ''}`} style={{ width: `${Math.max((s.value / max) * 100, 9)}%` }}>
                    {s.value}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {summary.disbursedAmount > 0 && (
            <p className="mt-4 rounded-[10px] bg-mint px-3 py-2 text-[12px] font-semibold text-primary-700 dark:bg-brand-lime/10 dark:text-brand-lime">
              {formatINR(summary.disbursedAmount)} disbursed so far
            </p>
          )}
        </>
      ) : (
        <EmptyChart message="No welfare applications yet" height={170} />
      )}
    </WidgetCard>
  );
}

/* ---------- Next meeting ---------- */
export interface NextMeeting {
  id: string;
  title: string;
  committee?: string;
  date: string;
}
export function NextMeetingCard({ meeting }: { meeting: NextMeeting | null }) {
  return (
    <WidgetCard title="Next meeting" action={<ViewAll to="/committees/meetings" />}>
      {meeting ? (
        <Link to={`/committees/meetings/${meeting.id}`} className="flex items-center gap-3 rounded-[10px] bg-mint p-3 transition hover:brightness-[.98] dark:bg-brand-lime/10">
          <span className="flex h-11 w-11 flex-shrink-0 flex-col items-center justify-center rounded-[10px] bg-white text-primary-700 dark:bg-surface-raised dark:text-brand-lime">
            <span className="text-[15px] font-extrabold leading-none">{formatDate(meeting.date, 'dd')}</span>
            <span className="text-[12px] font-bold uppercase">{formatDate(meeting.date, 'MMM')}</span>
          </span>
          <span className="min-w-0">
            <span className="block break-words sm:truncate text-[13px] font-bold text-[#18231E] dark:text-surface-text">{meeting.title}</span>
            <span className="block break-words sm:truncate text-[12px] text-[#6A7771] dark:text-surface-muted">
              {meeting.committee ? `${meeting.committee} · ` : ''}
              {formatDate(meeting.date, 'EEE, dd MMM yyyy')}
            </span>
          </span>
        </Link>
      ) : (
        <div className="flex items-center gap-3 rounded-[10px] bg-[#F4F7F5] px-3 py-4 text-[12.5px] text-[#7B8983] dark:bg-surface-raised dark:text-surface-muted">
          <FiCalendar className="h-4 w-4" /> No upcoming meetings scheduled
        </div>
      )}
    </WidgetCard>
  );
}

/* ---------- Family registrations (per day) ---------- */
export function RegistrationsCard({ data }: { data: ActivityTimelineData[] }) {
  const chart = useChartTheme();
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <WidgetCard title="Family registrations" subtitle="New families registered per day, last 7 days" className="h-full">
      {total > 0 ? (
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: -22, right: 4, top: 6 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chart.grid} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: chart.tick, fontSize: 12 }} dy={8} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: chart.tick, fontSize: 12 }} />
              <Tooltip cursor={{ fill: chart.dark ? 'rgba(255,255,255,0.04)' : 'rgba(11,72,55,0.05)' }} contentStyle={chart.tooltip} formatter={(v: number) => [v, 'Registrations']} />
              <Bar dataKey="value" fill={chart.line} radius={[6, 6, 0, 0]} barSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyChart message="No registrations in the last 7 days" height={220} />
      )}
    </WidgetCard>
  );
}

/* ---------- Recent activity ---------- */
export interface ActivityItem {
  id: string;
  title: string;
  sub: string;
  at: string;
  to?: string;
  status?: string;
  badge?: ReactNode;
  initials: string;
  /** When set, an Avatar (initials of this name) leads the row instead of the plain initials circle */
  avatarName?: string;
}

export function timeAgo(dateString: string) {
  const diffDays = Math.floor((Date.now() - new Date(dateString).getTime()) / 86400000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return formatDate(dateString);
}

export function RecentActivityCard({ items, title = 'Recent activity', subtitle = 'Latest registrations and ledger entries', action }: { items: ActivityItem[]; title?: string; subtitle?: string; action?: ReactNode }) {
  return (
    <WidgetCard title={title} subtitle={subtitle} action={action} className="h-full">
      {items.length > 0 ? (
        <div className="space-y-1">
          {items.map((it) => {
            const body = (
              <>
                {it.avatarName ? (
                  <Avatar name={it.avatarName} size={32} />
                ) : (
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-mint text-[12px] font-bold text-primary-700 dark:bg-brand-lime/15 dark:text-brand-lime">{it.initials}</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="break-words sm:truncate text-[12.5px] font-bold text-[#18231E] dark:text-surface-text">{it.title}</p>
                  <p className="break-words sm:truncate text-[12px] text-[#7B8983] dark:text-surface-muted">{it.sub} · {timeAgo(it.at)}</p>
                </div>
                {it.badge ?? (it.status ? <StatusBadge status={it.status} size="sm" /> : null)}
              </>
            );
            const cls = 'flex items-center gap-3 rounded-[10px] p-2 transition-colors hover:bg-[#F6FAF8] dark:hover:bg-surface-hover/60';
            return it.to ? (
              <Link key={it.id} to={it.to} className={cls}>{body}</Link>
            ) : (
              <div key={it.id} className={cls}>{body}</div>
            );
          })}
        </div>
      ) : (
        <div className="py-8 text-center text-[13px] text-[#7B8983] dark:text-surface-muted">No recent activity</div>
      )}
    </WidgetCard>
  );
}
