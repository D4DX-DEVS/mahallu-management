import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import Select from '@/components/ui/Select';
import StatusBadge from '@/components/ui/StatusBadge';
import Table from '@/components/ui/Table';
import RowActions from '@/components/ui/RowActions';
import { PersonCell } from '@/components/ui/Avatar';
import { FiRefreshCw } from 'react-icons/fi';
import { TableColumn } from '@/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
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
      toast.error(getFriendlyError(error, "Couldn't delete award. Try again in a moment."));
    } finally {
      setDeleting(false);
    }
  };

  const columns: TableColumn<ScholarshipAward>[] = [
    { key: 'memberId', label: 'Student', render: (_, a) => <PersonCell name={memberName(a.memberId)} size={32} /> },
    { key: 'awardedDate', label: 'Awarded Date', render: (v) => <span className="text-xs">{new Date(v).toLocaleDateString()}</span> },
    { key: 'amount', label: 'Amount', render: (v) => `₹${v}` },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} label={awardStatusLabel(v)} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, a) => (
        <RowActions
          onDelete={() => setDeleteConfirm({ id: a.id, name: memberName(a.memberId) })}
          deleteLabel="Delete"
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Scholarship awards"
        description={scholarship ? `${scholarship.name} (${scholarship.academicYear})` : undefined}
        actions={
          <Button onClick={() => navigate(`/education/scholarships/${scholarshipId}/awards/create`)}>+ New award</Button>
        }
      />

      <Card padding="none" className="overflow-visible">
        <FilterBar
          actions={
            <Button variant="secondary" iconOnly aria-label="Refresh list" onClick={() => fetchAwards()}>
              <FiRefreshCw className="h-3.5 w-3.5" />
            </Button>
          }
        >
          <div className="w-44">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[{ value: '', label: 'All statuses' }, ...AWARD_STATUS_OPTIONS]}
            />
          </div>
        </FilterBar>

        <div className="p-3.5">
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : awards.length === 0 ? (
            <EmptyState
              title="No awards found"
              description={status ? "Try adjusting your filters" : "Create your first award to get started"}
              action={!status ? { label: 'New Award', onClick: () => navigate(`/education/scholarships/${scholarshipId}/awards/create`) } : undefined}
            />
          ) : (
            <>
              <Table columns={columns} data={awards} showExport={false} />

              {pagination && (
                <div className="mt-3.5">
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
        title="Delete award?"
        message={deleteConfirm ? `Delete the award for ${deleteConfirm.name}?` : ''}
        consequence="This cannot be undone."
        isLoading={deleting}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
