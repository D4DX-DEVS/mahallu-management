import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiTrash2, FiFileText, FiClock, FiCheckCircle, FiX, FiPlus } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { marriageAssistanceService, MarriageAssistance } from '@/services/marriageAssistanceService';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from '@/store/toastStore';

export default function MarriageAssistanceList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
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
      setError(err.response?.data?.message || 'Failed to fetch marriage assistance records');
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
      toast.success('Record deleted successfully');
      setDeleteConfirm(null);
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to delete record';
      toast.error(message);
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

  const getStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      requested: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  };

  const columns: TableColumn<MarriageAssistance>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    {
      key: 'memberId',
      label: 'Member/Family',
      render: (_, row) => {
        const member = typeof row.memberId === 'object' ? row.memberId?.name : '—';
        const family = typeof row.familyId === 'object' ? row.familyId?.houseName : '—';
        return member !== '—' ? member : family;
      },
    },
    {
      key: 'type',
      label: 'Type',
      render: (type) => getTypeLabel(type as string),
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (amount) => (amount ? `₹${amount.toLocaleString()}` : '—'),
    },
    {
      key: 'status',
      label: 'Status',
      render: (status) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(status as string)}`}>
          {status}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => {
        const label = typeof row.memberId === 'object' ? row.memberId?.name :
                      typeof row.familyId === 'object' ? row.familyId?.houseName : 'Record';
        return (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {row.type === 'premarital_counselling' && (
              <button
                onClick={() => navigate('/counselling/create')}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-green-600 dark:text-green-400"
                title="Create Counselling Case"
              >
                <FiPlus className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => handleDeleteClick(row.id, label)}
              className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600 dark:text-red-400"
              title="Delete"
            >
              <FiTrash2 className="h-4 w-4" />
            </button>
          </div>
        );
      },
    },
  ];

  const stats = [
    {
      title: 'Total Requests',
      value: pagination?.total || records.length,
      icon: <FiFileText className="h-5 w-5" />,
    },
    {
      title: 'Pending',
      value: records.filter((r) => r.status === 'requested').length,
      icon: <FiClock className="h-5 w-5" />,
    },
    {
      title: 'Completed',
      value: records.filter((r) => r.status === 'completed').length,
      icon: <FiCheckCircle className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Marriage Assistance</h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Manage marriage assistance requests</p>
          </div>
          <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Marriage Assistance' }]} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>
      </div>

      <Card>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onFilterClick={() => setIsFilterVisible(!isFilterVisible)}
          isFilterVisible={isFilterVisible}
          hasFilters={true}
          onRefresh={fetchRecords}
          actionButtons={
            <div className="flex gap-2">
              <Link to="/registers/marriageable">
                <Button variant="outline" size="md">View Marriageable Register</Button>
              </Link>
              <Link to="/registrations/marriage-assistance/create">
                <Button size="md">+ New Request</Button>
              </Link>
            </div>
          }
        />

        {isFilterVisible && (
          <div className="relative flex flex-wrap items-center gap-4 mb-6 p-4 border border-gray-200 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700">
            <button
              onClick={() => setIsFilterVisible(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <FiX className="h-4 w-4" />
            </button>
            <div className="w-40">
              <Select
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
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchRecords} className="mt-4" variant="outline">
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
          <div className="mt-4">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              onPageChange={(page) => setCurrentPage(page)}
            />
          </div>
        )}
      </Card>

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title="Delete Record"
        message={deleteConfirm ? `Delete marriage assistance record for ${deleteConfirm.label}?` : ''}
        consequence="This action cannot be undone."
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
