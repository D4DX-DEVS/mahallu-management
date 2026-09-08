import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { ROUTES } from '@/constants/routes';
import { masterAccountService } from '@/services/masterAccountService';
import { useAuthStore } from '@/store/authStore';
import { getTenantId } from '@/utils/tenantHelper';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { useFormValidation } from '@/hooks/useFormValidation';
import { FieldRule, LIMITS } from '@/utils/validation';

const RULES: Record<string, FieldRule> = {
  name: { label: 'ledger name', required: true, minLength: 2, maxLength: LIMITS.title.max },
  nameMl: { label: 'ledger name', maxLength: LIMITS.title.max },
  description: { label: 'description', maxLength: LIMITS.description.max },
  type: { label: 'type', required: true, oneOf: ['income', 'expense'] },
};

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
  const { errors, validate } = useFormValidation(RULES);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // A bare `return` here left Save doing nothing at all: no message, no
    // marked field, no clue what the form wanted.
    if (!validate(form)) return;
    if (saving) return;
    try {
      setSaving(true);
      setError(null);
      await masterAccountService.createLedger({ ...form, ...(tenantId ? { tenantId } : {}) });
      navigate(ROUTES.MAHALLU_FINANCE.LEDGERS);
    } catch (err: any) {
      setError(errorMessage(err, { action: 'create ledger. please try again' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Ledger"
        description="Create a new ledger account for the Mahallu"
        breadcrumbs={[
          { label: 'Mahallu Finance', path: ROUTES.MAHALLU_FINANCE.ACCOUNTS },
          { label: 'Ledgers', path: ROUTES.MAHALLU_FINANCE.LEDGERS },
        ]}
      />

      <form onSubmit={handleSubmit}>
        <Card className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900/30 dark:border-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Name *"
              value={form.name}
              error={errors.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Zakat Collection"
              required
            />
            <div className="hidden">
              <Input
                label="Name (Malayalam)"
                value={form.nameMl}
                error={errors.nameMl}
                onChange={(e) => setForm((f) => ({ ...f, nameMl: e.target.value }))}
                placeholder="മലയാളത്തില്"
              />
            </div>
            <Select
              label="Type *"
              options={[
                { value: 'income', label: 'Income' },
                { value: 'expense', label: 'Expense' },
              ]}
              value={form.type}
              error={errors.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as 'income' | 'expense' }))}
            />
            <Input
              label="Description"
              value={form.description}
              error={errors.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optional description"
            />
          </div>

          <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-3 sm:items-center pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(ROUTES.MAHALLU_FINANCE.LEDGERS)}
            >
              <FiX className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !form.name.trim()}>
              <FiSave className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Create Ledger'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
