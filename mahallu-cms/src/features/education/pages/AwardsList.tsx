import { useState, useEffect, useCallback } from 'react';
import { FiTrash2 } from 'react-icons/fi';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import ActionsMenu from '@/components/ui/ActionsMenu';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
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
import { TableColumn } from '@/types';

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

  const columns: TableColumn<ScholarshipAward>[] = [
    {
      key: 'student',
      label: 'Student',
      render: (_v, award) => toTitleCase(memberName(award.memberId)),
    },
    {
      key: 'awardedDate',
      label: 'Awarded Date',
      priority: 'secondary',
      render: (_v, award) => new Date(award.awardedDate).toLocaleDateString(),
    },
    {
      key: 'amount',
      label: 'Amount',
      priority: 'secondary',
      align: 'right',
      render: (_v, award) => '₹' + award.amount,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_v, award) => (
        <span className="rounded bg-muted px-2 py-1 text-xs">{awardStatusLabel(award.status)}</span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      sortable: false,
      render: (_v, award) => (
        <ActionsMenu
          label={'Actions for ' + toTitleCase(memberName(award.memberId))}
          items={[
            {
              label: 'Delete',
              icon: <FiTrash2 className="h-4 w-4" />,
              onClick: () => setDeleteConfirm({ id: award.id, name: memberName(award.memberId) }),
              variant: 'danger' as const,
            },
          ]}
        />
      ),
    },
  ];

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

          <Table
            columns={columns}
            data={awards}
            isLoading={loading}
            entity="awards"
            emptyVariant={status ? 'no-results' : 'empty'}
            emptyAction={
              !status
                ? {
                    label: 'New Award',
                    onClick: () => navigate(`/education/scholarships/${scholarshipId}/awards/create`),
                  }
                : undefined
            }
            rowKey={(award) => award.id}
          />

          {!loading && pagination && awards.length > 0 && (
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
