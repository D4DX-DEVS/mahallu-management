import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiDollarSign, FiUsers, FiTrendingUp, FiTrendingDown, FiPlusCircle, FiCreditCard, FiUserPlus, FiList } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';
import Alert from '@/components/ui/Alert';
import { useAuthStore } from '@/store/authStore';
import { instituteService } from '@/services/instituteService';
import { masterAccountService, LedgerItem, InstituteAccount } from '@/services/masterAccountService';
import { employeeService } from '@/services/employeeService';
import { salaryService } from '@/services/salaryService';
import { formatINR } from '@/utils/formatINR';
import { formatDate } from '@/utils/format';
import { RecentActivityCard, ActivityItem } from './DashboardWidgets';
import { cn } from '@/utils/cn';

interface SalaryRow {
  month: number;
  year: number;
  totalNetAmount: number;
  totalEmployees: number;
  paidCount: number;
  pendingCount: number;
}

const ACTIONS = [
  { label: 'Add ledger entry', to: '/master-accounts/ledger-items/create', icon: FiPlusCircle },
  { label: 'Record salary', to: '/salary/create', icon: FiCreditCard },
  { label: 'Add employee', to: '/employees/create', icon: FiUserPlus },
  { label: 'All ledger entries', to: '/master-accounts/ledger-items', icon: FiList },
];

