import { useState, useEffect } from 'react';
import { FiPlus } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { pettyCashService, PettyCashFund } from '@/services/pettyCashService';
import { instituteService } from '@/services/instituteService';
import { useAuthStore } from '@/store/authStore';
import PageHeader from '@/components/layout/PageHeader';

export default function PettyCashList() {
  const navigate = useNavigate();
  const { currentInstituteId: userInstituteId } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [funds, setFunds] = useState<PettyCashFund[]>([]);
  const [institutes, setInstitutes] = useState<{ id: string; name: string }[]>([]);
  const [instituteFilter, setInstituteFilter] = useState(userInstituteId || 'all');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ instituteId: '', custodianName: '', floatAmount: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userInstituteId) fetchInstitutes();
    fetchFunds();
  }, [instituteFilter]);

  const fetchInstitutes = async () => {
    try {
      const result = await instituteService.getAll({ limit: 1000 });
      setInstitutes(result.data.map((i: any) => ({ id: i.id, name: i.name })));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchFunds = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (instituteFilter !== 'all') params.instituteId = instituteFilter;
      const data = await pettyCashService.getAll(params);
      setFunds(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!createForm.custodianName || !createForm.floatAmount) return;
    try {
      setSaving(true);
      await pettyCashService.create({
        instituteId: createForm.instituteId || (userInstituteId as string),
        custodianName: createForm.custodianName,
        floatAmount: Number(createForm.floatAmount),
      });
      setShowCreate(false);
      setCreateForm({ instituteId: '', custodianName: '', floatAmount: '' });
      fetchFunds();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const getInstituteName = (fund: PettyCashFund) => {
    if (typeof fund.instituteId === 'object' && fund.instituteId?.name) return fund.instituteId.name;
    return '-';
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Petty Cash" description="Manage petty cash funds for daily expenses" />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex w-full flex-wrap items-center gap-4 sm:w-auto">
            {!userInstituteId && (
              <div className="w-full sm:w-48">
                <Select
                  label="Institute"
                  options={[
                    { value: 'all', label: 'All Institutes' },
                    ...institutes.map((i) => ({ value: i.id, label: i.name })),
                  ]}
                  value={instituteFilter}
                  onChange={(e) => setInstituteFilter(e.target.value)}
                />
              </div>
            )}
          </div>
          <Button onClick={() => setShowCreate(true)} icon={<FiPlus />} collapseLabel>New Fund</Button>
        </div>

        {/* Create Form */}
        {showCreate && (
          <div className="mb-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
            <h3 className="text-sm font-semibold mb-3">Create Petty Cash Fund</h3>
            <div className="flex flex-wrap items-end gap-4">
              {!userInstituteId && (
                <div className="w-full sm:w-48">
                  <Select
                    label="Institute"
                    options={[
                      { value: '', label: 'Select Institute' },
                      ...institutes.map((i) => ({ value: i.id, label: i.name })),
                    ]}
                    value={createForm.instituteId}
                    onChange={(e) => setCreateForm((f) => ({ ...f, instituteId: e.target.value }))}
                  />
                </div>
              )}
              <div className="w-full sm:w-48">
                <Input
                  label="Custodian Name"
                  value={createForm.custodianName}
                  onChange={(e) => setCreateForm((f) => ({ ...f, custodianName: e.target.value }))}
                />
              </div>
              <div className="w-full sm:w-36">
                <Input
                  label="Float Amount (₹)"
                  type="number"
                  value={createForm.floatAmount}
                  onChange={(e) => setCreateForm((f) => ({ ...f, floatAmount: e.target.value }))}
                />
              </div>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? 'Creating...' : 'Create'}
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <PageSkeleton variant="section" />
        ) : funds.length === 0 ? (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">
            No petty cash funds found. Create one to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {funds.map((fund) => {
              const spent = fund.floatAmount - fund.currentBalance;
              const spentPct = fund.floatAmount > 0 ? (spent / fund.floatAmount) * 100 : 0;
              return (
                <div
                  key={fund.id}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/petty-cash/${fund.id}`)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-foreground">{fund.custodianName}</h3>
                      <p className="text-xs text-gray-500">{getInstituteName(fund)}</p>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        fund.status === 'active'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                      }`}
                    >
                      {fund.status}
                    </span>
                  </div>
                  <div className="space-y-2 mt-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Float</span>
                      <span className="font-medium">₹{fund.floatAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Balance</span>
                      <span
                        className={`font-semibold ${fund.currentBalance < fund.floatAmount * 0.2 ? 'text-red-600' : 'text-green-600'}`}
                      >
                        ₹{fund.currentBalance.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${spentPct > 80 ? 'bg-red-500' : spentPct > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(spentPct, 100)}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 text-right">
                      ₹{spent.toLocaleString()} spent ({spentPct.toFixed(0)}%)
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
