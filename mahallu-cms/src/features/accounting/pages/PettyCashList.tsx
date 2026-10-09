import { useState, useEffect, useCallback } from 'react';
import { FiPlus } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import TableCard from '@/components/ui/TableCard';
import TableToolbar from '@/components/ui/TableToolbar';
import FilterPanel from '@/components/ui/FilterPanel';
import Table from '@/components/ui/Table';
import { TableColumn } from '@/types';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import EmptyState from '@/components/ui/EmptyState';
import { pettyCashService, PettyCashFund } from '@/services/pettyCashService';
import { instituteService } from '@/services/instituteService';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';
import StatusBadge from '@/components/ui/StatusBadge';
import { fetchAllPages } from '@/services/api';

export default function PettyCashList() {
  const navigate = useNavigate();
  const { currentInstituteId: userInstituteId } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [funds, setFunds] = useState<PettyCashFund[]>([]);
  const [institutes, setInstitutes] = useState<{ id: string; name: string }[]>([]);
  const [instituteFilter, setInstituteFilter] = useState(userInstituteId || 'all');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ instituteId: '', custodianName: '', floatAmount: '' });
  const [saving, setSaving] = useState(false);

  const fetchFunds = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {};
      if (instituteFilter !== 'all') params.instituteId = instituteFilter;
      const data = await pettyCashService.getAll(params);
      setFunds(data);
    } catch (err) {
      setError(loadErrorMessage(err, 'petty cash funds'));
    } finally {
      setLoading(false);
    }
  }, [instituteFilter]);

  useEffect(() => {
    if (!userInstituteId) fetchInstitutes();
    fetchFunds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchFunds]);

  const fetchInstitutes = async () => {
    try {
      const allRows = await fetchAllPages((page) => instituteService.getAll(page));
      setInstitutes(allRows.map((i: any) => ({ id: i.id, name: i.name })));
    } catch (err) {
      console.error(err);
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
      toast.success('Petty cash fund created');
      fetchFunds();
    } catch (err) {
      toast.error(errorMessage(err, { action: 'create petty cash fund' }));
    } finally {
      setSaving(false);
    }
  };

  const getInstituteName = (fund: PettyCashFund) => {
    if (typeof fund.instituteId === 'object' && fund.instituteId?.name) return toTitleCase(fund.instituteId.name);
    return '-';
  };

  const columns: TableColumn<PettyCashFund>[] = [
    {
      key: 'custodianName',
      label: 'Custodian',
      sortable: true,
      width: '16rem',
      render: (_v, fund) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">{toTitleCase(fund.custodianName)}</div>
          <div className="truncate text-xs text-muted-foreground">{getInstituteName(fund)}</div>
        </div>
      ),
    },
    { key: 'floatAmount', label: 'Float', align: 'right', sortable: true, width: '9rem', render: (v) => `₹${Number(v ?? 0).toLocaleString('en-IN')}` },
    {
      key: 'currentBalance',
      label: 'Balance',
      align: 'right',
      sortable: true,
      width: '9rem',
      render: (v, fund) => (
        <span className={fund.currentBalance < fund.floatAmount * 0.2 ? 'font-semibold text-destructive' : 'font-semibold text-success'}>
          ₹{Number(v ?? 0).toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      key: 'spent',
      label: 'Spent',
      sortable: false,
      priority: 'secondary',
      width: '14rem',
      render: (_v, fund) => {
        const spent = fund.floatAmount - fund.currentBalance;
        const spentPct = fund.floatAmount > 0 ? (spent / fund.floatAmount) * 100 : 0;
        return (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-20 flex-shrink-0 overflow-hidden rounded-full bg-subtle">
              <div
                className={`h-full rounded-full ${spentPct > 80 ? 'bg-destructive' : spentPct > 50 ? 'bg-warning' : 'bg-success'}`}
                style={{ width: `${Math.min(spentPct, 100)}%` }}
              />
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">{spentPct.toFixed(0)}%</span>
          </div>
        );
      },
    },
    { key: 'status', label: 'Status', sortable: true, width: '8rem', render: (_v, fund) => <StatusBadge status={fund.status} /> },
  ];

  const isFiltered = instituteFilter !== 'all' && !userInstituteId;

  return (
    <>
      <PageHeader
        title="Petty cash"
        description="Manage petty cash funds for daily expenses."
        actions={
          <Button icon={<FiPlus />} collapseLabel onClick={() => setShowCreate((open) => !open)}>
            {showCreate ? 'Close form' : 'New fund'}
          </Button>
        }
      />

      {showCreate && (
        <div className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">Create Petty Cash Fund</h3>
          <div className="flex flex-wrap items-end gap-4">
            {!userInstituteId && (
              <div className="w-full sm:w-48">
                <Select
                  label="Institute"
                  options={[
                    { value: '', label: 'Select Institute' },
                    ...institutes.map((i) => ({ value: i.id, label: toTitleCase(i.name) })),
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


      <TableCard>
        <TableToolbar
          onFilterClick={() => setIsFilterVisible((open) => !open)}
          isFilterVisible={isFilterVisible}
          hasFilters={!userInstituteId}
          activeFilterCount={isFiltered ? 1 : 0}
          onRefresh={fetchFunds}
        />

        {isFilterVisible && !userInstituteId && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-52">
              <Select
                label="Institute"
                options={[
                  { value: 'all', label: 'All institutes' },
                  ...institutes.map((i) => ({ value: i.id, label: toTitleCase(i.name) })),
                ]}
                value={instituteFilter}
                onChange={(e) => setInstituteFilter(e.target.value)}
              />
            </div>
            {isFiltered && (
              <Button variant="ghost" onClick={() => setInstituteFilter('all')}>
                Clear filters
              </Button>
            )}
          </FilterPanel>
        )}

        {error ? (
          <EmptyState variant="error" entity="petty cash funds" description={error} action={{ label: 'Try again', onClick: fetchFunds }} />
        ) : (
          <Table
            fixedLayout
            columns={columns}
            data={funds}
            isLoading={loading}
            entity="petty cash funds"
            emptyVariant={isFiltered ? 'no-results' : 'empty'}
            emptyAction={
              isFiltered
                ? { label: 'Clear filters', onClick: () => setInstituteFilter('all') }
                : { label: 'Add fund', onClick: () => setShowCreate(true) }
            }
            onRowClick={(fund) => navigate(`/petty-cash/${fund.id}`)}
          />
        )}
      </TableCard>
    </>
  );
}
