import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiLock } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import Select from '@/components/ui/Select';
import StatusBadge from '@/components/ui/StatusBadge';
import Badge from '@/components/ui/Badge';
import Table from '@/components/ui/Table';
import RowActions from '@/components/ui/RowActions';
import { AvatarStack } from '@/components/ui/Avatar';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Alert from '@/components/ui/Alert';
import { TableColumn } from '@/types';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { getDisputeCases, deleteDisputeCase, IDisputeCase } from '@/services/counsellingService';

const TYPES = ['family', 'marriage', 'divorce', 'community', 'inheritance', 'other'];
const STATUSES = ['registered', 'mediation', 'resolved', 'referred', 'closed'];

export default function DisputesList() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<IDisputeCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteCaseName, setDeleteCaseName] = useState<string>('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const itemsPerPage = 10;

  const fetchCases = useCallback(async (page: number) => {
    try {
      setLoading(true);
      const response = await getDisputeCases(page, itemsPerPage, selectedType, selectedStatus, search);
      setCases(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
      setCurrentPage(response.pagination.page);
      setAccessDenied(false);
    } catch (error: any) {
      if (error.response?.status === 403) {
        setAccessDenied(true);
        setCases([]);
      } else {
        console.error('Failed to fetch cases:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedType, selectedStatus, search, itemsPerPage]);

  useEffect(() => {
    fetchCases(1);
  }, [selectedType, selectedStatus, search, fetchCases]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await deleteDisputeCase(deleteId);
      setConfirmDelete(false);
      setDeleteId(null);
      setDeleteCaseName('');
      toast.success('Dispute case deleted');
      fetchCases(currentPage);
    } catch (error) {
      console.error('Failed to delete case:', error);
      toast.error(getFriendlyError(error, "Couldn't delete dispute case. Try again in a moment."));
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePageChange = (page: number) => {
    fetchCases(page);
  };

  if (accessDenied) {
    return (
      <div className="space-y-4">
        <PageHeader title="Maslahat (Dispute Resolution)" />
        <Card className="flex flex-col items-center py-10 text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FDECEA] text-[#B3261E] dark:bg-red-500/15 dark:text-red-300">
            <FiLock className="h-6 w-6" />
          </span>
          <Alert tone="warning" className="max-w-md text-left">
            Access to dispute cases requires special permission. Please contact your administrator to request access.
          </Alert>
        </Card>
      </div>
    );
  }

  const columns: TableColumn<IDisputeCase>[] = [
    { key: 'caseNo', label: 'Case', render: (v, r) => (
        <button onClick={() => navigate(`/maslahat/${r.id}`)} className="font-semibold text-primary-700 hover:underline dark:text-brand-lime">{v}</button>
      ) },
    { key: 'type', label: 'Type', render: (v) => <Badge variant="info" className="capitalize">{v}</Badge> },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'parties', label: 'Parties', render: (v) => (v?.length ? <div className="flex items-center gap-2"><AvatarStack items={v.map((n: string) => ({ name: n }))} max={3} /><span className="text-xs">{v.join(', ')}</span></div> : '-') },
    { key: 'mediators', label: 'Mediators', render: (v) => (v && v.length > 0 ? <div className="flex items-center gap-2"><AvatarStack items={v.map((n: string) => ({ name: n }))} max={3} /><span className="text-xs">{v.join(', ')}</span></div> : '-') },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, caseRecord) => (
        <RowActions
          onView={() => navigate(`/maslahat/${caseRecord.id}`)}
          onEdit={() => navigate(`/maslahat/${caseRecord.id}/edit`)}
          onDelete={() => {
            setDeleteId(caseRecord.id);
            setDeleteCaseName(caseRecord.caseNo);
            setConfirmDelete(true);
          }}
          ariaLabels={{ view: 'View dispute case', edit: 'Edit dispute case', delete: 'Delete dispute case' }}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Maslahat - dispute cases"
        description={`${totalItems} cases found`}
        actions={
          <Button onClick={() => navigate('/maslahat/create')}>
            <FiPlus size={14} />
            New case
          </Button>
        }
      />

      <Card padding="none" className="overflow-visible">
        <FilterBar search={{ value: search, onChange: setSearch, placeholder: 'Search cases' }}>
          <div className="w-44">
            <Select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              options={[
                { value: '', label: 'All Types' },
                ...TYPES.map((x) => ({ value: x, label: x.charAt(0).toUpperCase() + x.slice(1) })),
              ]}
            />
          </div>
          <div className="w-44">
            <Select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              options={[
                { value: '', label: 'All Statuses' },
                ...STATUSES.map((x) => ({ value: x, label: x.charAt(0).toUpperCase() + x.slice(1) })),
              ]}
            />
          </div>
        </FilterBar>

        <div className="p-3.5">
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : cases.length === 0 ? (
            <EmptyState
              title="No dispute cases found"
              description="Try adjusting your search or filters, or create a new case."
              action={{ label: 'Create First Case', onClick: () => navigate('/maslahat/create') }}
            />
          ) : (
            <>
              <Table columns={columns} data={cases} showExport={false} />

              {totalPages > 1 && (
                <div className="mt-3.5">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    onPageChange={handlePageChange}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete dispute case?"
        message={`Delete dispute case ${deleteCaseName}?`}
        consequence="This action is irreversible. All mediation records and case details will be permanently deleted."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => {
          setConfirmDelete(false);
          setDeleteId(null);
          setDeleteCaseName('');
        }}
      />
    </div>
  );
}
