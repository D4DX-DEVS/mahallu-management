import { FiEdit2, FiDownload, FiCheckCircle, FiTrash2 } from 'react-icons/fi';

import ActionsMenu from '@/components/ui/ActionsMenu';
import StatusBadge from '@/components/ui/StatusBadge';
import { TableColumn } from '@/types';
import { Varisangya } from '@/services/collectibleService';
import { formatDate, toTitleCase } from '@/utils/format';

interface VarisangyaColumnDeps {
  openEdit: (row: Varisangya) => void;
  handleViewPdf: (row: Varisangya) => void;
  onVerify?: (row: Varisangya) => void;
  onDelete?: (row: Varisangya) => void;
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
  onDelete,
}: VarisangyaColumnDeps): TableColumn<Varisangya>[] => [
  {
    key: 'name',
    label: 'Name',
    sortable: false,
    width: '14rem',
    render: (_, row) => <span className="font-medium text-foreground">{toTitleCase(getPayerName(row))}</span>,
  },
  { key: 'familyName', label: 'Family name', sortable: false, priority: 'secondary', width: '12rem', render: (_, row) => toTitleCase(getFamilyName(row)) },
  {
    key: 'amount',
    label: 'Amount',
    width: '9rem',
    align: 'right',
    sortable: true,
    render: (amount) => `₹${amount?.toLocaleString('en-IN') || 0}`,
  },
  {
    key: 'paymentDate',
    label: 'Payment date',
    sortable: true,
    width: '9rem',
    render: (date) => formatDate(date),
  },
  { key: 'paymentMethod', label: 'Method', sortable: true, priority: 'secondary', width: '8rem' },
  {
    key: 'receiptNo',
    label: 'Receipt no.',
    sortable: true,
    priority: 'secondary',
    width: '9rem',
    render: (receiptNo) => receiptNo || '—',
  },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    width: '8rem',
    render: (status) => <StatusBadge status={status || 'verified'} />,
  },
  {
    key: 'actions',
    label: '',
    width: '6.5rem',
    align: 'right',
    sortable: false,
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
            ...(onDelete
              ? [
                  {
                    label: 'Delete payment',
                    icon: <FiTrash2 className="h-4 w-4" />,
                    variant: 'danger' as const,
                    onClick: () => onDelete(row),
                  },
                ]
              : []),
          ]}
        />
      </div>
    ),
  },
];
