import { useState, useEffect } from 'react';
import { FiDollarSign, FiTrendingDown } from 'react-icons/fi';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import Avatar from '@/components/ui/Avatar';
import StatCard from '@/components/ui/StatCard';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { pettyCashService, PettyCashFund, PettyCashTransaction } from '@/services/pettyCashService';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { pct } from '@/utils/statSeries';
import ScrollX from '@/features/_shared/ScrollX';

export default function PettyCashDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [fund, setFund] = useState<PettyCashFund | null>(null);
  const [transactions, setTransactions] = useState<PettyCashTransaction[]>([]);
  const [showExpense, setShowExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ amount: '', description: '', receiptNo: '', date: new Date().toISOString().split('T')[0] });
  const [saving, setSaving] = useState(false);
  const [replenishing, setReplenishing] = useState(false);
  const [showReplenishDialog, setShowReplenishDialog] = useState(false);

  useEffect(() => {
    if (id) {
      fetchFund();
      fetchTransactions();
    }
  }, [id]);

  const fetchFund = async () => {
    try {
      setLoading(true);
      const data = await pettyCashService.getById(id!);
      setFund(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const data = await pettyCashService.getTransactions(id!);
      setTransactions(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRecordExpense = async () => {
    if (!expenseForm.amount || !expenseForm.description) return;
    try {
      setSaving(true);
      await pettyCashService.recordExpense(id!, {
        amount: Number(expenseForm.amount),
        description: expenseForm.description,
        receiptNo: expenseForm.receiptNo || undefined,
        date: expenseForm.date,
      });
      toast.success('Expense recorded');
      setShowExpense(false);
      setExpenseForm({ amount: '', description: '', receiptNo: '', date: new Date().toISOString().split('T')[0] });
      fetchFund();
      fetchTransactions();
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't record expense. Try again in a moment."));
    } finally {
      setSaving(false);
    }
  };

  const handleReplenish = () => {
    setShowReplenishDialog(true);
  };

  const confirmReplenish = async () => {
    try {
      setReplenishing(true);
      const result = await pettyCashService.replenish(id!);
      toast.success(result.message || 'Petty cash replenished');
      setShowReplenishDialog(false);
      fetchFund();
      fetchTransactions();
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't replenish petty cash. Try again in a moment."));
      setReplenishing(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><LoadingSpinner /></div>;
  }

  if (!fund) {
    return (
      <div className="py-12 text-center">
        <p className="text-[13px] text-[#7B8983] dark:text-surface-muted">Petty cash fund not found</p>
        <Button onClick={() => navigate('/petty-cash')} className="mt-4">Back to List</Button>
      </div>
    );
  }

  const spent = fund.floatAmount - fund.currentBalance;
  const instituteName = typeof fund.instituteId === 'object' ? fund.instituteId?.name : '';

  const typeVariants: Record<string, 'info' | 'danger' | 'success'> = {
    float: 'info',
    expense: 'danger',
    replenishment: 'success',
  };

  return (
    <div className="space-y-4">
      <PageHeader leading={<Avatar size={56} name={fund.custodianName} />} title={fund.custodianName} description={<>{instituteName} — Petty Cash Fund</>} />

      {/* Fund Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard variant="inline" title="Float Amount" value={`₹${fund.floatAmount.toLocaleString()}`} tone="green" icon={<FiDollarSign className="h-[17px] w-[17px]" />} />
        <StatCard variant="inline" viz={fund.floatAmount > 0 ? { type: 'bullet', percent: pct(fund.currentBalance, fund.floatAmount), target: 100, color: fund.currentBalance < fund.floatAmount * 0.2 ? '#B3261E' : '#04563A' } : undefined} summary={`Balance ₹${fund.currentBalance.toLocaleString()} of ₹${fund.floatAmount.toLocaleString()} float, ${pct(fund.currentBalance, fund.floatAmount)} percent`} title="Current Balance" value={`₹${fund.currentBalance.toLocaleString()}`} tone={fund.currentBalance < fund.floatAmount * 0.2 ? 'red' : 'lime'} icon={<FiDollarSign className="h-[17px] w-[17px]" />} />
        <StatCard variant="inline" viz={fund.floatAmount > 0 ? { type: 'ring', percent: pct(spent, fund.floatAmount), color: '#E0B400' } : undefined} summary={`Spent ₹${spent.toLocaleString()} of ₹${fund.floatAmount.toLocaleString()} float, ${pct(spent, fund.floatAmount)} percent`} title="Spent" value={`₹${spent.toLocaleString()}`} tone="gold" icon={<FiTrendingDown className="h-[17px] w-[17px]" />} />
        <StatCard variant="inline" title="Status" value={<StatusBadge status={fund.status} />} summary={`Status: ${fund.status}`} />
      </div>

      {/* Actions */}
      {fund.status === 'active' && (
        <div className="flex gap-2">
          <Button onClick={() => setShowExpense(true)}>Record Expense</Button>
          <Button variant="secondary" onClick={handleReplenish} disabled={replenishing || spent <= 0}>
            {replenishing ? 'Replenishing...' : `Replenish (₹${spent.toLocaleString()})`}
          </Button>
        </div>
      )}

      {/* Expense Form */}
      {showExpense && (
        <Card padding="lg">
          <h3 className="mb-3 text-sm font-bold text-primary-700 dark:text-surface-text">Record expense</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-32">
              <Input label="Amount (₹)" type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="w-64">
              <Input label="Description" value={expenseForm.description} onChange={(e) => setExpenseForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="w-36">
              <Input label="Receipt No" value={expenseForm.receiptNo} onChange={(e) => setExpenseForm(f => ({ ...f, receiptNo: e.target.value }))} />
            </div>
            <div className="w-40">
              <Input label="Date" type="date" value={expenseForm.date} onChange={(e) => setExpenseForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <Button onClick={handleRecordExpense} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
            <Button variant="secondary" onClick={() => setShowExpense(false)}>Cancel</Button>
          </div>
          {fund.currentBalance > 0 && (
            <p className="mt-2 text-xs text-[#7B8983] dark:text-surface-muted">Available: ₹{fund.currentBalance.toLocaleString()}</p>
          )}
        </Card>
      )}

      {/* Transactions */}
      <Card padding="lg">
        <h3 className="mb-3.5 text-sm font-bold text-primary-700 dark:text-surface-text">Transactions</h3>
        {transactions.length === 0 ? (
          <EmptyState title="No transactions yet" description="Recorded expenses and replenishments will appear here." />
        ) : (
          <ScrollX>
            <table className="w-full border-collapse text-[12.5px]">
              <thead className="bg-[#FAFCFB] dark:bg-surface-base/60">
                <tr>
                  <th className="whitespace-nowrap px-3.5 py-2.5 text-left text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">Date</th>
                  <th className="whitespace-nowrap px-3.5 py-2.5 text-left text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">Type</th>
                  <th className="whitespace-nowrap px-3.5 py-2.5 text-left text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">Description</th>
                  <th className="whitespace-nowrap px-3.5 py-2.5 text-left text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">Receipt</th>
                  <th className="whitespace-nowrap px-3.5 py-2.5 text-right text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft bg-white dark:divide-surface-border dark:bg-surface-card">
                {transactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-[#F6FAF8] dark:hover:bg-surface-hover/60">
                    <td className="px-3.5 py-2 text-[12.5px] text-[#18231E] dark:text-surface-text whitespace-nowrap">
                      {new Date(txn.date).toLocaleDateString()}
                    </td>
                    <td className="px-3.5 py-2 text-[12.5px]">
                      <Badge variant={typeVariants[txn.type] || 'neutral'} dot className="capitalize">{txn.type}</Badge>
                    </td>
                    <td className="px-3.5 py-2 text-[12.5px] text-[#18231E] dark:text-surface-text">{txn.description}</td>
                    <td className="px-3.5 py-2 text-[12.5px] text-[#5B6963] dark:text-surface-muted">{txn.receiptNo || '-'}</td>
                    <td className={`px-3.5 py-2 text-[12.5px] text-right font-medium ${
                      txn.type === 'expense' ? 'text-[#B3261E] dark:text-red-300' : 'text-primary-600 dark:text-primary-400'
                    }`}>
                      {txn.type === 'expense' ? '-' : '+'}₹{txn.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollX>
        )}
      </Card>

      <ConfirmDialog
        isOpen={showReplenishDialog}
        title="Replenish Petty Cash"
        message="This will post all expenses to the accounting ledger and restore the balance to the float amount."
        consequence="All pending expenses will be settled and a new fund cycle will begin."
        confirmLabel="Replenish"
        cancelLabel="Cancel"
        variant="primary"
        isLoading={replenishing}
        onConfirm={confirmReplenish}
        onCancel={() => setShowReplenishDialog(false)}
      />
    </div>
  );
}
