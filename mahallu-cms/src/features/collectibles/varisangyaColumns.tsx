import { FiEdit2, FiDownload, FiCheckCircle } from 'react-icons/fi';

import ActionsMenu from '@/components/ui/ActionsMenu';
import StatusBadge from '@/components/ui/StatusBadge';
import { TableColumn } from '@/types';
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
    render: (status) => <StatusBadge status={status || 'verified'} />,
  },
  {
    key: 'actions',
    label: 'Actions',
    width: '8rem',
    align: 'center',
    render: (_, row) => (
      <div onClick={(e) => e.stopPropagation()}>
        <ActionsMenu
          label={`Actions for ${toTitleCase(getPayerName(row))}`}
          items={[
            {
              label: 'Edit payment',
              icon: <FiEdit2 className="h-4 w-4" />,
              onClick: () => openEdit(row),
            },
            {
              label: 'View/Download PDF',
              icon: <FiDownload className="h-4 w-4" />,
              onClick: () => handleViewPdf(row),
            },
            ...(row.status === 'pending' && onVerify
              ? [
                  {
                    label: 'Verify payment',
                    icon: <FiCheckCircle className="h-4 w-4" />,
                    onClick: () => onVerify(row),
                  },
                ]
              : []),
          ]}
        />
      </div>
    ),
  },
];
