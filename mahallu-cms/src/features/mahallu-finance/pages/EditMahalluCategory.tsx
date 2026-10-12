import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { ROUTES } from '@/constants/routes';
import { masterAccountService, Category } from '@/services/masterAccountService';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

export default function EditMahalluCategory() {
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
    const stateCategory: Category | undefined = location.state?.category;
    if (stateCategory) {
      setForm({
        name: stateCategory.name,
        nameMl: (stateCategory as any).nameMl || '',
        description: stateCategory.description || '',
        type: (stateCategory.type || 'income') as 'income' | 'expense',
      });
      setLoading(false);
    } else if (id) {
      masterAccountService.getAllCategories({ limit: 1000, scope: 'mahallu' })
        .then(r => {
          const found = r.data.find((c: Category) => c.id === id);
          if (found) {
            setForm({
              name: found.name,
              nameMl: (found as any).nameMl || '',
              description: found.description || '',
              type: (found.type || 'income') as 'income' | 'expense',
            });
          } else {
            navigate(ROUTES.MAHALLU_FINANCE.CATEGORIES);
          }
        })
        .catch(() => navigate(ROUTES.MAHALLU_FINANCE.CATEGORIES))
        .finally(() => setLoading(false));
    } else {
      navigate(ROUTES.MAHALLU_FINANCE.CATEGORIES);
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !id) return;
    try {
      setSaving(true);
      setError(null);
      await masterAccountService.updateCategory(id, form);
      navigate(ROUTES.MAHALLU_FINANCE.CATEGORIES);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't update category. Try again in a moment."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>;

  return (
    <div className="space-y-4">
      <PageHeader title="Edit Category" description="Update the category details" />

      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}

          <Card padding="lg">
          <h3 className="text-sm font-bold text-primary-700 dark:text-surface-text">Category details</h3>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Name and type of the category</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Name *"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Maintenance Fee"
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
            <Button type="button" variant="secondary" onClick={() => navigate(ROUTES.MAHALLU_FINANCE.CATEGORIES)}>
              <FiX className="h-3.5 w-3.5" />Cancel
            </Button>
            <Button type="submit" disabled={saving || !form.name.trim()}>
              <FiSave className="h-3.5 w-3.5" />{saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
