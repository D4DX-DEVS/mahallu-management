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
import { PersonCell } from '@/components/ui/Avatar';
import EmptyState from '@/components/ui/EmptyState';
import Alert from '@/components/ui/Alert';
import { TableColumn } from '@/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { getCounsellingCases, deleteCounsellingCase, ICounsellingCase } from '@/services/counsellingService';

const CATEGORIES = ['marriage', 'family', 'adolescent', 'education', 'parenting', 'behaviour', 'career'];
const STATUSES = ['open', 'in_progress', 'follow_up', 'closed'];

export default function CounsellingList() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<ICounsellingCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteCaseName, setDeleteCaseName] = useState<string>('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const itemsPerPage = 10;

  const fetchCases = useCallback(async (page: number) => {
    try {
      setLoading(true);
      const response = await getCounsellingCases(page, itemsPerPage, selectedCategory, selectedStatus, search);
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
  }, [selectedCategory, selectedStatus, search, itemsPerPage]);

  useEffect(() => {
    fetchCases(1);
  }, [selectedCategory, selectedStatus, search, fetchCases]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await deleteCounsellingCase(deleteId);
      setConfirmDelete(false);
      setDeleteId(null);
      setDeleteCaseName('');
      toast.success('Counselling case deleted');
      fetchCases(currentPage);
    } catch (error) {
      console.error('Failed to delete case:', error);
      toast.error(getFriendlyError(error, "Couldn't delete counselling case. Try again in a moment."));
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
        <PageHeader title="Counselling cases" />
        <Card className="flex flex-col items-center py-10 text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FDECEA] text-[#B3261E] dark:bg-red-500/15 dark:text-red-300">
            <FiLock className="h-6 w-6" />
          </span>
          <Alert tone="warning" className="max-w-md text-left">
            Access to counselling records requires special permission. Please contact your administrator to request access.
          </Alert>
        </Card>
      </div>
    );
  }

  const columns: TableColumn<ICounsellingCase>[] = [
    { key: 'caseNo', label: 'Case', render: (v, r) => (
        <button onClick={() => navigate(`/counselling/${r.id}`)} className="font-semibold text-primary-700 hover:underline dark:text-brand-lime">{v}</button>
      ) },
    { key: 'category', label: 'Category', render: (v) => <Badge variant="info" className="capitalize">{v}</Badge> },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} label={String(v).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())} /> },
    { key: 'counsellorName', label: 'Counsellor', render: (v) => (v ? <PersonCell name={v} size={24} /> : '-') },
    { key: 'clientName', label: 'Client', render: (_, r) => (r.clientName ? <PersonCell name={r.clientName} size={24} /> : r.clientMemberId ? 'Member ID' : 'Anonymous') },
    { key: 'appointmentDate', label: 'Appointment', render: (v) => new Date(v).toLocaleDateString() },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, caseRecord) => (
        <RowActions
          onView={() => navigate(`/counselling/${caseRecord.id}`)}
          onEdit={() => navigate(`/counselling/${caseRecord.id}/edit`)}
          onDelete={() => {
            setDeleteId(caseRecord.id);
            setDeleteCaseName(caseRecord.caseNo);
            setConfirmDelete(true);
          }}
          ariaLabels={{ view: 'View counselling case', edit: 'Edit counselling case', delete: 'Delete counselling case' }}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Counselling cases"
        description={`${totalItems} cases found`}
        actions={
          <Button onClick={() => navigate('/counselling/create')}>
            <FiPlus size={14} />
            New case
          </Button>
        }
      />

      <Card padding="none" className="overflow-visible">
        <FilterBar search={{ value: search, onChange: setSearch, placeholder: 'Search cases' }}>
          <div className="w-44">
            <Select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              options={[
                { value: '', label: 'All Categories' },
                ...CATEGORIES.map((cat) => ({ value: cat, label: cat.charAt(0).toUpperCase() + cat.slice(1) })),
              ]}
            />
          </div>
          <div className="w-44">
            <Select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              options={[
                { value: '', label: 'All Statuses' },
                ...STATUSES.map((sts) => ({ value: sts, label: sts.replace(/_/g, ' ').charAt(0).toUpperCase() + sts.slice(1) })),
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
              title="No counselling cases found"
              description="Try adjusting your search or filters, or create a new case."
              action={{ label: 'Create First Case', onClick: () => navigate('/counselling/create') }}
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
        title="Delete counselling case?"
        message={`Delete counselling case ${deleteCaseName}?`}
        consequence="This action is irreversible. All session notes and case history will be permanently deleted."
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
