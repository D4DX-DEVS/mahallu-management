import { FiEye, FiEdit2, FiDownload } from 'react-icons/fi';
import { TableColumn } from '@/types';
import { NOC } from '@/services/registrationService';
import { formatDate } from '@/utils/format';
import { downloadNocPdf } from '@/utils/nocPdf';

interface NocColumnDeps {
  navigate: (path: string) => void;
}

/** Column config for the NOC table, split out to keep NOCList under the 500-line rule. */
export const buildNocColumns = ({ navigate }: NocColumnDeps): TableColumn<NOC>[] => [
  { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
  { key: 'applicantName', label: 'Applicant', sortable: true },
  {
    key: 'purposeTitle',
    label: 'Purpose',
    render: (value, row) => value || row.purpose || '-',
  },
  {
    key: 'type',
    label: 'Type',
    render: (type) => (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 capitalize">
        {type}
      </span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    render: (status) => {
      const statusColors: Record<string, string> = {
        pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      };
      return (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[status || 'pending']}`}>
          {status || 'pending'}
        </span>
      );
    },
  },
  {
    key: 'createdAt',
    label: 'Created',
    render: (date) => formatDate(date),
  },
  {
    key: 'actions',
    label: 'Actions',
    render: (_, row) => (
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/registrations/noc/${row.id}`);
          }}
          className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
          title="View"
        >
          <FiEye className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            const nocId = (row as any)._id || row.id || '';
            const mahalluName =
              row.tenantId && typeof row.tenantId === 'object'
                ? (row.tenantId as any).name
                : undefined;
            downloadNocPdf(
              {
                ...row,
                id: nocId,
                mahalluName,
                approvedBy: row.approvedBy,
              },
              `noc-${row.applicantName}-${nocId.slice(-6)}`
            );
          }}
          className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
          title="Download"
        >
          <FiDownload className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/registrations/noc/${row.id}/edit`);
          }}
          className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
          title="Edit"
        >
          <FiEdit2 className="h-4 w-4" />
        </button>
      </div>
    ),
  },
];
