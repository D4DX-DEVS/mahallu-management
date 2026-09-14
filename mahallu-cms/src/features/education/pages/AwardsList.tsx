import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';
import { PageSkeleton } from '@/components/ui/Skeleton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import { toast } from '@/store/toastStore';
import {
  scholarshipService,
  ScholarshipAward,
  AWARD_STATUS_OPTIONS,
  awardStatusLabel,
  memberName,
} from '@/services/scholarshipService';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';
import SortableTh from '@/components/ui/SortableTh';
import { useSortableRows } from '@/hooks/useSortableRows';

export default function AwardsList() {
  const navigate = useNavigate();
  const { scholarshipId } = useParams<{ scholarshipId: string }>();
  const [awards, setAwards] = useState<ScholarshipAward[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [scholarship, setScholarship] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* Student shows a looked-up name and Status a label, so both sort on what
     the cell reads rather than on the id or enum behind it. */
  const {
    rows: sortedAwards,
    sort,
    toggleSort,
  } = useSortableRows(awards, null, {
    student: (row) => memberName(row.memberId),
    status: (row) => awardStatusLabel(row.status),
  });

  const fetchAwards = useCallback(async () => {
    if (!scholarshipId) return;
    setLoading(true);
    try {
      const [awardsData, scholData] = await Promise.all([
        scholarshipService.getAwardsByScholarship(scholarshipId, {
          page: currentPage,
          limit: 10,
          status: status || undefined,
        }),
        scholarshipService.getScholarship(scholarshipId),
      ]);
      setAwards(awardsData.data);
      setPagination(awardsData.pagination);
      setScholarship(scholData);
    } catch (error) {
      console.error("Couldn't load:", error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, status, scholarshipId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [status]);

  useEffect(() => {
    fetchAwards();
  }, [fetchAwards]);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      setDeleting(true);
      await scholarshipService.deleteAward(deleteConfirm.id);
      setDeleteConfirm(null);
      toast.success(`Award for ${toTitleCase(deleteConfirm.name)} deleted`);
      await fetchAwards();
    } catch (error: any) {
      toast.error(errorMessage(error, { action: 'delete award' }));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <PageHeader title="Scholarship Awards" />
          {scholarship && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              <span>{toTitleCase(scholarship.name)}</span> ({scholarship.academicYear})
            </p>
          )}
        </div>
        <Button onClick={() => navigate(`/education/scholarships/${scholarshipId}/awards/create`)}>
          New Award
        </Button>
      </div>

      <Card>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <select
              aria-label="Filter"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            >
              <option value="">All statuses</option>
              {AWARD_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <Button onClick={() => fetchAwards()}>Refresh</Button>
          </div>

          {loading ? (
            <PageSkeleton variant="section" />
          ) : awards.length === 0 ? (
            <EmptyState
              title="No awards found"
              description={status ? 'Try adjusting your filters' : 'Create your first award to get started'}
              action={
                !status
                  ? {
                      label: 'New Award',
                      onClick: () => navigate(`/education/scholarships/${scholarshipId}/awards/create`),
                    }
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
                        sortKey="awardedDate"
                        sort={sort}
                        onSort={toggleSort}
                        responsiveClassName="hidden sm:table-cell"
                      >
                        Awarded Date
                      </SortableTh>
                      <SortableTh
                        sortKey="amount"
                        sort={sort}
                        onSort={toggleSort}
                        responsiveClassName="hidden md:table-cell"
                      >
                        Amount
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
                    {sortedAwards.map((award) => (
                      <tr key={award.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="py-2 font-medium">{toTitleCase(memberName(award.memberId))}</td>
                        <td className="py-2 hidden sm:table-cell text-xs">
                          {new Date(award.awardedDate).toLocaleDateString()}
                        </td>
                        <td className="py-2 hidden md:table-cell">₹{award.amount}</td>
                        <td className="py-2">
                          <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">
                            {awardStatusLabel(award.status)}
                          </span>
                        </td>
                        <td className="py-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                setDeleteConfirm({ id: award.id, name: memberName(award.memberId) })
                              }
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
        title="Delete Award"
        message={deleteConfirm ? `Delete the award for ${toTitleCase(deleteConfirm.name)}?` : ''}
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
