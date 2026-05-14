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
import { masterAccountService, MahalluAccount } from '@/services/masterAccountService';

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
      masterAccountService.getAllMahalluAccounts({ limit: 1000 })
        .then(r => {
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
    if (!form.accountName.trim() || !id) return;
    try {
      setSaving(true);
      setError(null);
      await masterAccountService.updateMahalluAccount(id, form);
      navigate(ROUTES.MAHALLU_FINANCE.ACCOUNTS);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update account. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Edit Account</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Update the Mahallu bank account details</p>
        </div>
        <Breadcrumb
          items={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Mahallu Finance', path: ROUTES.MAHALLU_FINANCE.ACCOUNTS },
            { label: 'Bank Accounts', path: ROUTES.MAHALLU_FINANCE.ACCOUNTS },
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
              label="Account Name *"
              value={form.accountName}
              onChange={e => setForm(f => ({ ...f, accountName: e.target.value.replace(/[0-9]/g, '') }))}
              placeholder="e.g. Mahallu Savings Account"
              required
            />
            <Input
              label="Account Number"
              value={form.accountNumber}
              onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value.replace(/[^0-9]/g, '') }))}
              placeholder="e.g. 1234567890"
            />
            <Input
              label="Bank Name"
              value={form.bankName}
              onChange={e => setForm(f => ({ ...f, bankName: e.target.value.replace(/[0-9]/g, '') }))}
              placeholder="e.g. State Bank of India"
            />
            <Input
              label="IFSC Code"
              value={form.ifscCode}
              onChange={e => setForm(f => ({ ...f, ifscCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11) }))}
              placeholder="e.g. SBIN0001234"
            />
            <Input
              label="Balance"
              type="number"
              value={form.balance}
              onChange={e => setForm(f => ({ ...f, balance: Number(e.target.value) }))}
            />
            <Select
              label="Status"
              options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as 'active' | 'inactive' }))}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => navigate(ROUTES.MAHALLU_FINANCE.ACCOUNTS)}>
              <FiX className="h-4 w-4 mr-2" />Cancel
            </Button>
            <Button type="submit" disabled={saving || !form.accountName.trim()}>
              <FiSave className="h-4 w-4 mr-2" />{saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
