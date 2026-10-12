import { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiCheck, FiPrinter, FiSearch } from 'react-icons/fi';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import Segmented from '@/components/ui/Segmented';
import Skeleton from '@/components/ui/Skeleton';
import { collectibleService, FamilyDue } from '@/services/collectibleService';
import { familyService } from '@/services/familyService';
import { tenantService } from '@/services/tenantService';
import { Tenant } from '@/types/tenant';
import { Family } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { useDebounce } from '@/hooks/useDebounce';
import { getTenantId as extractTenantId } from '@/utils/tenantHelper';
import { exportInvoicesToPdf, InvoiceDetails } from '@/utils/invoiceUtils';
import { printReceipt } from '../receiptPrint';
import { formatINR } from '@/utils/formatINR';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { cn } from '@/utils/cn';

type PayType = 'varisangya' | 'zakat';
type Method = 'cash' | 'online' | 'bank';
type DueFilter = 'dues' | 'all';

/** One searchable family, optionally joined with its live dues. */
interface Row {
  id: string;
  houseName: string;
  head?: string;
  ward?: string;
  mahallId?: string;
  grade?: string;
  phone?: string;
  due?: number;
  monthly?: number;
}

interface SessionItem {
  key: string;
  paymentId: string;
  type: PayType;
  receiptNo: string;
  family: string;
  familyId: string;
  amount: number;
  method: Method;
  date: string;
}

const METHOD_LABEL: Record<Method, string> = { cash: 'Cash', online: 'UPI', bank: 'Bank' };
const MAX_ROWS = 30;
const UNDO_MS = 10000;

const initials = (s: string) =>
  s
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || '?';

const prefixed = (p: string, v: string) => (v.toLowerCase().startsWith(p.toLowerCase()) ? v : `${p} ${v}`);

const parseAmount = (s: string) => {
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const groupAmount = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);
const todayISO = () => new Date().toISOString().split('T')[0];

const fromFamily = (f: Family, due?: FamilyDue): Row => ({
  id: f.id,
  houseName: f.houseName,
  head: f.familyHead,
  ward: f.wardNumber,
  mahallId: (f as Family & { mahallId?: string }).mahallId,
  grade: f.varisangyaGrade,
  phone: f.contactNo,
  due: due?.dueAmount,
  monthly: due?.monthlyAmount,
});

const fromDue = (d: FamilyDue): Row => ({
  id: d.familyId,
  houseName: d.houseName,
  head: d.familyHead,
  grade: d.varisangyaGrade,
  phone: d.contactNo,
  due: d.dueAmount,
  monthly: d.monthlyAmount,
});

const kbd = 'rounded-[5px] border border-line-strong bg-white px-1.5 py-px text-[12px] dark:border-surface-border-strong dark:bg-surface-raised';
const label = 'mb-2 text-[12px] font-bold tracking-[.05em] text-[#6A7771] dark:text-surface-muted';

