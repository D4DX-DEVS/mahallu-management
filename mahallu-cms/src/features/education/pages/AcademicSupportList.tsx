import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';
import ExpandableSearch from '@/components/ui/ExpandableSearch';
import Card from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';
import { PageSkeleton } from '@/components/ui/Skeleton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
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
import SortableTh from '@/components/ui/SortableTh';
import { useSortableRows } from '@/hooks/useSortableRows';

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

  /* Student, Type and Status render a looked-up label, so they sort on that
     label rather than on the id or enum behind it. */
  const {
    rows: sortedCases,
    sort,
    toggleSort,
  } = useSortableRows(cases, null, {
    student: (row) => memberName(row.memberId),
    type: (row) => supportCaseTypeLabel(row.type),
    status: (row) => supportCaseStatusLabel(row.status),
  });

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

          {loading ? (
            <PageSkeleton variant="section" />
          ) : cases.length === 0 ? (
            <EmptyState
              title="No support cases found"
              description={
                search || type || status
                  ? 'Try adjusting your search or filters'
                  : 'Create your first support case to get started'
              }
              action={
                !search && !type && !status
                  ? { label: 'New Case', onClick: () => navigate('/education/support/create') }
                  : undefined
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <SortableTh sortKey="student" sort={sort} onSort={toggleSort}>
                        Student
                      </SortableTh>
                      <SortableTh
                        sortKey="type"
                        sort={sort}
                        onSort={toggleSort}
                        responsiveClassName="hidden sm:table-cell"
                      >
                        Type
                      </SortableTh>
                      <SortableTh
                        sortKey="description"
                        sort={sort}
                        onSort={toggleSort}
                        responsiveClassName="hidden md:table-cell"
                      >
                        Description
                      </SortableTh>
                      <SortableTh
                        sortKey="mentorName"
                        sort={sort}
                        onSort={toggleSort}
                        responsiveClassName="hidden lg:table-cell"
                      >
                        Mentor
                      </SortableTh>
                      <SortableTh sortKey="status" sort={sort} onSort={toggleSort}>
                        Status
                      </SortableTh>
                      <th className="px-3 py-2.5 text-left text-label font-semibold text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCases.map((c) => (
                      <tr key={c.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="py-2 font-medium">{toTitleCase(memberName(c.memberId))}</td>
                        <td className="py-2 hidden sm:table-cell text-xs">{supportCaseTypeLabel(c.type)}</td>
                        <td className="py-2 hidden md:table-cell text-xs">
                          <button
                            onClick={() => navigate(`/education/support/${c.id}`)}
                            className="text-blue-600 hover:underline"
                          >
                            {c.description}
                          </button>
                        </td>
                        <td className="py-2 hidden lg:table-cell text-xs">
                          {c.mentorName ? toTitleCase(c.mentorName) : '—'}
                        </td>
                        <td className="py-2">
                          <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">
                            {supportCaseStatusLabel(c.status)}
                          </span>
                        </td>
                        <td className="py-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => navigate(`/education/support/${c.id}`)}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              View
                            </button>
                            <button
                              onClick={() => setDeleteConfirm({ id: c.id, name: memberName(c.memberId) })}
                              className="text-xs text-red-600 hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pagination && (
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
            </>
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
