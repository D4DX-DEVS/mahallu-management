import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/constants/routes';
import { masterAccountService, Ledger } from '@/services/masterAccountService';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { useFormValidation } from '@/hooks/useFormValidation';
import { FieldRule, LIMITS } from '@/utils/validation';

/**
 * The same limits the API applies, so a form that passes here is not
 * refused there. Required matches what each input already declares.
 */
const RULES: Record<string, FieldRule> = {
  name: { label: 'name', required: true, maxLength: LIMITS.title.max },
  nameMl: { label: 'name', maxLength: LIMITS.title.max },
  description: { label: 'description', maxLength: LIMITS.description.max },
  type: { label: 'type', maxLength: LIMITS.shortText.max },
};

export default function EditMahalluLedger() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const [form, setForm] = useState({
    name: '',
    nameMl: '',
    description: '',
    type: 'income' as 'income' | 'expense',
  });
  const { errors, validate } = useFormValidation(RULES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const stateLedger: Ledger | undefined = location.state?.ledger;
    if (stateLedger) {
      setForm({
        name: stateLedger.name,
        nameMl: (stateLedger as any).nameMl || '',
        description: stateLedger.description || '',
        type: (stateLedger.type || 'income') as 'income' | 'expense',
      });
      setLoading(false);
    } else if (id) {
      masterAccountService
        .getAllLedgers({ limit: 1000, scope: 'mahallu' })
        .then((r) => {
          const found = r.data.find((l: Ledger) => l.id === id);
          if (found) {
            setForm({
              name: found.name,
              nameMl: (found as any).nameMl || '',
              description: found.description || '',
              type: (found.type || 'income') as 'income' | 'expense',
            });
          } else {
            navigate(ROUTES.MAHALLU_FINANCE.LEDGERS);
          }
        })
        .catch(() => navigate(ROUTES.MAHALLU_FINANCE.LEDGERS))
        .finally(() => setLoading(false));
    } else {
      navigate(ROUTES.MAHALLU_FINANCE.LEDGERS);
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Every field checked at once, each message on its own field.
    if (!validate(form)) return;
    if (!form.name.trim() || !id) return;
    try {
      setSaving(true);
      setError(null);
      await masterAccountService.updateLedger(id, form);
      navigate(ROUTES.MAHALLU_FINANCE.LEDGERS);
    } catch (err: any) {
      setError(errorMessage(err, { action: 'update ledger. please try again' }));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSkeleton variant="section" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Ledger"
        description="Update the ledger account details"
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
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
