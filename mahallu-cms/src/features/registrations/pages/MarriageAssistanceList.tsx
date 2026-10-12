import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiFileText, FiClock, FiCheckCircle, FiPlus, FiRefreshCw } from 'react-icons/fi';
import RowActions from '@/components/ui/RowActions';
import { PersonCell } from '@/components/ui/Avatar';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Pagination from '@/components/ui/Pagination';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import StatusBadge from '@/components/ui/StatusBadge';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { marriageAssistanceService, MarriageAssistance } from '@/services/marriageAssistanceService';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { shareViz, waitingViz } from '@/utils/statSeries';

export default function MarriageAssistanceList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [records, setRecords] = useState<MarriageAssistance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; label: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    fetchRecords();
  }, [debouncedSearch, typeFilter, statusFilter, currentPage]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {
        page: currentPage,
        limit: itemsPerPage,
      };
      if (debouncedSearch) {
        params.search = debouncedSearch;
      }
      if (typeFilter !== 'all') {
        params.type = typeFilter;
      }
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const result = await marriageAssistanceService.getAll(params);
      setRecords(result.data);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load marriage assistance records. Refresh the page or try again."));
      console.error('Error fetching records:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id: string, label: string) => {
    setDeleteConfirm({ id, label });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;

    setIsDeleting(true);
    try {
      await marriageAssistanceService.delete(deleteConfirm.id);
      await fetchRecords();
      toast.success('Record deleted');
      setDeleteConfirm(null);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't delete record. Try again in a moment."));
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirm(null);
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      proposal_support: 'Proposal Support',
      financial_assistance: 'Financial Assistance',
      premarital_counselling: 'Premarital Counselling',
    };
    return labels[type] || type;
  };

  const columns: TableColumn<MarriageAssistance>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    {
      key: 'memberId',
      label: 'Member/Family',
      render: (_, row) => {
        const member = typeof row.memberId === 'object' ? row.memberId?.name : '—';
        const family = typeof row.familyId === 'object' ? row.familyId?.houseName : '—';
        const name = member !== '—' ? member : family;
        const photo = typeof row.memberId === 'object' ? (row.memberId as { photoUrl?: string } | null)?.photoUrl : undefined;
        return <PersonCell name={name === '—' ? '' : name} src={photo} />;
      },
    },
    {
      key: 'type',
      label: 'Type',
      render: (type) => <StatusBadge status={type as string} label={getTypeLabel(type as string)} tone="neutral" dot={false} />,
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (amount) => (amount ? `₹${amount.toLocaleString()}` : '—'),
    },
    {
      key: 'status',
      label: 'Status',
      render: (status) => <StatusBadge status={status as string} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      hideable: false,
      render: (_, row) => {
        const label = typeof row.memberId === 'object' ? row.memberId?.name :
                      typeof row.familyId === 'object' ? row.familyId?.houseName : 'Record';
        return (
          <RowActions
            onDelete={() => handleDeleteClick(row.id, label)}
            ariaLabels={{ delete: 'Delete record' }}
            extra={[
              {
                label: 'Create counselling case',
                icon: <FiPlus />,
                onClick: () => navigate('/counselling/create'),
                show: row.type === 'premarital_counselling',
              },
            ]}
          />
        );
      },
    },
  ];

  const stats = [
    {
      title: 'Total Requests',
      value: pagination?.total || records.length,
      icon: <FiFileText className="h-[17px] w-[17px]" />,
      tone: 'green' as const,
    },
    {
      title: 'Pending',
      value: records.filter((r) => r.status === 'requested').length, viz: waitingViz(records.filter((r) => r.status === 'requested').length), summary: `Pending: ${records.filter((r) => r.status === 'requested').length} of ${records.length}`,
      icon: <FiClock className="h-[17px] w-[17px]" />,
    },
    {
      title: 'Completed',
      value: records.filter((r) => r.status === 'completed').length, viz: shareViz(records.filter((r) => r.status === 'completed').length, records.length), summary: `Completed: ${records.filter((r) => r.status === 'completed').length} of ${records.length}`,
      icon: <FiCheckCircle className="h-[17px] w-[17px]" />,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Marriage assistance"
        description="Manage marriage assistance requests"
        actions={
          <>
            <Link to="/registers/marriageable">
              <Button variant="secondary">View marriageable register</Button>
            </Link>
            <Link to="/registrations/marriage-assistance/create">
              <Button>+ New request</Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((stat, index) => (
          <StatCard key={index} variant="inline" {...stat} />
        ))}
      </div>

      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search requests' }}
          actions={
            <Button variant="secondary" iconOnly aria-label="Refresh list" onClick={fetchRecords}>
              <FiRefreshCw className="h-3.5 w-3.5" />
            </Button>
          }
        >
          <div className="w-44">
            <Select
              aria-label="Filter by type"
              options={[
                { value: 'all', label: 'All Types' },
                { value: 'proposal_support', label: 'Proposal Support' },
                { value: 'financial_assistance', label: 'Financial Assistance' },
                { value: 'premarital_counselling', label: 'Premarital Counselling' },
              ]}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            />
          </div>
          <div className="w-40">
            <Select
              aria-label="Filter by status"
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'requested', label: 'Requested' },
                { value: 'approved', label: 'Approved' },
                { value: 'completed', label: 'Completed' },
              ]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>
        </FilterBar>

        <div className="p-3.5">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchRecords} className="mt-4" variant="secondary">
              Retry
            </Button>
          </div>
        ) : (
          <Table
            columns={columns}
            data={records}
            emptyMessage="No marriage assistance records found"
            showExport={false}
          />
        )}

        {pagination && (
          <div className="mt-3.5">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              onPageChange={(page) => setCurrentPage(page)}
            />
          </div>
        )}
        </div>
      </Card>

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title="Delete record?"
        message={deleteConfirm ? `Delete marriage assistance record for ${deleteConfirm.label}?` : ''}
        consequence="This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isLoading={isDeleting}
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}
