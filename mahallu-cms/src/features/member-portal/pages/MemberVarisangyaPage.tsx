import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft, FiCalendar } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import { PageSkeleton } from '@/components/ui/Skeleton';
import {
  memberPortalService,
  MemberVarisangyaResponse,
  VarisangyaRecord,
} from '@/services/memberPortalService';
import { ROUTES } from '@/constants/routes';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

type Tab = 'family' | 'member';

function VarisangyaTable({ records }: { records: VarisangyaRecord[] }) {
  if (records.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
        No varisangya records found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
            <th className="py-2 pr-4 font-medium">Receipt No.</th>
            <th className="py-2 pr-4 font-medium">Amount</th>
            <th className="py-2 pr-4 font-medium">Payment Date</th>
            <th className="py-2 pr-4 font-medium">Method</th>
            <th className="py-2 pr-4 font-medium">Remarks</th>
            <th className="py-2 pr-4 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record, idx) => (
            <tr
              key={idx}
              className="border-b border-gray-100 dark:border-gray-800 text-gray-900 dark:text-gray-100"
            >
              <td className="py-3 pr-4">{record.receiptNo || '-'}</td>
              <td className="py-3 pr-4 font-medium">{currency.format(record.amount)}</td>
              <td className="py-3 pr-4">
                {record.paymentDate
                  ? new Date(record.paymentDate).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '-'}
              </td>
              <td className="py-3 pr-4">{record.paymentMethod || '-'}</td>
              <td className="py-3 pr-4 text-gray-500 dark:text-gray-400">{record.remarks || '-'}</td>
              <td className="py-3 pr-4">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  Paid
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
        setError(err.response?.data?.message || 'Failed to load varisangya records');
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link
            to={ROUTES.MEMBER.OVERVIEW}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <FiArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Varisangya</h1>
        </div>

        {/* Year filter */}
        <div className="flex items-center gap-2">
          <FiCalendar className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          <select
            value={selectedYear ?? ''}
            onChange={(e) =>
              setSelectedYear(e.target.value ? Number(e.target.value) : undefined)
            }
            className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Time</option>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200 dark:border-gray-700">
        {(
          [
            { key: 'family', label: 'Family Varisangya' },
            { key: 'member', label: 'My Varisangya' },
          ] as { key: Tab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary-600 text-primary-700 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <Card>
        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <p className="text-center py-8 text-red-500 dark:text-red-400 text-sm">{error}</p>
        ) : (
          <>
            <VarisangyaTable records={records} />

            {count > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-6 text-sm">
                <span className="text-gray-500 dark:text-gray-400">
                  Total records:{' '}
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{count}</span>
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  Total paid:{' '}
                  <span className="font-semibold text-green-700 dark:text-green-400">
                    {currency.format(total)}
                  </span>
                </span>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
