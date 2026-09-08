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

/** An account number keeps its leading zeros, so it is text, not a number. */
const RULES: Record<string, FieldRule> = {
  accountName: { label: 'account name', required: true, minLength: 2, maxLength: LIMITS.title.max },
  accountNumber: { label: 'account number', maxLength: 34 },
  bankName: { label: 'bank name', maxLength: LIMITS.title.max },
  ifscCode: { label: 'IFSC code', maxLength: 11 },
  balance: { label: 'opening balance', type: 'number', min: 0, max: LIMITS.amount.max },
};

const emptyForm = {
  accountName: '',
  accountNumber: '',
  bankName: '',
  ifscCode: '',
  balance: 0,
  status: 'active' as 'active' | 'inactive',
};

export default function CreateMahalluAccount() {
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
      await masterAccountService.createMahalluAccount({ ...form, ...(tenantId ? { tenantId } : {}) });
      navigate(ROUTES.MAHALLU_FINANCE.ACCOUNTS);
    } catch (err: any) {
      setError(errorMessage(err, { action: 'create account. please try again' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Mahallu Account"
        description="Create a new bank account for the Mahallu"
        breadcrumbs={[
          { label: 'Mahallu Finance', path: ROUTES.MAHALLU_FINANCE.ACCOUNTS },
          { label: 'Bank Accounts', path: ROUTES.MAHALLU_FINANCE.ACCOUNTS },
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
              label="Account Name *"
              value={form.accountName}
              error={errors.accountName}
              onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value.replace(/[0-9]/g, '') }))}
              placeholder="e.g. Mahallu Savings Account"
              required
            />
            <Input
              label="Account Number"
              value={form.accountNumber}
              error={errors.accountNumber}
              onChange={(e) =>
                setForm((f) => ({ ...f, accountNumber: e.target.value.replace(/[^0-9]/g, '') }))
              }
              placeholder="e.g. 1234567890"
            />
            <Input
              label="Bank Name"
              value={form.bankName}
              error={errors.bankName}
              onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value.replace(/[0-9]/g, '') }))}
              placeholder="e.g. State Bank of India"
            />
            <Input
              label="IFSC Code"
              value={form.ifscCode}
              error={errors.ifscCode}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  ifscCode: e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, '')
                    .slice(0, 11),
                }))
              }
              placeholder="e.g. SBIN0001234"
            />
            <Input
              label="Opening Balance"
              type="number"
              value={form.balance}
              error={errors.balance}
              onChange={(e) => setForm((f) => ({ ...f, balance: Number(e.target.value) }))}
            />
            <Select
              label="Status"
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as 'active' | 'inactive' }))}
            />
          </div>

          <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-3 sm:items-center pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(ROUTES.MAHALLU_FINANCE.ACCOUNTS)}
            >
              <FiX className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !form.accountName.trim()}>
              <FiSave className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Create Account'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
