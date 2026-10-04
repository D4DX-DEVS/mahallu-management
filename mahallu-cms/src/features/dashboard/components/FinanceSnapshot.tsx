import { FiArrowDownRight, FiArrowRight, FiArrowUpRight, FiCreditCard, FiPlus } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { FinancialSummary } from '@/services/dashboardService';

interface FinanceSnapshotProps {
  summary: FinancialSummary | null;
  onViewAccounts: () => void;
  onOpenDayBook: () => void;
}

const money = (value: number) => `₹${value.toLocaleString('en-IN')}`;

export default function FinanceSnapshot({ summary, onViewAccounts, onOpenDayBook }: FinanceSnapshotProps) {
  const income = summary?.monthlyIncome ?? 0;
  const expense = summary?.monthlyExpense ?? 0;
  const net = summary?.monthlyNet ?? income - expense;
  const totalFlow = income + expense;
  const incomeWidth = totalFlow > 0 ? Math.round((income / totalFlow) * 100) : 0;
  const growth = summary?.incomeGrowthPercent;

  if (!summary) {
    return (
      <Card padding="none" className="overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3 sm:px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FiCreditCard className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Finance overview</h2>
            <p className="text-xs text-muted-foreground">Accounts and this month&apos;s cash flow</p>
          </div>
        </div>
        <p className="px-4 py-6 text-sm text-muted-foreground sm:px-5">Finance data is unavailable for this workspace.</p>
      </Card>
    );
  }

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FiCreditCard className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Finance overview</h2>
            <p className="text-xs text-muted-foreground">Accounts and this month&apos;s cash flow</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onOpenDayBook} icon={<FiPlus />} collapseLabel>
            Add transaction
          </Button>
          <button
            type="button"
            onClick={onViewAccounts}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            View accounts <FiArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
        <Card padding="sm" className="rounded-lg shadow-none">
          <p className="text-xs text-muted-foreground">Available balance</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
            {money(summary.totalBankBalance)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {`${summary.bankAccountCount} active account${summary.bankAccountCount === 1 ? '' : 's'}`}
          </p>
        </Card>
        <Card padding="sm" className="rounded-lg shadow-none">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Income</p>
            {growth !== null && growth !== undefined && (
              <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${growth >= 0 ? 'text-success' : 'text-destructive'}`}>
                {growth >= 0 ? <FiArrowUpRight className="h-3 w-3" aria-hidden="true" /> : <FiArrowDownRight className="h-3 w-3" aria-hidden="true" />} {Math.abs(growth)}%
              </span>
            )}
          </div>
          <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{money(income)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">This month</p>
        </Card>
        <Card padding="sm" className="rounded-lg shadow-none">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Net cash flow</p>
            <span className={net >= 0 ? 'text-success' : 'text-destructive'}>
              {net >= 0 ? <FiArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /> : <FiArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />}
            </span>
          </div>
          <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{money(net)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">After {money(expense)} expenses</p>
        </Card>
      </div>

      <div className="border-t border-border px-4 py-4 sm:px-5">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-medium text-foreground">Monthly cash flow</span>
          <span className="tabular-nums text-muted-foreground">{summary.transactionCount} transactions</span>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-label="Income and expense comparison">
          <div className="bg-primary" style={{ width: `${incomeWidth}%` }} />
          <div className="bg-warning" style={{ width: `${totalFlow > 0 ? 100 - incomeWidth : 0}%` }} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" /> Income {money(income)}</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-warning" /> Expenses {money(expense)}</span>
        </div>
      </div>
    </Card>
  );
}
