import { FiEye, FiEdit2, FiDownload } from 'react-icons/fi';
import { TableColumn } from '@/types';
import { NOC } from '@/services/registrationService';
import { formatDate, toTitleCase } from '@/utils/format';
import { downloadNocPdf } from '@/utils/nocPdf';
import StatusBadge from '@/components/ui/StatusBadge';
import ActionsMenu from '@/components/ui/ActionsMenu';

interface NocColumnDeps {
  navigate: (path: string) => void;
}

/** Column config for the NOC table, split out to keep NOCList under the 500-line rule. */
export const buildNocColumns = ({ navigate }: NocColumnDeps): TableColumn<NOC>[] => [
  {
    key: 'applicantName',
    label: 'Applicant',
    width: '8.25rem',
    sortable: true,
    render: (value) => toTitleCase(value),
  },
  {
    key: 'purposeTitle',
    label: 'Purpose',
    width: '7.75rem',
    render: (value, row) => toTitleCase(value || row.purpose) || '-',
  },
  {
    key: 'type',
    label: 'Type',
    width: '6.25rem',
    render: (type) => (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 capitalize">
        {type}
      </span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    width: '7.25rem',
    render: (status) => {
      return <StatusBadge status={status} />;
    },
  },
  {
    key: 'createdAt',
    label: 'Created',
    width: '7.75rem',
    render: (date) => formatDate(date),
  },
  {
    key: 'actions',
    label: 'Actions',
    width: '8rem',
    align: 'center',
    render: (_, row) => (
      <ActionsMenu
        items={[
          {
            label: 'View',
            icon: <FiEye className="h-4 w-4" />,
            onClick: () => {
              navigate(`/registrations/noc/${row.id}`);
            },
          },
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
          {
            label: 'Edit',
            icon: <FiEdit2 className="h-4 w-4" />,
            onClick: () => {
              navigate(`/registrations/noc/${row.id}/edit`);
            },
          },
        ]}
      />
    ),
  },
];
