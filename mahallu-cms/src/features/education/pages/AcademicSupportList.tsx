import { useState, useEffect, useCallback } from 'react';
import { FiEye, FiTrash2 } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { FiPlus } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import TableCard from '@/components/ui/TableCard';
import TableToolbar from '@/components/ui/TableToolbar';
import FilterPanel from '@/components/ui/FilterPanel';
import Select from '@/components/ui/Select';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
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
import { useDebounce } from '@/hooks/useDebounce';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
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
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const debouncedSearch = useDebounce(search, 500);
  const activeFilterCount = (type ? 1 : 0) + (status ? 1 : 0);
  const isFiltered = Boolean(debouncedSearch) || activeFilterCount > 0;

  const columns: TableColumn<AcademicSupportCase>[] = [
    {
      key: 'student',
      label: 'Student',
      sortable: false,
      width: '16rem',
      render: (_v, c) => <span className="font-medium text-foreground">{toTitleCase(memberName(c.memberId))}</span>,
    },
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      priority: 'secondary',
      width: '10rem',
      render: (_v, c) => supportCaseTypeLabel(c.type),
    },
    { key: 'description', label: 'Description', sortable: false, priority: 'tertiary', width: '18rem' },
    {
      key: 'mentorName',
      label: 'Mentor',
      sortable: true,
      priority: 'tertiary',
      width: '12rem',
      render: (_v, c) => (c.mentorName ? toTitleCase(c.mentorName) : '—'),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      width: '8rem',
      render: (_v, c) => <StatusBadge status={c.status} label={supportCaseStatusLabel(c.status)} />,
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      sortable: false,
      width: '6.5rem',
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
    setError(null);
    try {
      const { data, pagination } = await scholarshipService.getSupportCases({
        page: currentPage,
        limit: itemsPerPage,
        type: type || undefined,
        status: status || undefined,
        search: debouncedSearch || undefined,
      });
      setCases(data);
      setPagination(pagination);
    } catch (err) {
      setError(loadErrorMessage(err, 'academic support cases'));
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, type, status, debouncedSearch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [type, status, debouncedSearch]);

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
    <>
      <PageHeader
        title="Academic support"
        description="Mentoring and support cases for students."
        actions={
          <Button icon={<FiPlus />} collapseLabel onClick={() => navigate('/education/support/create')}>
            New case
          </Button>
        }
      />

      <TableCard>
        <TableToolbar
          searchQuery={search}
          onSearchChange={setSearch}
          searchEntity="academic support records"
          onFilterClick={() => setIsFilterVisible((open) => !open)}
          isFilterVisible={isFilterVisible}
          hasFilters
          activeFilterCount={activeFilterCount}
          onRefresh={fetchCases}
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-52">
              <Select
                label="Type"
                options={[{ value: '', label: 'All types' }, ...SUPPORT_CASE_TYPE_OPTIONS]}
                value={type}
                onChange={(e) => setType(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-52">
              <Select
                label="Status"
                options={[{ value: '', label: 'All statuses' }, ...SUPPORT_CASE_STATUS_OPTIONS]}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              />
            </div>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                onClick={() => {
                  setType('');
                  setStatus('');
                }}
              >
                Clear filters
              </Button>
            )}
          </FilterPanel>
        )}

        {error ? (
          <EmptyState variant="error" entity="support cases" description={error} action={{ label: 'Try again', onClick: fetchCases }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={cases}
              isLoading={loading}
              entity="support cases"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? { label: 'Clear filters', onClick: () => { setSearch(''); setType(''); setStatus(''); } }
                  : { label: 'Add case', onClick: () => navigate('/education/support/create') }
              }
              onRowClick={(c) => navigate(`/education/support/${c.id}`)}
              rowKey={(c) => c.id}
            />

            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="support cases"
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

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title={deleteConfirm ? `Delete the case for ${toTitleCase(deleteConfirm.name)}?` : 'Delete this case?'}
        message="This permanently removes the support case and cannot be undone."
        isLoading={deleting}
        variant="danger"
        confirmLabel="Delete case"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </>
  );
}
