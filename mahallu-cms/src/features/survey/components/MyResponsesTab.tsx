import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TableCard from '@/components/ui/TableCard';
import Table from '@/components/ui/Table';
import Tabs from '@/components/ui/Tabs';
import StatusBadge from '@/components/ui/StatusBadge';
import TableToolbar from '@/components/ui/TableToolbar';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import { Pagination as PaginationType, TableColumn } from '@/types';
import { surveyFormService, SurveyForm, SurveySubmission } from '@/services/surveyFormService';
import { loadErrorMessage } from '@/utils/errors';
import { SUBMISSION_STATUS_LABELS, formatDateTime } from '../surveyDisplay';

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
];

/** The signed-in user's own responses and drafts. Drafts reopen in the form; the rest read-only. */
export default function MyResponsesTab({ survey }: { survey: SurveyForm }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<SurveySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState<PaginationType | null>(null);

  const fetchRows = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await surveyFormService.listMine(survey.id, { page: currentPage, limit: itemsPerPage, ...(status ? { status } : {}) });
      setRows(result.data);
      setPagination(result.pagination);
    } catch (err) {
      setError(loadErrorMessage(err, 'responses'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [survey.id, status, currentPage, itemsPerPage]);

  const columns: TableColumn<SurveySubmission>[] = [
    {
      key: 'updatedAt',
      label: 'Last change',
      width: '11rem',
      render: (_v, row) => formatDateTime(row.submittedAt || row.updatedAt),
    },
    {
      key: 'respondentName',
      label: survey.respondentType === 'member' ? 'Member' : survey.respondentType === 'family' ? 'Family' : 'Respondent',
      width: '14rem',
      render: (v) => v || <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'status',
      label: 'Status',
      width: '9rem',
      render: (v) => <StatusBadge status={v} label={SUBMISSION_STATUS_LABELS[v]} />,
    },
    {
      key: 'reviewNote',
      label: 'Review note',
      width: '14rem',
      priority: 'secondary',
      render: (v) => v || <span className="text-muted-foreground">—</span>,
    },
  ];

  return (
    <TableCard>
      <TableToolbar
        tabs={
          <Tabs
            variant="segmented"
            ariaLabel="My response status"
            value={status}
            onChange={(v) => {
              setStatus(v);
              setCurrentPage(1);
            }}
            items={STATUS_TABS}
          />
        }
        onRefresh={fetchRows}
      />
      {error ? (
        <EmptyState variant="error" entity="responses" description={error} action={{ label: 'Try again', onClick: fetchRows }} />
      ) : (
        <>
          <Table
            fixedLayout
            serverSorted
            columns={columns}
            data={rows}
            isLoading={loading}
            entity="responses"
            emptyVariant={status ? 'no-results' : 'empty'}
            emptyAction={survey.fillState === 'open' && !status ? { label: 'Fill form', onClick: () => navigate(`/survey/${survey.id}/fill`) } : undefined}
            onRowClick={(row) =>
              navigate(row.status === 'draft' ? `/survey/${survey.id}/fill/${row.id}` : `/survey/${survey.id}/responses/${row.id}`)
            }
          />
          {pagination && (
            <div className="mt-4">
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                totalItems={pagination.total}
                itemsPerPage={pagination.limit}
                entity="responses"
                onPageChange={setCurrentPage}
                onItemsPerPageChange={(size) => {
                  setItemsPerPage(size);
                  setCurrentPage(1);
                }}
              />
            </div>
          )}
        </>
      )}
    </TableCard>
  );
}
