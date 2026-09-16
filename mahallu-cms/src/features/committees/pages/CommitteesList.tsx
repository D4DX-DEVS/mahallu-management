import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiCalendar, FiCheckCircle, FiEdit2, FiEye, FiPlus, FiTrash2, FiUsers, FiXCircle } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import { PageSkeleton } from '@/components/ui/Skeleton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import { toast } from '@/store/toastStore';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { Committee } from '@/types';
import { ROUTES } from '@/constants/routes';
import { committeeService } from '@/services/committeeService';
import { fetchAllPages } from '@/services/api';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate, toTitleCase } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import ActionsMenu from '@/components/ui/ActionsMenu';
import StatusBadge from '@/components/ui/StatusBadge';

export default function CommitteesList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCommittee, setSelectedCommittee] = useState<Committee | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    fetchCommittees();
  }, [debouncedSearch, currentPage]);

  const fetchCommittees = async () => {
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
      const result = await committeeService.getAll(params);
      setCommittees(result.data);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err: any) {
      setError(loadErrorMessage(err, 'committees'));
      console.error('Error fetching committees:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);

      const params: any = {};
      if (debouncedSearch) params.search = debouncedSearch;

      const dataToExport = await fetchAllPages((pageParams) =>
        committeeService.getAll({ ...params, ...pageParams })
      );

      if (dataToExport.length === 0) {
        toast.info('No committees to export');
        return;
      }

      const filename = 'committees';
      const title = 'All Committees';

      switch (type) {
        case 'csv':
          exportToCSV(columns, dataToExport, filename);
          break;
        case 'json':
          exportToJSON(columns, dataToExport, filename);
          break;
        case 'pdf':
          exportToPDF(columns, dataToExport, filename, title);
          break;
      }
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error?.message || "Couldn't export committees");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCommittee) return;
    try {
      setDeleting(true);
      await committeeService.delete(selectedCommittee.id);
      await fetchCommittees();
      toast.success('Committee deleted');
      setShowDeleteModal(false);
      setSelectedCommittee(null);
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'delete committee' }));
    } finally {
      setDeleting(false);
    }
  };

  const columns: TableColumn<Committee>[] = [
    {
      key: 'name',
      label: 'Name',
      width: '6.75rem',
      sortable: true,
      render: (v) => <span>{toTitleCase(v)}</span>,
    },
    {
      key: 'members',
      label: 'Members',
      width: '10rem',
      align: 'center',
      render: (members) => (Array.isArray(members) ? members.length : 0),
    },
    {
      key: 'termEndDate',
      label: 'Term Ends',
      width: '9.25rem',
      render: (value) => {
        if (!value) return '-';
        const endsOn = new Date(value);
        // Red once the term is inside the 60-day warning window used by the API sweep
        const daysLeft = Math.ceil((endsOn.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
        const urgent = daysLeft <= 60;
        return (
          <span
            className={`whitespace-nowrap text-xs font-medium ${
              urgent ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-300'
            }`}
          >
            {endsOn.toLocaleDateString()}
            {urgent ? (daysLeft < 0 ? ' (expired)' : ` (${daysLeft}d)`) : ''}
          </span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      width: '7.25rem',
      render: (status) => <StatusBadge status={status || 'active'} />,
    },
    {
      key: 'createdAt',
      label: 'Created',
      width: '7.75rem',
      render: (date) => formatDate(date),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '8rem',
      align: 'center',
      render: (_, row) => (
        <ActionsMenu
          items={[
            {
              label: 'View',
              icon: <FiEye className="h-4 w-4" />,
              onClick: () => {
                navigate(ROUTES.COMMITTEES.DETAIL(row.id));
              },
            },
            {
              label: 'Meetings',
              icon: <FiCalendar className="h-4 w-4" />,
              onClick: () => {
                navigate(`/committees/${row.id}/meetings`);
              },
            },
            {
              label: 'Edit',
              icon: <FiEdit2 className="h-4 w-4" />,
              onClick: () => {
                navigate(`/committees/${row.id}/edit`);
              },
            },
            {
              label: 'Delete',
              icon: <FiTrash2 className="h-4 w-4" />,
              onClick: () => {
                setSelectedCommittee(row);
                setShowDeleteModal(true);
              },
              variant: 'danger',
            },
          ]}
        />
      ),
    },
  ];

  const stats = [
    {
      title: 'Total Committees',
      value: pagination?.total || committees.length,
      icon: <FiUsers className="h-5 w-5" />,
    },
    {
      title: 'Active',
      value: committees.filter((c) => c.status === 'active' || !c.status).length,
      icon: <FiCheckCircle className="h-5 w-5" />,
    },
    {
      title: 'Inactive',
      value: committees.filter((c) => c.status === 'inactive').length,
      icon: <FiXCircle className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <PageHeader title="Committees" description="Manage committees and meetings" />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>
      </div>

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onFilterClick={() => setIsFilterVisible(!isFilterVisible)}
          isFilterVisible={isFilterVisible}
          hasFilters={false}
          onRefresh={fetchCommittees}
          onExport={handleExport}
          isExporting={isExporting}
          actionButtons={
            <>
              <Link to={ROUTES.COMMITTEES.MEETINGS}>
                <Button variant="outline" size="md" icon={<FiCalendar />} collapseLabel>Meetings</Button>
              </Link>
              <Link to="/committees/create">
                <Button size="md" icon={<FiPlus />} collapseLabel>New Committee</Button>
              </Link>
            </>
          }
        />

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <EmptyState variant="error" entity="committees" description={error} action={{ label: 'Retry', onClick: fetchCommittees }} />
        ) : (
          <Table
            fixedLayout
            striped
            columns={columns}
            data={committees}
            entity="committees"
            emptyMessage="No committees found"
            showExport={false}
            onRowClick={(row) => navigate(ROUTES.COMMITTEES.DETAIL(row.id))}
          />
        )}

        {/* Pagination */}
        {pagination && (
          <div className="mt-4">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              onPageChange={(page) => {
                setCurrentPage(page);
              }}
            />
          </div>
        )}
      </TableCard>

      <ConfirmDialog
        isOpen={showDeleteModal}
        title="Delete committee"
        message={`Are you sure you want to delete ${toTitleCase(selectedCommittee?.name) || 'this committee'}? This action cannot be undone.`}
        consequence="This will also delete all associated meetings."
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          setShowDeleteModal(false);
          setSelectedCommittee(null);
        }}
      />
    </div>
  );
}
