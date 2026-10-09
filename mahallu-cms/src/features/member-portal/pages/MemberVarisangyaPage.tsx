import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import TableToolbar from '@/components/ui/TableToolbar';
import FilterPanel from '@/components/ui/FilterPanel';
import Select from '@/components/ui/Select';
import Table from '@/components/ui/Table';
import Tabs from '@/components/ui/Tabs';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import {
  memberPortalService,
  MemberVarisangyaResponse,
  VarisangyaRecord,
} from '@/services/memberPortalService';
import { ROUTES } from '@/constants/routes';
import { TableColumn } from '@/types';
import { loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

type Tab = 'family' | 'member';

const columns: TableColumn<VarisangyaRecord>[] = [
  {
    key: 'receiptNo',
    label: 'Receipt no.',
    sortable: true,
    width: '14rem',
    render: (v) => <span className="font-medium text-foreground tabular-nums">{v || '—'}</span>,
  },
  {
    key: 'amount',
    label: 'Amount',
    align: 'right',
    sortable: true,
    width: '10rem',
    render: (v) => <span className="font-semibold tabular-nums">{currency.format(v)}</span>,
  },
  {
    key: 'paymentDate',
    label: 'Payment date',
    sortable: true,
    width: '10rem',
    render: (v) =>
      v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
  },
  { key: 'paymentMethod', label: 'Method', sortable: true, priority: 'secondary', width: '9rem', render: (v) => <span className="capitalize">{v || '—'}</span> },
  { key: 'remarks', label: 'Remarks', sortable: false, priority: 'tertiary', width: '16rem', render: (v) => v || '—' },
  { key: 'status', label: 'Status', sortable: true, width: '8rem', render: (v) => <StatusBadge status={v} /> },
];

export default function MemberVarisangyaPage() {
  const [data, setData] = useState<MemberVarisangyaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | undefined>(currentYear);
  const [activeTab, setActiveTab] = useState<Tab>('family');
  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setData(await memberPortalService.getMemberVarisangya(selectedYear));
    } catch (err) {
      setError(loadErrorMessage(err, 'varisangya records'));
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const records = activeTab === 'family' ? (data?.familyVarisangya ?? []) : (data?.memberVarisangya ?? []);
  const total = activeTab === 'family' ? (data?.summary?.familyTotal ?? 0) : (data?.summary?.memberTotal ?? 0);
  const count = activeTab === 'family' ? (data?.summary?.familyCount ?? 0) : (data?.summary?.memberCount ?? 0);
  const isFiltered = selectedYear !== currentYear;

  return (
    <>
      <PageHeader
        title="My varisangya"
        description="Contributions paid by your family and by you."
        actions={
          <Link to={ROUTES.MEMBER.OVERVIEW}>
            <Button variant="outline" icon={<FiArrowLeft />} collapseLabel>
              Back to dashboard
            </Button>
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3">
        <StatCard title="Records" value={count} />
        <StatCard title="Total paid" value={currency.format(total)} />
      </div>

      <TableCard>
        <TableToolbar
          tabs={
            <Tabs
              variant="segmented"
              ariaLabel="Varisangya type"
              value={activeTab}
              onChange={(value) => setActiveTab(value as Tab)}
              items={[
                { value: 'family', label: 'Family varisangya' },
                { value: 'member', label: 'My varisangya' },
              ]}
            />
          }
          onFilterClick={() => setIsFilterVisible((open) => !open)}
          isFilterVisible={isFilterVisible}
          hasFilters
          activeFilterCount={isFiltered ? 1 : 0}
          onRefresh={fetchData}
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-52">
              <Select
                label="Year"
                value={selectedYear ?? ''}
                onChange={(e) => setSelectedYear(e.target.value ? Number(e.target.value) : undefined)}
                options={[
                  { value: '', label: 'All time' },
                  ...yearOptions.map((y) => ({ value: String(y), label: String(y) })),
                ]}
              />
            </div>
            {isFiltered && (
              <Button variant="ghost" onClick={() => setSelectedYear(currentYear)}>
                This year
              </Button>
            )}
          </FilterPanel>
        )}

        {error ? (
          <EmptyState variant="error" entity="varisangya records" description={error} action={{ label: 'Try again', onClick: fetchData }} />
        ) : (
          <Table
            fixedLayout
            columns={columns}
            data={records}
            isLoading={loading}
            entity="varisangya records"
            emptyVariant={isFiltered ? 'no-results' : 'empty'}
            emptyAction={isFiltered ? { label: 'Show this year', onClick: () => setSelectedYear(currentYear) } : undefined}
            rowKey={(record, index) => record.receiptNo || String(index)}
          />
        )}
      </TableCard>
    </>
  );
}
