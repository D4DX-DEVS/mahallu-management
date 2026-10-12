import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiTrash2, FiDownload } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import AmountInput from '@/components/ui/AmountInput';
import Select from '@/components/ui/Select';
import Tabs from '@/components/ui/Tabs';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import StatCard from '@/components/ui/StatCard';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import StatusBadge from '@/components/ui/StatusBadge';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { formatINR } from '@/utils/formatINR';
import { masterAccountService } from '@/services/masterAccountService';
import {
  budgetService,
  periodService,
  Budget,
  BudgetLine,
  BudgetVsActual,
  BudgetVsActualLine,
  FinancialPeriod,
} from '@/services/financialService';
import ScrollX from '@/features/_shared/ScrollX';

type Tab = 'plan' | 'actual';
type LedgerOption = { id: string; name: string; type?: string };

const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '');

/** Bar for one line: filled share of the budget, gold marker where the year-to-date pace sits. */
function PaceBar({ line, elapsed }: { line: BudgetVsActualLine; elapsed: number }) {
  const used = line.percentUsed ?? (line.actual > 0 ? 100 : 0);
  const fill = Math.min(100, used);
  const colour = line.favourable ? 'bg-[#04563A] dark:bg-brand-lime' : 'bg-[#B3261E]';
  return (
    <div
      role="img"
      aria-label={`${line.name}: ${formatINR(line.actual)} of ${formatINR(line.budget)} budget, ${Math.round(used)} percent`}
      className="relative h-2.5 w-full min-w-[110px] rounded-full bg-[#E7EEEA] dark:bg-[#2B342F]"
    >
      <span className={`absolute left-0 top-0 h-full rounded-full ${colour}`} style={{ width: `${fill}%` }} />
      <span className="absolute -top-1 h-[18px] w-[3px] rounded-full bg-[#FDD817]" style={{ left: `calc(${Math.min(100, elapsed)}% - 1px)` }} />
    </div>
  );
}

function VarianceBadge({ line }: { line: BudgetVsActualLine }) {
  const label =
    line.type === 'expense'
      ? line.status === 'over' ? 'Over budget' : line.status === 'under' ? 'Under budget' : 'On track'
      : line.status === 'under' ? 'Behind target' : line.status === 'over' ? 'Ahead of target' : 'On track';
  return <Badge variant={line.favourable ? (line.status === 'on-track' ? 'neutral' : 'success') : 'danger'} dot size="sm">{label}</Badge>;
}

