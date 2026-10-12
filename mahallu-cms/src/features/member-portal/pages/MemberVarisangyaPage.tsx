import { useEffect, useState } from 'react';
import { formatINR } from '@/utils/formatINR';
import { Link } from 'react-router-dom';
import { FiArrowLeft, FiCalendar } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PageHeader from '@/components/ui/PageHeader';
import Tabs from '@/components/ui/Tabs';
import Table from '@/components/ui/Table';
import Alert from '@/components/ui/Alert';
import StatusBadge from '@/components/ui/StatusBadge';
import { controlClasses } from '@/components/ui/Input';
import { TableColumn } from '@/types';
import {
  memberPortalService,
  MemberVarisangyaResponse,
  VarisangyaRecord,
} from '@/services/memberPortalService';
import { ROUTES } from '@/constants/routes';
import { getFriendlyError } from '@/utils/apiMessages';


const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

type Tab = 'family' | 'member';

const recordColumns: TableColumn<VarisangyaRecord>[] = [
  { key: 'receiptNo', label: 'Receipt No.', render: (v) => v || '-' },
  { key: 'amount', label: 'Amount', render: (v) => <span className="font-semibold text-[#0B4837] dark:text-brand-lime">{formatINR(v)}</span> },
  {
    key: 'paymentDate',
    label: 'Payment Date',
    render: (v) =>
      v
        ? new Date(v).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })
        : '-',
  },
  { key: 'paymentMethod', label: 'Method', render: (v) => (v ? <StatusBadge status={v} tone="neutral" dot={false} /> : '-') },
  { key: 'remarks', label: 'Remarks', render: (v) => v || '-' },
  { key: 'status', label: 'Status', render: (s) =>
      s === 'pending' ? <StatusBadge status="pending" label="Pending approval" /> : s === 'rejected' ? <StatusBadge status="rejected" /> : <StatusBadge status="paid" /> },
];

function VarisangyaTable({ records }: { records: VarisangyaRecord[] }) {
  return <Table columns={recordColumns} data={records} showExport={false} emptyMessage="No varisangya records found." />;
}

export default function MemberVarisangyaPage() {
  const [data, setData] = useState<MemberVarisangyaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | undefined>(currentYear);
  const [activeTab, setActiveTab] = useState<Tab>('family');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await memberPortalService.getMemberVarisangya(selectedYear);
        setData(result);
      } catch (err: any) {
        setError(getFriendlyError(err, "Couldn't load varisangya records. Refresh the page or try again."));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedYear]);

  const records = activeTab === 'family' ? data?.familyVarisangya ?? [] : data?.memberVarisangya ?? [];
  const total =
    activeTab === 'family' ? data?.summary.familyTotal ?? 0 : data?.summary.memberTotal ?? 0;
  const count =
    activeTab === 'family' ? data?.summary.familyCount ?? 0 : data?.summary.memberCount ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="My varisangya"
        description="Family and personal varisangya payments"
        actions={
          <>
            <Link to={ROUTES.MEMBER.OVERVIEW}>
              <Button variant="secondary">
                <FiArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            </Link>
            {/* Year filter */}
            <div className="flex items-center gap-2">
              <FiCalendar className="h-4 w-4 text-[#7B8983] dark:text-surface-muted" aria-hidden="true" />
              <select
                aria-label="Year"
                value={selectedYear ?? ''}
                onChange={(e) =>
                  setSelectedYear(e.target.value ? Number(e.target.value) : undefined)
                }
                className={`${controlClasses} h-[34px] w-auto`}
              >
                <option value="">All Time</option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </>
        }
      />

      <Card padding="none">
        <div className="px-4 pt-3">
          <Tabs
            aria-label="Varisangya type"
            value={activeTab}
            onChange={(v) => setActiveTab(v as Tab)}
            tabs={[
              { value: 'family', label: 'Family Varisangya' },
              { value: 'member', label: 'My Varisangya' },
            ]}
          />
        </div>

        {/* Content */}
        <div className="p-3.5">
          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : error ? (
            <Alert tone="danger">{error}</Alert>
          ) : (
            <>
              <VarisangyaTable records={records} />

              {count > 0 && (
                <div className="mt-3.5 flex flex-wrap gap-6 border-t border-line-soft pt-3.5 text-[13px] dark:border-surface-border">
                  <span className="text-[#7B8983] dark:text-surface-muted">
                    Total records:{' '}
                    <span className="font-semibold text-[#18231E] dark:text-surface-text">{count}</span>
                  </span>
                  <span className="text-[#7B8983] dark:text-surface-muted">
                    Total paid:{' '}
                    <span className="font-semibold text-primary-700 dark:text-brand-lime">
                      {formatINR(total)}
                    </span>
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
