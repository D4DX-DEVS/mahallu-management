import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { ROUTES } from '@/constants/routes';
import { masterAccountService, Ledger } from '@/services/masterAccountService';

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
      masterAccountService.getAllLedgers({ limit: 1000, scope: 'mahallu' })
        .then(r => {
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
    if (!form.name.trim() || !id) return;
    try {
      setSaving(true);
      setError(null);
      await masterAccountService.updateLedger(id, form);
      navigate(ROUTES.MAHALLU_FINANCE.LEDGERS);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update ledger. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Edit Ledger</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Update the ledger account details</p>
        </div>
        <Breadcrumb
          items={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Mahallu Finance', path: ROUTES.MAHALLU_FINANCE.ACCOUNTS },
            { label: 'Ledgers', path: ROUTES.MAHALLU_FINANCE.LEDGERS },
            { label: 'Edit' },
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

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => navigate(ROUTES.MAHALLU_FINANCE.LEDGERS)}>
              <FiX className="h-4 w-4 mr-2" />Cancel
            </Button>
            <Button type="submit" disabled={saving || !form.name.trim()}>
              <FiSave className="h-4 w-4 mr-2" />{saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
