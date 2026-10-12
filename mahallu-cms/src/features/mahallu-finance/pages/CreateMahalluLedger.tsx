import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { ROUTES } from '@/constants/routes';
import { masterAccountService } from '@/services/masterAccountService';
import { useAuthStore } from '@/store/authStore';
import { getTenantId } from '@/utils/tenantHelper';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const emptyForm = {
  name: '',
  nameMl: '',
  description: '',
  type: 'income' as 'income' | 'expense',
};

export default function CreateMahalluLedger() {
  const navigate = useNavigate();
  const { currentTenantId, user } = useAuthStore();
  const tenantId = getTenantId(user, currentTenantId);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      setSaving(true);
      setError(null);
      await masterAccountService.createLedger({ ...form, ...(tenantId ? { tenantId } : {}) });
      navigate(ROUTES.MAHALLU_FINANCE.LEDGERS);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't create ledger. Check the details and try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Add Ledger" description="Create a new ledger account for the Mahallu" />

      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}

          <Card padding="lg">
          <h3 className="text-sm font-bold text-primary-700 dark:text-surface-text">Ledger details</h3>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Name and type of the ledger</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Name *"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Zakat Collection"
              required
            />
            <div className="hidden">
            <Input
              label="Name (Malayalam)"
              value={form.nameMl}
              onChange={e => setForm(f => ({ ...f, nameMl: e.target.value }))}
              placeholder="മലയാളത്തില്"
            />
            </div>
            <Select
              label="Type *"
              options={[{ value: 'income', label: 'Income' }, { value: 'expense', label: 'Expense' }]}
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value as 'income' | 'expense' }))}
            />
            <Input
              label="Description"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Optional description"
            />
          </div>
          </Card>

          <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap justify-end gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] [&>button]:flex-1 sm:[&>button]:flex-none rounded-b-card border-t border-line bg-white/90 px-4 py-3 backdrop-blur dark:border-surface-border dark:bg-surface-card/90">
            <Button type="button" variant="secondary" onClick={() => navigate(ROUTES.MAHALLU_FINANCE.LEDGERS)}>
              <FiX className="h-3.5 w-3.5" />Cancel
            </Button>
            <Button type="submit" disabled={saving || !form.name.trim()}>
              <FiSave className="h-3.5 w-3.5" />{saving ? 'Saving...' : 'Create Ledger'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
