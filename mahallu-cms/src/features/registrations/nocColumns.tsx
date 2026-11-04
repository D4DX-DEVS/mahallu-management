import { FiDownload } from 'react-icons/fi';
import { TableColumn } from '@/types';
import { NOC } from '@/services/registrationService';
import { formatDate, toTitleCase } from '@/utils/format';
import { downloadNocPdf } from '@/utils/nocPdf';
import StatusBadge from '@/components/ui/StatusBadge';
import Badge from '@/components/ui/Badge';
import ActionsMenu from '@/components/ui/ActionsMenu';

interface NocColumnDeps {
  navigate: (path: string) => void;
}

/** Column config for the NOC table, split out to keep NOCList under the 500-line rule. */
export const buildNocColumns = (_deps: NocColumnDeps): TableColumn<NOC>[] => [
  {
    key: 'applicantName',
    label: 'Applicant',
    width: '16rem',
    sortable: true,
    render: (value) => <span className="font-medium text-foreground">{toTitleCase(value)}</span>,
  },
  {
    key: 'purposeTitle',
    label: 'Purpose',
    width: '14rem',
    priority: 'secondary',
    render: (value, row) => toTitleCase(value || row.purpose) || '—',
  },
  {
    key: 'type',
    label: 'Type',
    sortable: true,
    width: '8rem',
    render: (type) => <Badge variant="info" className="capitalize">{type}</Badge>,
  },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    width: '9rem',
    render: (status) => <StatusBadge status={status} />,
  },
  {
    key: 'createdAt',
    label: 'Created',
    sortable: true,
    priority: 'secondary',
    width: '9rem',
    render: (date) => formatDate(date),
  },
  {
    key: 'actions',
    label: '',
    width: '6.5rem',
    align: 'right',
    sortable: false,
    render: (_, row) => (
      <ActionsMenu
        label={`Actions for ${toTitleCase(row.applicantName)}`}
        items={[
          {
            label: 'Download',
            icon: <FiDownload className="h-4 w-4" />,
            onClick: () => {
              const nocId = (row as any)._id || row.id || '';
              const mahalluName =
                row.tenantId && typeof row.tenantId === 'object' ? (row.tenantId as any).name : undefined;
              downloadNocPdf(
                {
                  ...row,
                  id: nocId,
                  mahalluName,
                  approvedBy: row.approvedBy,
                },
                `noc-${row.applicantName}-${nocId.slice(-6)}`
              );
            },
          },
        ]}
      />
    ),
  },
];
