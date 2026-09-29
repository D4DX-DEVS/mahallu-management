import { useState, useEffect, useCallback } from 'react';
import { FiEye, FiTrash2 } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';
import ExpandableSearch from '@/components/ui/ExpandableSearch';
import Card from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import ActionsMenu from '@/components/ui/ActionsMenu';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import {
  scholarshipService,
  AcademicSupportCase,
  SUPPORT_CASE_TYPE_OPTIONS,
  SUPPORT_CASE_STATUS_OPTIONS,
  supportCaseTypeLabel,
  supportCaseStatusLabel,
  memberName,
} from '@/services/scholarshipService';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';
import { TableColumn } from '@/types';

export default function AcademicSupportList() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<AcademicSupportCase[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const columns: TableColumn<AcademicSupportCase>[] = [
    {
      key: 'student',
      label: 'Student',
      render: (_v, c) => toTitleCase(memberName(c.memberId)),
    },
    {
      key: 'type',
      label: 'Type',
      priority: 'secondary',
      render: (_v, c) => supportCaseTypeLabel(c.type),
    },
    {
      key: 'description',
      label: 'Description',
      priority: 'tertiary',
      render: (_v, c) => (
        <button onClick={() => navigate(`/education/support/${c.id}`)} className="text-primary hover:underline">
          {c.description}
        </button>
      ),
    },
    {
      key: 'mentorName',
      label: 'Mentor',
      priority: 'tertiary',
      render: (_v, c) => (c.mentorName ? toTitleCase(c.mentorName) : '—'),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_v, c) => (
        <span className="rounded bg-muted px-2 py-1 text-xs">{supportCaseStatusLabel(c.status)}</span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      sortable: false,
      render: (_v, c) => (
        <ActionsMenu
          label={'Actions for ' + toTitleCase(memberName(c.memberId))}
          items={[
            {
              label: 'View',
              icon: <FiEye className="h-4 w-4" />,
              onClick: () => navigate(`/education/support/${c.id}`),
            },
            {
              label: 'Delete',
              icon: <FiTrash2 className="h-4 w-4" />,
              onClick: () => setDeleteConfirm({ id: c.id, name: memberName(c.memberId) }),
              variant: 'danger' as const,
            },
          ]}
        />
      ),
    },
  ];

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const { data, pagination } = await scholarshipService.getSupportCases({
        page: currentPage,
        limit: 10,
        type: type || undefined,
        status: status || undefined,
        search: search || undefined,
      });
      setCases(data);
      setPagination(pagination);
    } catch (error) {
      console.error("Couldn't load:", error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, type, status, search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [type, status, search]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      setDeleting(true);
      await scholarshipService.deleteSupportCase(deleteConfirm.id);
      setDeleteConfirm(null);
      toast.success('Support ticket deleted');
      await fetchCases();
    } catch (error: any) {
      toast.error(errorMessage(error, { action: 'delete' }));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <PageHeader title="Academic Support Cases" />
        <Button onClick={() => navigate('/education/support/create')}>New Case</Button>
      </div>

      <Card>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <select
              aria-label="Filter"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            >
              <option value="">All types</option>
              {SUPPORT_CASE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            >
              <option value="">All statuses</option>
              {SUPPORT_CASE_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ExpandableSearch
              value={search}
              onChange={(value) => setSearch(value)}
              entity="academic support records"
            />
            <Button onClick={() => fetchCases()}>Refresh</Button>
          </div>

          <Table
            columns={columns}
            data={cases}
            isLoading={loading}
            entity="support cases"
            emptyVariant={search || type || status ? 'no-results' : 'empty'}
            emptyAction={
              !search && !type && !status
                ? { label: 'New Case', onClick: () => navigate('/education/support/create') }
                : undefined
            }
            onRowClick={(c) => navigate(`/education/support/${c.id}`)}
            rowKey={(c) => c.id}
          />

          {!loading && pagination && cases.length > 0 && (
            <div className="mt-4">
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                totalItems={pagination.total}
                itemsPerPage={10}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      </Card>

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title="Delete Support Case"
        message={deleteConfirm ? `Delete the support case for ${toTitleCase(deleteConfirm.name)}?` : ''}
        consequence="This action cannot be undone."
        isLoading={deleting}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
