import { FiDownload } from 'react-icons/fi';
import { TableColumn } from '@/types';
import { NOC } from '@/services/registrationService';
import { formatDate } from '@/utils/format';
import StatusBadge from '@/components/ui/StatusBadge';
import Badge from '@/components/ui/Badge';
import RowActions from '@/components/ui/RowActions';
import { PersonCell } from '@/components/ui/Avatar';
import { downloadNocPdf } from '@/utils/nocPdf';

interface NocColumnDeps {
  navigate: (path: string) => void;
}

/** Column config for the NOC table, split out to keep NOCList under the 500-line rule. */
export const buildNocColumns = ({ navigate }: NocColumnDeps): TableColumn<NOC>[] => [
  { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
  { key: 'applicantName', label: 'Applicant', sortable: true, render: (name) => <PersonCell name={name} /> },
  {
    key: 'purposeTitle',
    label: 'Purpose',
    render: (value, row) => value || row.purpose || '-',
  },
  {
    key: 'type',
    label: 'Type',
    render: (type) => <Badge variant="info" className="capitalize">{type}</Badge>,
  },
  {
    key: 'status',
    label: 'Status',
    render: (status) => <StatusBadge status={status || 'pending'} />,
  },
  {
    key: 'createdAt',
    label: 'Created',
    render: (date) => formatDate(date),
  },
  {
    key: 'actions',
    label: 'Actions',
    hideable: false,
    render: (_, row) => (
      <RowActions
        onView={() => navigate(`/registrations/noc/${row.id}`)}
        onEdit={() => navigate(`/registrations/noc/${row.id}/edit`)}
        viewLabel="View"
        ariaLabels={{ view: 'View NOC', edit: 'Edit NOC' }}
        extra={[
          {
            label: 'Download',
            icon: <FiDownload />,
            onClick: () => {
              const nocId = (row as any)._id || row.id || '';
              const mahalluName =
                row.tenantId && typeof row.tenantId === 'object' ? (row.tenantId as any).name : undefined;
              downloadNocPdf(
                { ...row, id: nocId, mahalluName, approvedBy: row.approvedBy },
                `noc-${row.applicantName}-${nocId.slice(-6)}`
              );
            },
          },
        ]}
      />
    ),
  },
];
