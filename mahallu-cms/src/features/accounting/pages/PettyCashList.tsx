import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import FilterBar from '@/components/ui/FilterBar';
import Avatar from '@/components/ui/Avatar';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { pettyCashService, PettyCashFund } from '@/services/pettyCashService';
import { instituteService } from '@/services/instituteService';
import { useAuthStore } from '@/store/authStore';

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
    } catch (err) { console.error(err); }
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
      <PageHeader
        title="Petty Cash"
        description="Manage petty cash funds for daily expenses"
        actions={<Button onClick={() => setShowCreate(true)}>+ New fund</Button>}
      />

      <Card padding="none" className="overflow-visible">
        {!userInstituteId && (
          <FilterBar>
            <div className="w-48">
              <Select
                options={[{ value: 'all', label: 'All Institutes' }, ...institutes.map(i => ({ value: i.id, label: i.name }))]}
                value={instituteFilter}
                onChange={(e) => setInstituteFilter(e.target.value)}
              />
            </div>
          </FilterBar>
        )}

        <div className="p-3.5">
        {/* Create Form */}
        {showCreate && (
          <div className="mb-4 rounded-xl border border-line bg-[#F4F7F5] p-3.5 dark:border-surface-border dark:bg-surface-base/60">
            <h3 className="mb-3 text-sm font-bold text-primary-700 dark:text-surface-text">Create petty cash fund</h3>
            <div className="flex flex-wrap items-end gap-3">
              {!userInstituteId && (
                <div className="w-48">
                  <Select
                    label="Institute"
                    options={[{ value: '', label: 'Select Institute' }, ...institutes.map(i => ({ value: i.id, label: i.name }))]}
                    value={createForm.instituteId}
                    onChange={(e) => setCreateForm(f => ({ ...f, instituteId: e.target.value }))}
                  />
                </div>
              )}
              <div className="w-48">
                <Input label="Custodian Name" value={createForm.custodianName} onChange={(e) => setCreateForm(f => ({ ...f, custodianName: e.target.value }))} />
              </div>
              <div className="w-36">
                <Input label="Float Amount (₹)" type="number" value={createForm.floatAmount} onChange={(e) => setCreateForm(f => ({ ...f, floatAmount: e.target.value }))} />
              </div>
              <Button onClick={handleCreate} disabled={saving}>{saving ? 'Creating...' : 'Create'}</Button>
              <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : funds.length === 0 ? (
          <EmptyState title="Nothing to show yet" description='No petty cash funds found. Create one to get started.' />
        ) : (
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
            {funds.map((fund) => {
              const spent = fund.floatAmount - fund.currentBalance;
              const spentPct = fund.floatAmount > 0 ? (spent / fund.floatAmount) * 100 : 0;
              return (
                <Card
                  key={fund.id}
                  hoverEffect
                  className="cursor-pointer"
                  onClick={() => navigate(`/petty-cash/${fund.id}`)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="flex items-center gap-2 text-[13px] font-bold text-[#18231E] dark:text-surface-text"><Avatar size={32} name={fund.custodianName} />{fund.custodianName}</h3>
                      <p className="text-xs text-[#7B8983] dark:text-surface-muted">{getInstituteName(fund)}</p>
                    </div>
                    <StatusBadge status={fund.status} />
                  </div>
                  <div className="space-y-2 mt-3">
                    <div className="flex justify-between text-[13px]">
                      <span className="text-[#7B8983] dark:text-surface-muted">Float</span>
                      <span className="font-medium">₹{fund.floatAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-[13px]">
                      <span className="text-[#7B8983] dark:text-surface-muted">Balance</span>
                      <span className={`font-bold ${fund.currentBalance < fund.floatAmount * 0.2 ? 'text-red-600' : 'text-primary-600'}`}>
                        ₹{fund.currentBalance.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-[#E7EEEA] dark:bg-surface-raised">
                      <div
                        className={`h-2 rounded-full ${spentPct > 80 ? 'bg-red-500' : spentPct > 50 ? 'bg-secondary-500' : 'bg-progress-brand'}`}
                        style={{ width: `${Math.min(spentPct, 100)}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-[#7B8983] dark:text-surface-muted text-right">₹{spent.toLocaleString()} spent ({spentPct.toFixed(0)}%)</p>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
        </div>
      </Card>
    </div>
  );
}
