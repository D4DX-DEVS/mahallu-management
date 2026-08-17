import { FiEdit2, FiDownload, FiCheckCircle } from 'react-icons/fi';
import { TableColumn } from '@/types';
import { Varisangya } from '@/services/collectibleService';
import { formatDate } from '@/utils/format';

interface VarisangyaColumnDeps {
  openEdit: (row: Varisangya) => void;
  handleViewPdf: (row: Varisangya) => void;
  onVerify?: (row: Varisangya) => void;
}

/** Table config split out of VarisangyaList to keep the page under 500 lines. */
export const getPayerName = (row: Varisangya): string => {
  const m = row.memberId;
  const f = row.familyId;
  if (m && typeof m === 'object' && m.name) return m.name;
  if (f && typeof f === 'object' && f.houseName) return f.houseName;
  return '-';
};

export const getFamilyName = (row: Varisangya): string => {
  const f = row.familyId;
  const m = row.memberId;
  if (f && typeof f === 'object' && f.houseName) return f.houseName;
  const member = m && typeof m === 'object' ? (m as Record<string, unknown>) : null;
  if (member?.familyName && typeof member.familyName === 'string') return member.familyName as string;
  const memberFamily = member?.familyId as { houseName?: string } | undefined;
  if (memberFamily?.houseName) return memberFamily.houseName;
  return '-';
};

export const buildVarisangyaColumns = ({ openEdit, handleViewPdf, onVerify }: VarisangyaColumnDeps): TableColumn<Varisangya>[] => [
  { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
  { key: 'name', label: 'Name', render: (_, row) => getPayerName(row) },
  { key: 'familyName', label: 'Family name', render: (_, row) => getFamilyName(row) },
  {
    key: 'amount',
    label: 'Amount',
    render: (amount) => `₹${amount?.toLocaleString() || 0}`,
  },
  {
    key: 'paymentDate',
    label: 'Payment Date',
    render: (date) => formatDate(date),
  },
  { key: 'paymentMethod', label: 'Payment Method' },
  {
    key: 'receiptNo',
    label: 'Receipt No.',
    render: (receiptNo) => receiptNo || '-',
  },
  {
    key: 'status',
    label: 'Status',
    render: (status) => (
      <span
        className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
          status === 'pending'
            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
            : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
        }`}
      >
        {status === 'pending' ? 'Pending' : 'Verified'}
      </span>
    ),
  },
  {
    key: 'actions',
    label: 'Actions',
    render: (_, row) => (
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            openEdit(row);
          }}
          className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
          title="Edit payment"
        >
          <FiEdit2 className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleViewPdf(row);
          }}
          className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
          title="View/Download PDF"
        >
          <FiDownload className="h-4 w-4" />
        </button>
        {row.status === 'pending' && onVerify && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onVerify(row);
            }}
            className="p-1.5 rounded-md hover:bg-green-100 dark:hover:bg-green-900 text-green-600 dark:text-green-400 transition-colors"
            title="Verify payment"
          >
            <FiCheckCircle className="h-4 w-4" />
          </button>
        )}
      </div>
    ),
  },
];
