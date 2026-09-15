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
  Scholarship,
  SCHOLARSHIP_STATUS_OPTIONS,
  scholarshipStatusLabel,
} from '@/services/scholarshipService';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';
import SortableTh from '@/components/ui/SortableTh';
import { useSortableRows } from '@/hooks/useSortableRows';

export default function ScholarshipsList() {
  const navigate = useNavigate();
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* Status renders a label, so it sorts on the label rather than the enum. */
  const {
    rows: sortedScholarships,
    sort,
    toggleSort,
  } = useSortableRows(scholarships, null, {
    status: (row) => scholarshipStatusLabel(row.status),
  });

  const fetchScholarships = useCallback(async () => {
    setLoading(true);
    try {
      const { data, pagination } = await scholarshipService.getScholarships({
        page: currentPage,
        limit: 10,
        search: search || undefined,
        status: status || undefined,
      });
      setScholarships(data);
      setPagination(pagination);
    } catch (error) {
      console.error("Couldn't load scholarships:", error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, search, status]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, status]);

  useEffect(() => {
    fetchScholarships();
  }, [fetchScholarships]);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      setDeleting(true);
      await scholarshipService.deleteScholarship(deleteConfirm.id);
      setDeleteConfirm(null);
      toast.success(`"${toTitleCase(deleteConfirm.name)}" deleted`);
      await fetchScholarships();
    } catch (error: any) {
      toast.error(errorMessage(error, { action: 'delete scholarship' }));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <PageHeader title="Scholarships" />
        <Button onClick={() => navigate('/education/scholarships/create')}>New Scholarship</Button>
      </div>

      <Card>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ExpandableSearch
              value={search}
              onChange={(value) => setSearch(value)}
              entity="scholarships"
            />
            <select
              aria-label="Filter"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            >
              <option value="">All statuses</option>
              {SCHOLARSHIP_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <Button onClick={() => fetchScholarships()}>Refresh</Button>
          </div>

          {loading ? (
            <PageSkeleton variant="section" />
          ) : scholarships.length === 0 ? (
            <EmptyState
              title="No scholarships found"
              description={
                search || status
                  ? 'Try adjusting your search or filters'
                  : 'Create your first scholarship to get started'
              }
              action={
                !search && !status
                  ? { label: 'New Scholarship', onClick: () => navigate('/education/scholarships/create') }
                  : undefined
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <SortableTh sortKey="name" sort={sort} onSort={toggleSort}>
                        Name
                      </SortableTh>
                      <SortableTh
                        sortKey="academicYear"
                        sort={sort}
                        onSort={toggleSort}
                        responsiveClassName="hidden sm:table-cell"
                      >
                        Year
                      </SortableTh>
                      <SortableTh
                        sortKey="amount"
                        sort={sort}
                        onSort={toggleSort}
                        responsiveClassName="hidden md:table-cell"
                      >
                        Amount
                      </SortableTh>
                      <SortableTh
                        sortKey="criteria"
                        sort={sort}
                        onSort={toggleSort}
                        responsiveClassName="hidden lg:table-cell"
                      >
                        Criteria
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
                    {sortedScholarships.map((s) => (
                      <tr
                        key={s.id}
                        className="border-b hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        onClick={() => navigate(`/education/scholarships/${s.id}`)}
                      >
                        <td className="py-2 font-medium">
                          <button
                            onClick={() => navigate(`/education/scholarships/${s.id}`)}
                            className="text-blue-600 hover:underline"
                          >
                            {toTitleCase(s.name)}
                          </button>
                        </td>
                        <td className="py-2 hidden sm:table-cell">{s.academicYear}</td>
                        <td className="py-2 hidden md:table-cell">₹{s.amount}</td>
                        <td className="py-2 hidden lg:table-cell text-xs">{s.criteria || '—'}</td>
                        <td className="py-2">
                          <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">
                            {scholarshipStatusLabel(s.status)}
                          </span>
                        </td>
                        <td className="py-2">
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/education/scholarships/${s.id}`);
                              }}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              View
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirm({ id: s.id, name: s.name });
                              }}
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
        title="Delete Scholarship"
        message={deleteConfirm ? `Are you sure you want to delete "${toTitleCase(deleteConfirm.name)}"?` : ''}
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
