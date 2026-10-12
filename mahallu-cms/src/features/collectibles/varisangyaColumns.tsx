import { FiPrinter } from 'react-icons/fi';
import RowActions from '@/components/ui/RowActions';
import { PersonCell } from '@/components/ui/Avatar';
import { TableColumn } from '@/types';
import { Varisangya } from '@/services/collectibleService';
import { formatDate } from '@/utils/format';
import { ReceiptStatusBadge, isCancelled } from './receiptUi';
import StatusBadge from '@/components/ui/StatusBadge';

interface VarisangyaColumnDeps {
  openEdit: (row: Varisangya) => void;
  handleViewPdf: (row: Varisangya) => void;
  openCancel?: (row: Varisangya) => void;
  /** Only pass for roles that may cancel receipts (canCancelReceipts). */
  canCancel?: boolean;
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

export const buildVarisangyaColumns = ({ openEdit, handleViewPdf, openCancel, canCancel }: VarisangyaColumnDeps): TableColumn<Varisangya>[] => [
  { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
  {
    key: 'name',
    label: 'Name',
    render: (_, row) => {
      const name = getPayerName(row);
      const m = row.memberId && typeof row.memberId === 'object' ? (row.memberId as unknown as { photoUrl?: string }) : null;
      return <PersonCell name={name === '-' ? '' : name} src={m?.photoUrl} size={32} />;
    },
  },
  { key: 'familyName', label: 'Family name', render: (_, row) => getFamilyName(row) },
  {
    key: 'amount',
    label: 'Amount',
    align: 'right',
    render: (amount) => `₹${amount?.toLocaleString() || 0}`,
  },
  {
    key: 'paymentDate',
    label: 'Payment Date',
    render: (date) => formatDate(date),
  },
  { key: 'paymentMethod', label: 'Payment Method', defaultHidden: true, render: (v) => (v ? <StatusBadge status={v} tone="neutral" dot={false} /> : '-') },
  {
    key: 'receiptNo',
    label: 'Receipt No.',
    render: (receiptNo) => receiptNo || '-',
  },
  {
    key: 'status',
    label: 'Status',
    render: (_, row) => <ReceiptStatusBadge row={row} />,
  },
  {
    key: 'actions',
    label: 'Actions',
    hideable: false,
    render: (_, row) => {
      const live = !isCancelled(row);
      return (
        <RowActions
          onEdit={live ? () => openEdit(row) : undefined}
          editLabel="Edit payment"
          extra={[{ label: 'Reprint (duplicate)', icon: <FiPrinter />, onClick: () => handleViewPdf(row), show: live }]}
          onDelete={live && canCancel && openCancel ? () => openCancel(row) : undefined}
          deleteLabel="Cancel receipt"
        />
      );
    },
  },
];
