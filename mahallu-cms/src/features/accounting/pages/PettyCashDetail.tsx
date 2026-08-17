import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { PageSkeleton } from '@/components/ui/Skeleton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { pettyCashService, PettyCashFund, PettyCashTransaction } from '@/services/pettyCashService';
import { toast } from '@/store/toastStore';

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
      toast.error(err.response?.data?.message || 'Failed to record expense');
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
      toast.error(err.response?.data?.message || 'Failed to replenish petty cash');
      setReplenishing(false);
    }
  };

  if (loading) {
    return <PageSkeleton variant="section" />;
  }

  if (!fund) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Petty cash fund not found</p>
        <Button onClick={() => navigate('/petty-cash')} className="mt-4">Back to List</Button>
      </div>
    );
  }

  const spent = fund.floatAmount - fund.currentBalance;
  const instituteName = typeof fund.instituteId === 'object' ? fund.instituteId?.name : '';

  const typeStyles: Record<string, string> = {
    float: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    expense: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    replenishment: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{fund.custodianName}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{instituteName} — Petty Cash Fund</p>
        </div>
        <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Petty Cash', path: '/petty-cash' }, { label: fund.custodianName }]} />
      </div>

      {/* Fund Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <p className="text-sm text-gray-500 dark:text-gray-400">Float Amount</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">₹{fund.floatAmount.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500 dark:text-gray-400">Current Balance</p>
          <p className={`text-2xl font-bold ${fund.currentBalance < fund.floatAmount * 0.2 ? 'text-red-600' : 'text-green-600'}`}>
            ₹{fund.currentBalance.toLocaleString()}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500 dark:text-gray-400">Spent</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">₹{spent.toLocaleString()}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
          <p className={`text-lg font-bold ${fund.status === 'active' ? 'text-green-600' : 'text-gray-600'}`}>{fund.status}</p>
        </Card>
      </div>

      {/* Actions */}
      {fund.status === 'active' && (
        <div className="flex gap-3">
          <Button onClick={() => setShowExpense(true)}>Record Expense</Button>
          <Button variant="outline" onClick={handleReplenish} disabled={replenishing || spent <= 0}>
            {replenishing ? 'Replenishing...' : `Replenish (₹${spent.toLocaleString()})`}
          </Button>
        </div>
      )}

      {/* Expense Form */}
      {showExpense && (
        <Card>
          <h3 className="text-sm font-semibold mb-3">Record Expense</h3>
          <div className="flex flex-wrap items-end gap-4">
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
            <Button variant="outline" onClick={() => setShowExpense(false)}>Cancel</Button>
          </div>
          {fund.currentBalance > 0 && (
            <p className="mt-2 text-xs text-gray-500">Available: ₹{fund.currentBalance.toLocaleString()}</p>
          )}
        </Card>
      )}

      {/* Transactions */}
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Transactions</h3>
        {transactions.length === 0 ? (
          <p className="text-center py-8 text-gray-500">No transactions yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Receipt</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {transactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                      {new Date(txn.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${typeStyles[txn.type] || ''}`}>
                        {txn.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{txn.description}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{txn.receiptNo || '-'}</td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${
                      txn.type === 'expense' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                    }`}>
                      {txn.type === 'expense' ? '-' : '+'}₹{txn.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