export default function MahalluBudgets() {
  const [periods, setPeriods] = useState<FinancialPeriod[]>([]);
  const [periodId, setPeriodId] = useState('');
  const [ledgers, setLedgers] = useState<LedgerOption[]>([]);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [vs, setVs] = useState<BudgetVsActual | null>(null);
  const [tab, setTab] = useState<Tab>('plan');
  const [loading, setLoading] = useState(true);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [ps, ls] = await Promise.all([
          periodService.list(),
          masterAccountService.getAllLedgers({ limit: 200 }).then((r) => r.data as unknown as LedgerOption[]).catch(() => []),
        ]);
        setPeriods(ps);
        setLedgers(ls);
        // Prefer the open year that contains today, else the most recent
        const today = Date.now();
        const current = ps.find((p) => new Date(p.startDate).getTime() <= today && new Date(p.endDate).getTime() >= today) || ps[0];
        if (current) setPeriodId(current.id);
      } catch (err: any) {
        setError(getFriendlyError(err, "We couldn't load your financial years. Try again in a moment."));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadBudget = useCallback(async (id: string) => {
    if (!id) return;
    try {
      setBudgetLoading(true);
      const list = await budgetService.list(id);
      const b = list[0] || null;
      setBudget(b);
      setLines(b ? b.lines : []);
      setDirty(false);
      setVs(b ? await budgetService.vsActual(b.id) : null);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "We couldn't load this budget. Try again in a moment."));
    } finally {
      setBudgetLoading(false);
    }
  }, []);

  useEffect(() => {
    if (periodId) loadBudget(periodId);
  }, [periodId, loadBudget]);

  const period = periods.find((p) => p.id === periodId);
  const totals = useMemo(() => {
    const sum = (t: 'income' | 'expense') => lines.filter((l) => l.type === t).reduce((s, l) => s + (Number(l.amount) || 0), 0);
    const income = sum('income');
    const expense = sum('expense');
    return { income, expense, net: income - expense };
  }, [lines]);

  const update = (index: number, patch: Partial<BudgetLine>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
    setDirty(true);
  };
  const remove = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  };
  const add = (type: 'income' | 'expense') => {
    setLines((prev) => [...prev, { name: '', type, amount: 0 }]);
    setDirty(true);
  };

  const pickLedger = (index: number, ledgerId: string) => {
    const l = ledgers.find((x) => x.id === ledgerId);
    update(index, l ? { ledgerId: l.id, name: lines[index].name || l.name } : { ledgerId: undefined });
  };

  const importLastYear = async () => {
    if (!periodId) return;
    try {
      setImporting(true);
      const prior = await budgetService.priorActuals(periodId);
      const have = new Set(lines.filter((l) => l.ledgerId).map((l) => `${l.ledgerId}:${l.type}`));
      const fresh = prior.lines.filter((l) => !have.has(`${l.ledgerId}:${l.type}`));
      setLines((prev) => [...prev, ...fresh.map((l) => ({ ledgerId: l.ledgerId, name: l.name, type: l.type, amount: l.amount }))]);
      setDirty(true);
      toast.success(fresh.length ? `Added ${fresh.length} line(s) from ${prior.fromPeriod.name} actuals. Adjust them, then save.` : `Everything from ${prior.fromPeriod.name} is already in your budget.`);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "We couldn't import last year's actuals. Try again in a moment."));
    } finally {
      setImporting(false);
    }
  };

  const save = async (status?: 'draft' | 'approved') => {
    if (lines.some((l) => !l.name.trim())) {
      toast.error('Give every budget line a name to continue');
      return;
    }
    const payload = lines.map((l) => ({ ledgerId: l.ledgerId, categoryId: l.categoryId, name: l.name.trim(), type: l.type, amount: Number(l.amount) || 0 }));
    try {
      setSaving(true);
      const saved = budget
        ? await budgetService.update(budget.id, { lines: payload, ...(status ? { status } : {}) })
        : await budgetService.create({ periodId, lines: payload });
      toast.success(status === 'approved' ? 'Budget approved' : 'Budget saved');
      setBudget(saved);
      setLines(saved.lines);
      setDirty(false);
      setVs(await budgetService.vsActual(saved.id));
    } catch (err: any) {
      toast.error(getFriendlyError(err, "We couldn't save this budget. Try again in a moment."));
    } finally {
      setSaving(false);
    }
  };

  const ledgerOptions = (type: 'income' | 'expense') => [
    { value: '', label: 'Custom line (no ledger)' },
    ...ledgers.filter((l) => !l.type || l.type === type).map((l) => ({ value: l.id, label: l.name })),
  ];

  const renderEditor = (type: 'income' | 'expense') => {
    const rows = lines.map((l, i) => ({ l, i })).filter((x) => x.l.type === type);
    return (
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">{type === 'income' ? 'Expected income' : 'Planned spending'}</h2>
          <span className="text-sm font-semibold tabular-nums">{formatINR(type === 'income' ? totals.income : totals.expense)}</span>
        </div>
        {rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-[#7B8983] dark:text-surface-muted">No {type} lines yet.</p>
        ) : (
          <div className="space-y-2.5">
            {rows.map(({ l, i }) => (
              <div key={i} className="grid grid-cols-1 gap-2 rounded-xl border border-line p-2.5 dark:border-surface-border sm:grid-cols-[1.2fr_1.2fr_140px_auto] sm:items-end">
                <Select
                  label="Ledger"
                  value={l.ledgerId || ''}
                  onChange={(e) => pickLedger(i, e.target.value)}
                  options={ledgerOptions(type)}
                />
                <Input label="Line name" value={l.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="For example: Madrasa teachers" />
                <AmountInput label="Budget" value={l.amount} onChange={(e) => update(i, { amount: Number(e.target.value) || 0 })} />
                <Button variant="ghost" iconOnly aria-label={`Remove ${l.name || 'line'}`} onClick={() => remove(i)}>
                  <FiTrash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <Button variant="soft" size="sm" className="mt-3" onClick={() => add(type)}>
          <FiPlus className="h-3.5 w-3.5" /> Add {type} line
        </Button>
      </Card>
    );
  };

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;

  if (error) {
    return <Card><p className="text-red-600 dark:text-red-400">{error}</p></Card>;
  }

  if (periods.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader title="Budget" description="Plan the year, then track spending against it" />
        <Card>
          <EmptyState
            title="Create a financial year first"
            description="A budget belongs to a financial year, so add one before you plan it."
            action={{ label: 'Go to financial years', onClick: () => { window.location.assign('/mahallu-finance/periods'); } }}
          />
        </Card>
      </div>
    );
  }

  const elapsed = vs?.elapsedPercent ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Budget"
        description="Plan the year, then track spending against it"
        actions={
          <>
            <div className="w-52">
              <Select
                aria-label="Financial year"
                value={periodId}
                onChange={(e) => setPeriodId(e.target.value)}
                options={periods.map((p) => ({ value: p.id, label: p.name }))}
              />
            </div>
            <Link to="/mahallu-finance/periods"><Button variant="secondary">Financial years</Button></Link>
          </>
        }
      />

      {period && (
        <p className="-mt-2 text-xs text-[#7B8983] dark:text-surface-muted">
          {fmtDate(period.startDate)} to {fmtDate(period.endDate)} {budget && <StatusBadge status={budget.status} />}
        </p>
      )}

      <Tabs<Tab>
        aria-label="Budget views"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'plan', label: 'Plan' },
          { value: 'actual', label: 'Budget vs actual', disabled: !budget },
        ]}
      />

      {budgetLoading ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : tab === 'plan' ? (
        <div className="space-y-4">
          {!budget && lines.length === 0 && (
            <Alert tone="info" title="No budget for this year yet">
              Start with last year's actual figures and adjust them, or add lines by hand.
            </Alert>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={importLastYear} disabled={importing}>
              <FiDownload className="h-3.5 w-3.5" /> {importing ? 'Importing...' : "Import last year's actuals"}
            </Button>
          </div>
          {renderEditor('income')}
          {renderEditor('expense')}

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[#3A4741] dark:text-surface-text">
                Planned surplus: <strong className={totals.net < 0 ? 'text-[#B3261E]' : ''}>{formatINR(totals.net)}</strong>
                <span className="text-[#7B8983] dark:text-surface-muted"> ({formatINR(totals.income)} income, {formatINR(totals.expense)} spending)</span>
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => save()} disabled={saving || (!dirty && !!budget)}>
                  {saving ? 'Saving...' : 'Save budget'}
                </Button>
                {budget && budget.status !== 'approved' && (
                  <Button onClick={() => save('approved')} disabled={saving || dirty}>Approve budget</Button>
                )}
              </div>
            </div>
            {dirty && budget && <p className="mt-2 text-xs text-[#7A5B00]">You have unsaved changes. Save before approving.</p>}
          </Card>
        </div>
      ) : vs ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StatCard
              variant="tile"
              tone="green"
              title="Income so far"
              value={formatINR(vs.summary.incomeActual)}
              viz={vs.summary.incomeBudget > 0 ? { type: 'bullet', percent: Math.min(100, (vs.summary.incomeActual / vs.summary.incomeBudget) * 100), target: vs.elapsedPercent } : undefined}
              summary={`Income ${formatINR(vs.summary.incomeActual)} of ${formatINR(vs.summary.incomeBudget)} budgeted`}
              pills={[`Budget ${formatINR(vs.summary.incomeBudget)}`]}
            />
            <StatCard
              variant="tile"
              tone="gold"
              title="Spending so far"
              value={formatINR(vs.summary.expenseActual)}
              viz={vs.summary.expenseBudget > 0 ? { type: 'bullet', percent: Math.min(100, (vs.summary.expenseActual / vs.summary.expenseBudget) * 100), target: vs.elapsedPercent, color: vs.summary.expenseActual > vs.summary.expenseBudget ? '#B3261E' : undefined } : undefined}
              summary={`Spending ${formatINR(vs.summary.expenseActual)} of ${formatINR(vs.summary.expenseBudget)} budgeted`}
              pills={[`Budget ${formatINR(vs.summary.expenseBudget)}`]}
            />
          </div>
          <p className="text-xs text-[#7B8983] dark:text-surface-muted">
            The gold marker shows how far through the year we are ({Math.round(elapsed)}%). A bar past the marker means ahead of the pace the budget implies.
          </p>

          <Card padding="none">
            <ScrollX>
              <table className="w-full text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-line text-[12px] uppercase tracking-[0.05em] text-[#6A7771] dark:border-surface-border dark:text-surface-muted">
                    <th className="px-3.5 py-2.5 font-bold">Line</th>
                    <th className="px-3.5 py-2.5 text-right font-bold">Budget</th>
                    <th className="px-3.5 py-2.5 text-right font-bold">Actual</th>
                    <th className="px-3.5 py-2.5 font-bold">Progress</th>
                    <th className="px-3.5 py-2.5 text-right font-bold">Variance</th>
                    <th className="px-3.5 py-2.5 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {vs.lines.map((l, i) => (
                    <tr key={l.id ?? i} className="border-b border-line last:border-0 dark:border-surface-border">
                      <td className="px-3.5 py-2.5">
                        <span className="font-semibold text-[#18231E] dark:text-surface-text">{l.name}</span>
                        <span className="ml-1.5 text-[12px] text-[#98A59F]">{l.type}</span>
                      </td>
                      <td className="px-3.5 py-2.5 text-right tabular-nums">{formatINR(l.budget)}</td>
                      <td className="px-3.5 py-2.5 text-right tabular-nums">{formatINR(l.actual)}</td>
                      <td className="px-3.5 py-2.5"><PaceBar line={l} elapsed={elapsed} /></td>
                      <td className="px-3.5 py-2.5 text-right tabular-nums">
                        {l.variance > 0 ? '+' : ''}{formatINR(l.variance)}
                        {l.variancePct !== null && <span className="ml-1 text-[12px] text-[#7B8983]">({l.variancePct > 0 ? '+' : ''}{Math.round(l.variancePct)}%)</span>}
                      </td>
                      <td className="px-3.5 py-2.5"><VarianceBadge line={l} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollX>
          </Card>

          {vs.unbudgeted.length > 0 && (
            <Alert tone="warning" title="Activity with no budget line">
              {vs.unbudgeted.map((u) => `${u.name}: ${formatINR(u.actual)} ${u.type}`).join(' / ')}. Add a line for these in the Plan tab.
            </Alert>
          )}
        </div>
      ) : null}
    </div>
  );
}
