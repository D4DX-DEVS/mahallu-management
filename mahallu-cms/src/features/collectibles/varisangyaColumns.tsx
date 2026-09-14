import { FiEdit2, FiDownload, FiCheckCircle } from 'react-icons/fi';

import { rowActionClass } from '@/components/ui/rowAction';import { TableColumn } from '@/types';
import { Varisangya } from '@/services/collectibleService';
import { formatDate, toTitleCase } from '@/utils/format';

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

export const buildVarisangyaColumns = ({
  openEdit,
  handleViewPdf,
  onVerify,
}: VarisangyaColumnDeps): TableColumn<Varisangya>[] => [
  { key: 'name', label: 'Name', width: '6.75rem', render: (_, row) => toTitleCase(getPayerName(row)) },
  { key: 'familyName', label: 'Family name', width: '10rem', render: (_, row) => toTitleCase(getFamilyName(row)) },
  {
    key: 'amount',
    label: 'Amount',
    width: '9.25rem',
    align: 'center',
    render: (amount) => `₹${amount?.toLocaleString() || 0}`,
  },
  {
    key: 'paymentDate',
    label: 'Payment Date',
    width: '10.75rem',
    render: (date) => formatDate(date),
  },
  { key: 'paymentMethod', label: 'Payment Method', width: '12rem' },
  {
    key: 'receiptNo',
    label: 'Receipt No.',
    width: '9.5rem',
    render: (receiptNo) => receiptNo || '-',
  },
  {
    key: 'status',
    label: 'Status',
    width: '7.25rem',
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
    width: '8rem',
    align: 'center',
    render: (_, row) => (
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            openEdit(row);
          }}
          className={rowActionClass()}
          title="Edit payment"
          aria-label="Edit payment"
        >
          <FiEdit2 className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleViewPdf(row);
          }}
          className={rowActionClass()}
          title="View/Download PDF"
          aria-label="View/Download PDF"
        >
          <FiDownload className="h-4 w-4" />
        </button>
        {row.status === 'pending' && onVerify && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onVerify(row);
            }}
            className={rowActionClass()}
            title="Verify payment"
            aria-label="Verify payment"
          >
            <FiCheckCircle className="h-4 w-4" />
          </button>
        )}
      </div>
    ),
  },
];
