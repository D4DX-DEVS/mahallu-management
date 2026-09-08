import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/constants/routes';
import { masterAccountService, MahalluAccount } from '@/services/masterAccountService';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { useFormValidation } from '@/hooks/useFormValidation';
import { FieldRule, LIMITS } from '@/utils/validation';

/**
 * The same limits the API applies, so a form that passes here is not
 * refused there. Required matches what each input already declares.
 */
const RULES: Record<string, FieldRule> = {
  accountName: { label: 'account name', required: true, maxLength: LIMITS.title.max },
  accountNumber: { label: 'account number', maxLength: 34 },
  bankName: { label: 'bank name', maxLength: LIMITS.title.max },
  ifscCode: { label: 'IFSC code', maxLength: 11 },
  balance: { label: 'balance', type: 'number', min: 0, max: LIMITS.amount.max },
  status: { label: 'status', maxLength: LIMITS.shortText.max },
};

export default function EditMahalluAccount() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const [form, setForm] = useState({
    accountName: '',
    accountNumber: '',
    bankName: '',
    ifscCode: '',
    balance: 0,
    status: 'active' as 'active' | 'inactive',
  });
  const { errors, validate } = useFormValidation(RULES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Try state first, else fetch from list
    const stateAccount: MahalluAccount | undefined = location.state?.account;
    if (stateAccount) {
      setForm({
        accountName: stateAccount.accountName,
        accountNumber: stateAccount.accountNumber || '',
        bankName: stateAccount.bankName || '',
        ifscCode: stateAccount.ifscCode || '',
        balance: stateAccount.balance || 0,
        status: stateAccount.status || 'active',
      });
      setLoading(false);
    } else if (id) {
      masterAccountService
        .getAllMahalluAccounts({ limit: 1000 })
        .then((r) => {
          const found = r.data.find((a: MahalluAccount) => a.id === id);
          if (found) {
            setForm({
              accountName: found.accountName,
              accountNumber: found.accountNumber || '',
              bankName: found.bankName || '',
              ifscCode: found.ifscCode || '',
              balance: found.balance || 0,
              status: found.status || 'active',
            });
          } else {
            navigate(ROUTES.MAHALLU_FINANCE.ACCOUNTS);
          }
        })
        .catch(() => navigate(ROUTES.MAHALLU_FINANCE.ACCOUNTS))
        .finally(() => setLoading(false));
    } else {
      navigate(ROUTES.MAHALLU_FINANCE.ACCOUNTS);
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Every field checked at once, each message on its own field.
    if (!validate(form)) return;
    if (!form.accountName.trim() || !id) return;
    try {
      setSaving(true);
      setError(null);
      await masterAccountService.updateMahalluAccount(id, form);
      navigate(ROUTES.MAHALLU_FINANCE.ACCOUNTS);
    } catch (err: any) {
      setError(errorMessage(err, { action: 'update account. please try again' }));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSkeleton variant="section" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Account"
        description="Update the Mahallu bank account details"
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
              label="Balance"
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
              error={errors.status}
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
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
