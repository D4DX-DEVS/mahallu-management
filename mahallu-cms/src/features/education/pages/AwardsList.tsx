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
      console.error('Failed to fetch:', error);
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
      toast.success(`Award for ${deleteConfirm.name} deleted`);
      await fetchAwards();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete award');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Scholarship Awards</h1>
          {scholarship && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {scholarship.name} ({scholarship.academicYear})
            </p>
          )}
        </div>
        <Button onClick={() => navigate(`/education/scholarships/${scholarshipId}/awards/create`)}>
          New Award
        </Button>
      </div>

      <Card>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <select
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
              description={status ? "Try adjusting your filters" : "Create your first award to get started"}
              action={!status ? { label: 'New Award', onClick: () => navigate(`/education/scholarships/${scholarshipId}/awards/create`) } : undefined}
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Student</th>
                      <th className="text-left py-2 hidden sm:table-cell">Awarded Date</th>
                      <th className="text-left py-2 hidden md:table-cell">Amount</th>
                      <th className="text-left py-2">Status</th>
                      <th className="text-left py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {awards.map((award) => (
                      <tr key={award.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="py-2 font-medium">{memberName(award.memberId)}</td>
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
                              onClick={() => setDeleteConfirm({ id: award.id, name: memberName(award.memberId) })}
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
                <div className="mt-6">
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
        message={deleteConfirm ? `Delete the award for ${deleteConfirm.name}?` : ''}
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
