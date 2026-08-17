import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/constants/routes';
import { masterAccountService, Ledger } from '@/services/masterAccountService';
import { useAuthStore } from '@/store/authStore';
import { getTenantId } from '@/utils/tenantHelper';

const emptyForm = {
  ledgerId: '',
  date: new Date().toISOString().split('T')[0],
  amount: 0,
  type: 'income' as 'income' | 'expense',
  description: '',
  paymentMethod: '',
  referenceNo: '',
};

export default function CreateMahalluLedgerItem() {
  const navigate = useNavigate();
  const { currentTenantId, user } = useAuthStore();
  const tenantId = getTenantId(user, currentTenantId);
  const [form, setForm] = useState(emptyForm);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loadingLedgers, setLoadingLedgers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    masterAccountService.getAllLedgers({ limit: 1000, scope: 'mahallu' })
      .then(r => setLedgers(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setLoadingLedgers(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.ledgerId || !form.description.trim() || form.amount <= 0) return;
    try {
      setSaving(true);
      setError(null);
      await masterAccountService.createLedgerItem({
        ...form,
        source: 'manual',
        ...(tenantId ? { tenantId } : {}),
      });
      navigate(ROUTES.MAHALLU_FINANCE.LEDGER_ITEMS);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create entry. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loadingLedgers) return <PageSkeleton variant="section" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Add Ledger Entry</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Create a new manual journal entry</p>
        </div>
        <Breadcrumb
          items={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Mahallu Finance', path: ROUTES.MAHALLU_FINANCE.ACCOUNTS },
            { label: 'Ledger Items', path: ROUTES.MAHALLU_FINANCE.LEDGER_ITEMS },
            { label: 'Create' },
          ]}
        />
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900/30 dark:border-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Ledger *"
              options={[{ value: '', label: 'Select Ledger...' }, ...ledgers.map(l => ({ value: l.id, label: `${l.name} (${l.type})` }))]}
              value={form.ledgerId}
              onChange={e => setForm(f => ({ ...f, ledgerId: e.target.value }))}
            />
            <Input
              label="Date *"
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              required
            />
            <Select
              label="Type *"
              options={[{ value: 'income', label: 'Income' }, { value: 'expense', label: 'Expense' }]}
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value as 'income' | 'expense' }))}
            />
            <Input
              label="Amount *"
              type="number"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))}
              required
            />
            <div className="md:col-span-2">
              <Input
                label="Description *"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="e.g. Monthly collection"
                required
              />
            </div>
            <Input
              label="Payment Method"
              value={form.paymentMethod}
              onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}
              placeholder="e.g. Cash, Bank Transfer"
            />
            <Input
              label="Reference No."
              value={form.referenceNo}
              onChange={e => setForm(f => ({ ...f, referenceNo: e.target.value }))}
              placeholder="e.g. TXN123456"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => navigate(ROUTES.MAHALLU_FINANCE.LEDGER_ITEMS)}>
              <FiX className="h-4 w-4 mr-2" />Cancel
            </Button>
            <Button type="submit" disabled={saving || !form.ledgerId || !form.description.trim() || form.amount <= 0}>
              <FiSave className="h-4 w-4 mr-2" />{saving ? 'Saving...' : 'Add Entry'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
