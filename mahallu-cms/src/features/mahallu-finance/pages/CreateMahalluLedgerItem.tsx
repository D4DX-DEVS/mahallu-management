import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { ROUTES } from '@/constants/routes';
import { masterAccountService, Ledger } from '@/services/masterAccountService';
import { useAuthStore } from '@/store/authStore';
import { getTenantId } from '@/utils/tenantHelper';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

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
      toast.error(getFriendlyError(err, "Couldn't create entry. Check the details and try again."));
    } finally {
      setSaving(false);
    }
  };

  if (loadingLedgers) return <div className="flex justify-center py-12"><LoadingSpinner /></div>;

  return (
    <div className="space-y-4">
      <PageHeader title="Add Ledger Entry" description="Create a new manual journal entry" />

      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}

          <Card padding="lg">
          <h3 className="text-sm font-bold text-primary-700 dark:text-surface-text">Entry details</h3>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Ledger, amount and payment information</p>

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
          </Card>

          <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap justify-end gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] [&>button]:flex-1 sm:[&>button]:flex-none rounded-b-card border-t border-line bg-white/90 px-4 py-3 backdrop-blur dark:border-surface-border dark:bg-surface-card/90">
            <Button type="button" variant="secondary" onClick={() => navigate(ROUTES.MAHALLU_FINANCE.LEDGER_ITEMS)}>
              <FiX className="h-3.5 w-3.5" />Cancel
            </Button>
            <Button type="submit" disabled={saving || !form.ledgerId || !form.description.trim() || form.amount <= 0}>
              <FiSave className="h-3.5 w-3.5" />{saving ? 'Saving...' : 'Add Entry'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