export default function QuickCollect() {
  const searchRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const savingRef = useRef(false);

  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 200);
  const [filter, setFilter] = useState<DueFilter>('dues');
  const [rows, setRows] = useState<Row[]>([]);
  const [searching, setSearching] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  const [duesList, setDuesList] = useState<FamilyDue[] | null>(null);
  const [duesTotal, setDuesTotal] = useState<number | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);

  const [selected, setSelected] = useState<Row | null>(null);
  const [type, setType] = useState<PayType>('varisangya');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<Method>('cash');
  const [errors, setErrors] = useState<{ family?: string; amount?: string }>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionItem[]>([]);

  const loadDues = useCallback(async () => {
    try {
      const r = await collectibleService.getFamilyDues();
      setDuesList(r.dues);
      setDuesTotal(r.summary.totalDue);
    } catch {
      setDuesList(null); // dues unavailable: numbers are simply omitted
    }
  }, []);

  useEffect(() => {
    searchRef.current?.focus();
    loadDues();
    const { currentTenantId, user } = useAuthStore.getState();
    const tid = extractTenantId(user, currentTenantId);
    if (tid) tenantService.getById(tid).then(setTenant).catch(() => undefined);
  }, [loadDues]);

  const duesMap = useMemo(() => new Map((duesList || []).map((d) => [String(d.familyId), d])), [duesList]);

  // Search: families API (name, house, mahall ID, phone) merged with the dues list (also matches family head).
  useEffect(() => {
    let cancelled = false;
    const q = debounced.trim();
    (async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const out = new Map<string, Row>();
        const lower = q.toLowerCase();
        if (q || filter === 'all') {
          const res = await familyService.getAll({ search: q || undefined, limit: MAX_ROWS, sortBy: 'mahallId' });
          (res.data || []).forEach((f) => out.set(String(f.id), fromFamily(f, duesMap.get(String(f.id)))));
        }
        if (duesList) {
          const pool = q
            ? duesList.filter((d) =>
                [d.houseName, d.familyHead, d.contactNo].some((v) => v?.toLowerCase().includes(lower))
              )
            : filter === 'dues'
              ? duesList.filter((d) => d.dueAmount > 0).slice(0, MAX_ROWS)
              : [];
          pool.forEach((d) => {
            if (!out.has(String(d.familyId))) out.set(String(d.familyId), fromDue(d));
          });
        }
        let list = Array.from(out.values());
        if (filter === 'dues' && duesList) list = list.filter((r) => (r.due ?? 0) > 0);
        list.sort((a, b) => (b.due ?? 0) - (a.due ?? 0));
        if (!cancelled) {
          setRows(list.slice(0, MAX_ROWS));
          setActive(0);
        }
      } catch (err: any) {
        if (!cancelled) setSearchError(getFriendlyError(err, "Couldn't load families. Refresh the page or try again."));
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced, filter, duesList, duesMap]);

  const gradeAmount = useMemo(() => {
    if (!selected?.grade) return 0;
    return tenant?.settings?.varisangyaGrades?.find((g) => g.name === selected.grade)?.amount || 0;
  }, [selected, tenant]);

  const chips = useMemo(() => {
    const out: { value: number; label: string }[] = [];
    const add = (value: number, lbl: string) => {
      if (value > 0 && !out.some((c) => c.value === value)) out.push({ value, label: lbl });
    };
    if (type === 'varisangya') {
      add(gradeAmount, `${formatINR(gradeAmount)} grade`);
      add(selected?.due ?? 0, `${formatINR(selected?.due ?? 0)} due`);
      add((selected?.monthly || gradeAmount) * 2, `${formatINR((selected?.monthly || gradeAmount) * 2)} · 2 months`);
    }
    [100, 500, 1000].forEach((v) => add(v, formatINR(v)));
    return out.slice(0, 6);
  }, [type, gradeAmount, selected]);

  const select = (row: Row) => {
    setSelected(row);
    setErrors({});
    setSaveError(null);
    const suggested = row.due && row.due > 0 ? row.due : row.grade ? tenant?.settings?.varisangyaGrades?.find((g) => g.name === row.grade)?.amount || 0 : 0;
    setAmount(type === 'varisangya' && suggested ? groupAmount(suggested) : '');
    setTimeout(() => amountRef.current?.select(), 0);
  };

  const onTypeChange = (t: PayType) => {
    setType(t);
    if (t === 'zakat') setAmount('');
    else if (selected) {
      const s = selected.due && selected.due > 0 ? selected.due : gradeAmount;
      setAmount(s ? groupAmount(s) : '');
    }
  };

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && rows[active]) {
      e.preventDefault();
      select(rows[active]);
    }
  };

  useEffect(() => {
    document.getElementById(`qc-row-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const buildInvoice = (s: SessionItem): InvoiceDetails => ({
    title: s.type === 'zakat' ? 'Zakat Invoice' : 'Varisangya Invoice',
    receiptNo: s.receiptNo,
    payerLabel: 'Family',
    payerName: s.family,
    amount: s.amount,
    paymentDate: s.date,
    paymentMethod: METHOD_LABEL[s.method],
    receiptRef: { type: s.type, id: s.paymentId },
  });

  const undo = async (item: SessionItem) => {
    try {
      // Receipts are never erased: undo cancels it (number kept, amounts reversed)
      await collectibleService.cancelReceipt(item.type, item.paymentId, 'Entered by mistake, undone in Quick Collect');
      setSession((s) => s.filter((x) => x.key !== item.key));
      toast.info(`Receipt ${item.receiptNo} cancelled. The number is kept and the amount is reversed.`);
      loadDues();
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't undo this receipt. Try again in a moment."));
    }
  };

  const save = async () => {
    if (savingRef.current) return;
    const value = parseAmount(amount);
    const next: { family?: string; amount?: string } = {};
    if (!selected) next.family = 'Select a family first';
    if (!(value > 0)) next.amount = 'Enter an amount greater than 0';
    setErrors(next);
    if (next.family || next.amount || !selected) {
      if (next.family) searchRef.current?.focus();
      else amountRef.current?.focus();
      return;
    }
    const { currentTenantId, user } = useAuthStore.getState();
    const tenantId = extractTenantId(user, currentTenantId);
    if (!tenantId) {
      setSaveError("We couldn't tell which mahallu this belongs to. Sign in again or choose a mahallu first.");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const base = { tenantId, amount: value, paymentDate: todayISO(), paymentMethod: method };
      const entry =
        type === 'zakat'
          ? await collectibleService.createZakat({ ...base, payerName: selected.head || selected.houseName })
          : await collectibleService.createVarisangya({ ...base, familyId: selected.id });
      const item: SessionItem = {
        key: `${entry.id || Date.now()}-${Math.random()}`,
        paymentId: entry.id || (entry as any)._id,
        type,
        receiptNo: entry.receiptNo || '-',
        family: selected.houseName,
        familyId: selected.id,
        amount: entry.amount ?? value,
        method,
        date: entry.paymentDate || base.paymentDate,
      };
      setSession((s) => [item, ...s]);
      toast.show('success', `${item.receiptNo} · ${formatINR(item.amount)} from ${item.family} saved`, {
        duration: UNDO_MS,
        action: { label: 'Undo', onClick: () => undo(item) },
      });
      setSelected(null);
      setAmount('');
      setErrors({});
      setQuery('');
      loadDues();
      searchRef.current?.focus();
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't save the receipt. Check the details and try again."));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const onPanelKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON') {
      e.preventDefault();
      save();
    }
  };

  const total = session.reduce((s, x) => s + x.amount, 0);
  const showDues = duesList !== null;

  return (
    <div className="space-y-3.5">
      <PageHeader
        title="Quick collection"
        description="Find a family, enter the amount, print the receipt. Press Enter to save."
        actions={
          <>
            <Button variant="secondary" disabled={!session.length} onClick={() => setSession([])}>
              End session
            </Button>
            <Button
              disabled={!session.length}
              onClick={() => exportInvoicesToPdf(session.slice().reverse().map(buildInvoice), 'session-receipts')}
            >
              <FiPrinter aria-hidden="true" /> Print all receipts
            </Button>
          </>
        }
      />

      <div className="flex w-fit max-w-full gap-[18px] rounded-xl border border-line bg-white px-4 py-2 dark:border-surface-border dark:bg-surface-card">
        <Stat name="Today" value={formatINR(total)} />
        <Stat name="Receipts" value={String(session.length)} />
        {showDues && duesTotal !== null && <Stat name="Dues left" value={formatINR(duesTotal)} danger />}
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 min-[900px]:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* Left: search */}
        <Card padding="none" className="overflow-hidden">
          <div className="border-b border-line p-3 dark:border-surface-border">
            <label className="flex h-[38px] items-center gap-2 rounded-[10px] border border-line-strong bg-white px-3 text-[#7B8983] focus-within:border-primary-600 focus-within:ring-4 focus-within:ring-brand-lime/[.28] dark:border-surface-border-strong dark:bg-surface-raised">
              <FiSearch className="h-[15px] w-[15px] text-primary-600 dark:text-brand-lime" aria-hidden="true" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onSearchKey}
                placeholder="Search families"
                aria-label="Search families by name, house name, mahall ID or phone"
                autoComplete="off"
                role="combobox"
                aria-expanded="true"
                aria-controls="qc-list"
                className="min-w-0 flex-1 border-0 bg-transparent !shadow-none !ring-0 focus-visible:!outline-none text-[13px] font-semibold text-[#18231E] outline-none placeholder:font-normal dark:text-surface-text"
              />
              <span className="hidden whitespace-nowrap rounded-[5px] border border-line-strong px-1.5 py-px text-[12px] sm:inline dark:border-surface-border-strong">
                Name, ID or phone
              </span>
            </label>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Segmented<DueFilter>
                size="sm"
                aria-label="Family filter"
                value={filter}
                onChange={(v) => setFilter(v)}
                options={showDues ? [{ value: 'dues', label: 'With dues' }, { value: 'all', label: 'All' }] : [{ value: 'all', label: 'All' }]}
              />
            </div>
          </div>

          {searchError ? (
            <div className="p-3">
              <Alert tone="danger" title="Search failed">{searchError}</Alert>
            </div>
          ) : searching && rows.length === 0 ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-[34px] w-[34px] rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-1/3" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title={query.trim() ? 'No matching families' : filter === 'dues' ? 'No families with dues' : 'Start typing to search'}
              description={query.trim() ? 'Try a different name, house name, mahall ID or phone number.' : 'Search by name, house name, mahall ID or phone.'}
            />
          ) : (
            <ul id="qc-list" role="listbox" aria-label="Families" className="max-h-[440px] overflow-y-auto">
              {rows.map((r, i) => {
                const on = i === active;
                const isSel = selected?.id === r.id;
                return (
                  <li
                    key={r.id}
                    id={`qc-row-${i}`}
                    role="option"
                    aria-selected={on}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => {
                      setActive(i);
                      select(r);
                    }}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 border-l-[3px] px-3.5 py-[11px]',
                      i > 0 && 'border-t border-t-line dark:border-t-surface-border',
                      on ? 'border-l-brand-lime bg-[#F1F8F4] dark:bg-brand-lime/10' : 'border-l-transparent'
                    )}
                  >
                    <span className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full bg-[#E7F1EC] text-[12px] font-extrabold text-primary-700 dark:bg-surface-raised dark:text-brand-lime">
                      {initials(r.houseName)}
                    </span>
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className={cn('truncate text-[13px] text-[#18231E] dark:text-surface-text', on || isSel ? 'font-extrabold' : 'font-bold')}>{r.houseName}</div>
                      <div className="truncate text-[12px] text-[#7B8983] dark:text-surface-muted">
                        {[r.head, r.ward && prefixed('Ward', r.ward), r.grade && prefixed('Grade', r.grade), r.mahallId].filter(Boolean).join(' · ') || r.phone || ''}
                      </div>
                    </div>
                    {showDues && r.due !== undefined && (
                      <div className="text-right">
                        <div className="text-[12px] font-bold tracking-[.05em] text-[#7B8983] dark:text-surface-muted">DUE</div>
                        <div className={cn('text-[13px] font-extrabold', r.due > 0 ? 'text-[#B3261E] dark:text-red-300' : 'text-primary-600 dark:text-brand-lime')}>
                          {formatINR(r.due)}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex gap-3.5 border-t border-line px-3.5 py-2.5 text-[12px] text-[#7B8983] dark:border-surface-border dark:text-surface-muted">
            <span><kbd className={kbd}>↑</kbd> <kbd className={kbd}>↓</kbd> move</span>
            <span><kbd className={kbd}>Enter</kbd> select</span>
          </div>
        </Card>

        {/* Right: payment */}
        <Card padding="lg" className="flex flex-col gap-3.5" onKeyDown={onPanelKey}>
          {selected ? (
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-primary-700 text-[15px] font-extrabold text-brand-lime-bright dark:bg-brand-lime dark:text-primary-950">
                {initials(selected.houseName)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-extrabold text-[#18231E] dark:text-surface-text">{selected.houseName}</div>
                <div className="truncate text-[12px] text-[#7B8983] dark:text-surface-muted">
                  {[selected.mahallId, selected.head, selected.phone].filter(Boolean).join(' · ')}
                </div>
              </div>
              {showDues && selected.due !== undefined && (
                <span className={cn('rounded-full px-2.5 py-[3px] text-[12px] font-bold', selected.due > 0 ? 'bg-[#FDECEA] text-[#B3261E] dark:bg-red-500/15 dark:text-red-300' : 'bg-mint text-primary-700 dark:bg-brand-lime/15 dark:text-brand-lime')}>
                  {selected.due > 0 ? `${formatINR(selected.due)} due` : 'No dues'}
                </span>
              )}
            </div>
          ) : (
            <div className={cn('rounded-xl border border-dashed px-3.5 py-3 text-[12.5px]', errors.family ? 'border-[#B3261E] text-[#B3261E] dark:text-red-300' : 'border-line-strong text-[#7B8983] dark:border-surface-border-strong dark:text-surface-muted')}>
              {errors.family || 'Select a family from the list to record a payment.'}
            </div>
          )}

          <div>
            <div className={label}>TYPE</div>
            <Segmented<PayType>
              aria-label="Payment type"
              value={type}
              onChange={onTypeChange}
              options={[{ value: 'varisangya', label: 'Varisangya' }, { value: 'zakat', label: 'Zakat' }]}
            />
          </div>

          <div>
            <label htmlFor="qc-amount" className={cn(label, 'block')}>AMOUNT</label>
            <div className={cn('flex h-[52px] items-center gap-1.5 rounded-xl border bg-white px-4 focus-within:ring-4 focus-within:ring-brand-lime/[.28] dark:bg-surface-raised', errors.amount ? 'border-[#B3261E]' : 'border-line-strong focus-within:border-primary-600 dark:border-surface-border-strong')}>
              <span className="text-xl font-bold text-[#7B8983]">₹</span>
              <input
                id="qc-amount"
                ref={amountRef}
                value={amount}
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                aria-invalid={!!errors.amount}
                aria-describedby={errors.amount ? 'qc-amount-err' : undefined}
                onFocus={() => setAmount((a) => a.replace(/,/g, ''))}
                onBlur={() => setAmount((a) => (parseAmount(a) > 0 ? groupAmount(parseAmount(a)) : a))}
                onChange={(e) => {
                  setAmount(e.target.value.replace(/[^0-9.]/g, ''));
                  if (errors.amount) setErrors((x) => ({ ...x, amount: undefined }));
                }}
                className="min-w-0 flex-1 border-0 bg-transparent !shadow-none !ring-0 focus-visible:!outline-none text-[28px] font-extrabold tracking-tight text-primary-700 outline-none placeholder:text-[#C5D0CA] dark:text-surface-text"
              />
            </div>
            {errors.amount && <p id="qc-amount-err" className="mt-1.5 text-xs font-medium text-[#B3261E] dark:text-red-300">{errors.amount}</p>}
            {chips.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {chips.map((c) => {
                  const on = parseAmount(amount) === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => {
                        setAmount(groupAmount(c.value));
                        setErrors((x) => ({ ...x, amount: undefined }));
                      }}
                      className={cn(
                        'rounded-full border px-3 py-[5px] text-xs transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28]',
                        on
                          ? 'border-[1.5px] border-primary-700 bg-[#F1F8F4] font-extrabold text-primary-700 dark:border-brand-lime dark:bg-brand-lime/10 dark:text-brand-lime'
                          : 'border-[#DCE5E0] font-bold text-[#3A4741] hover:bg-[#F4F7F5] dark:border-surface-border-strong dark:text-surface-text dark:hover:bg-surface-hover'
                      )}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div className={label}>METHOD</div>
            <div className="flex gap-2" role="group" aria-label="Payment method">
              {(Object.keys(METHOD_LABEL) as Method[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={method === m}
                  onClick={() => setMethod(m)}
                  className={cn(
                    'flex-1 rounded-[10px] border px-2 py-[9px] text-center text-xs transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28]',
                    method === m
                      ? 'border-[1.5px] border-primary-700 bg-[#F1F8F4] font-bold text-primary-700 dark:border-brand-lime dark:bg-brand-lime/10 dark:text-brand-lime'
                      : 'border-[#DCE5E0] font-semibold text-[#5B6963] hover:bg-[#F4F7F5] dark:border-surface-border-strong dark:text-surface-muted dark:hover:bg-surface-hover'
                  )}
                >
                  {METHOD_LABEL[m]}
                </button>
              ))}
            </div>
          </div>

          {saveError && <Alert tone="danger">{saveError}</Alert>}

          <Button size="lg" onClick={save} disabled={saving} isLoading={saving} className="h-11 w-full text-sm">
            Save receipt <span className="ml-1.5 text-[12px] font-semibold opacity-70">Enter</span>
          </Button>
        </Card>
      </div>

      <Card padding="md">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-extrabold text-[#18231E] dark:text-surface-text">This session</div>
          <span className="text-[12px] text-[#7B8983] dark:text-surface-muted">Undo a receipt within 10 seconds from the toast</span>
        </div>
        {session.length === 0 ? (
          <p className="py-2 text-xs text-[#7B8983] dark:text-surface-muted">Receipts you record in this session will appear here.</p>
        ) : (
          <div className="flex gap-2.5 overflow-x-auto pb-1" aria-label="Receipts this session">
            {session.map((s, i) => (
              <div
                key={s.key}
                className={cn(
                  'min-w-[160px] flex-none rounded-xl border px-3 py-[9px]',
                  i === 0 ? 'border-[#D3E3DA] bg-[#F1F8F4] dark:border-brand-lime/30 dark:bg-brand-lime/10' : 'border-line bg-white dark:border-surface-border dark:bg-surface-raised'
                )}
              >
                <div className="flex items-center gap-1.5 text-[12px] font-bold text-primary-600 dark:text-brand-lime">
                  <FiCheck className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                  {s.receiptNo}
                  <button
                    type="button"
                    aria-label={`Print receipt ${s.receiptNo}`}
                    onClick={() => printReceipt(buildInvoice(s))}
                    className="ml-auto rounded p-0.5 text-[#7B8983] hover:text-primary-700 dark:hover:text-brand-lime"
                  >
                    <FiPrinter className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-[3px] truncate text-[13px] font-extrabold text-[#18231E] dark:text-surface-text">{s.family}</div>
                <div className="text-[12px] text-[#7B8983] dark:text-surface-muted">
                  {formatINR(s.amount)} · {METHOD_LABEL[s.method]}{s.type === 'zakat' ? ' · Zakat' : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ name, value, danger }: { name: string; value: string; danger?: boolean }) {
  return (
    <div>
      <div className="text-[12px] font-bold tracking-[.06em] text-[#7B8983] dark:text-surface-muted">{name.toUpperCase()}</div>
      <div className={cn('text-lg font-extrabold', danger ? 'text-[#B3261E] dark:text-red-300' : 'text-primary-700 dark:text-surface-text')}>{value}</div>
    </div>
  );
}