/** Focused home for institute admins: their own accounts, staff and recent ledger activity. */
export default function InstituteHome() {
  const user = useAuthStore((s) => s.user);
  const instituteId = user?.instituteId;
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [accounts, setAccounts] = useState<InstituteAccount[]>([]);
  const [staffTotal, setStaffTotal] = useState(0);
  const [salary, setSalary] = useState<SalaryRow | null>(null);
  const [recent, setRecent] = useState<LedgerItem[]>([]);
  const [month, setMonth] = useState({ income: 0, expense: 0, incomeWeeks: [] as number[], expenseWeeks: [] as number[] });

  useEffect(() => {
    let cancelled = false;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    (async () => {
      const [inst, acc, emp, sal, items, monthItems] = await Promise.all([
        instituteId ? instituteService.getById(instituteId).catch(() => null) : null,
        masterAccountService.getAllInstituteAccounts({ instituteId, limit: 50 }).catch(() => null),
        employeeService.getAll({ instituteId, status: 'active', limit: 1 }).catch(() => null),
        salaryService.getSummary({ instituteId }).catch(() => null),
        masterAccountService.getLedgerItems({ instituteId, limit: 6 }).catch(() => null),
        masterAccountService.getLedgerItems({ instituteId, startDate: monthStart, limit: 500 }).catch(() => null),
      ]);
      if (cancelled) return;
      setName(inst?.name || '');
      setAccounts(acc?.data ?? []);
      setStaffTotal(emp?.pagination?.total ?? emp?.data.length ?? 0);
      setSalary((sal as SalaryRow[] | null)?.[0] ?? null);
      setRecent(items?.data ?? []);
      const rows = monthItems?.data ?? [];
      const weekly = (type: string) => {
        const buckets = [0, 0, 0, 0, 0];
        rows.filter((r) => r.type === type).forEach((r) => {
          const d = new Date(r.date || r.createdAt).getDate();
          buckets[Math.min(4, Math.floor((d - 1) / 7))] += r.amount;
        });
        return buckets.slice(0, Math.min(5, Math.floor((now.getDate() - 1) / 7) + 1));
      };
      setMonth({
        incomeWeeks: weekly('income'),
        expenseWeeks: weekly('expense'),
        income: rows.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0),
        expense: rows.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0),
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [instituteId]);

  const balance = accounts.reduce((s, a) => s + (a.balance || 0), 0);
  const activity: ActivityItem[] = recent.map((r) => ({
    id: r.id,
    title: r.description || 'Ledger entry',
    sub: `${r.type === 'income' ? 'Income' : 'Expense'}${r.paymentMethod ? ` · ${r.paymentMethod}` : ''}`,
    at: r.date || r.createdAt,
    initials: r.type === 'income' ? '+' : '−',
    badge: (
      <span className={cn('text-[12.5px] font-extrabold', r.type === 'income' ? 'text-primary-600 dark:text-brand-lime' : 'text-[#B3261E] dark:text-red-300')}>
        {r.type === 'income' ? '+' : '−'}{formatINR(r.amount)}
      </span>
    ),
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title={user?.name ? `Assalamu alaikum, ${user.name.split(' ')[0]}` : 'Home'}
        description={name ? `${name} - accounts, staff and recent entries` : 'Your institute at a glance.'}
      />

      <Card padding="lg">
        <h2 className="text-sm font-extrabold text-primary-700 dark:text-surface-text">Quick actions</h2>
        <p className="mb-3 text-[12px] text-[#7B8983] dark:text-surface-muted">Everyday institute tasks</p>
        <div className="flex flex-wrap gap-2">
          {ACTIONS.map(({ label, to, icon: Icon }) => (
            <Link key={to} to={to} className="inline-flex h-[34px] max-sm:h-10 items-center gap-1.5 rounded-[10px] bg-mint px-3.5 text-[12.5px] font-bold text-primary-700 transition-all duration-150 hover:bg-[#DCEBE3] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28] active:scale-[0.98] dark:bg-brand-lime/15 dark:text-brand-lime dark:hover:bg-brand-lime/25">
              <Icon className="h-3.5 w-3.5" /> {label}
            </Link>
          ))}
        </div>
      </Card>

      {!instituteId && <Alert tone="warning">No institute is linked to your account yet. Ask your mahall admin to assign one.</Alert>}

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[104px]" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Account balance"
            value={formatINR(balance)}
            icon={<FiDollarSign />}
            tone="green"
            pills={[`${accounts.length} account${accounts.length === 1 ? '' : 's'}`]}
            viz={accounts.filter((a) => (a.balance || 0) > 0).length >= 2 ? { type: 'ladder', values: accounts.map((a) => Math.max(a.balance || 0, 0)), color: '#04563A' } : undefined}
            summary={`Account balance ${formatINR(balance)} across ${accounts.length} accounts`}
          />
          <StatCard
            title="Income this month"
            value={formatINR(month.income)}
            icon={<FiTrendingUp />}
            tone="lime"
            viz={month.incomeWeeks.length >= 2 && month.incomeWeeks.some((v) => v > 0) ? { type: 'area', values: month.incomeWeeks } : undefined}
            summary={`Income this month ${formatINR(month.income)}, weekly trend`}
          />
          <StatCard
            title="Expense this month"
            value={formatINR(month.expense)}
            icon={<FiTrendingDown />}
            tone="gold"
            viz={month.expenseWeeks.length >= 2 && month.expenseWeeks.some((v) => v > 0) ? { type: 'step', values: month.expenseWeeks } : undefined}
            summary={`Expense this month ${formatINR(month.expense)}, weekly steps`}
          />
          <StatCard
            title="Staff"
            value={staffTotal}
            icon={<FiUsers />}
            tone="green"
            viz={salary && salary.totalEmployees > 0 ? { type: 'ring', percent: Math.round((salary.paidCount / salary.totalEmployees) * 100) } : undefined}
            summary={salary ? `Staff ${staffTotal}. Salary paid for ${salary.paidCount} of ${salary.totalEmployees} employees` : `Staff ${staffTotal}`}
            pills={salary ? [`${formatINR(salary.totalNetAmount)} salary ${formatDate(new Date(salary.year, salary.month - 1, 1), 'MMM yyyy')}`, `${salary.pendingCount} pending`] : ['No salary run yet']}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecentActivityCard
            title="Recent ledger entries"
            subtitle="Latest income and expenses"
            items={activity}
            action={<Link to="/master-accounts/ledger-items" className="inline-flex items-center max-sm:min-h-10 max-sm:px-1 text-xs font-bold text-primary-600 hover:underline dark:text-brand-lime">View all</Link>}
          />
        </div>
        <Card padding="lg">
          <h2 className="text-sm font-extrabold text-primary-700 dark:text-surface-text">Accounts</h2>
          <p className="mb-3 text-[12px] text-[#7B8983] dark:text-surface-muted">Balance per account</p>
          {accounts.length > 0 ? (
            <ul className="divide-y divide-line dark:divide-surface-border">
              {accounts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="min-w-0">
                    <span className="block break-words sm:truncate text-[12.5px] font-bold text-[#18231E] dark:text-surface-text">{a.accountName}</span>
                    {a.bankName && <span className="block break-words sm:truncate text-[12px] text-[#7B8983] dark:text-surface-muted">{a.bankName}</span>}
                  </span>
                  <span className="text-[12.5px] font-extrabold text-primary-700 dark:text-surface-text">{formatINR(a.balance || 0)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-[10px] bg-[#F4F7F5] px-3 py-6 text-center text-[13px] text-[#7B8983] dark:bg-surface-raised dark:text-surface-muted">No accounts yet</p>
          )}
        </Card>
      </div>
    </div>
  );
}
