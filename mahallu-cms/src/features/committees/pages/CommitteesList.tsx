import { useState, useEffect } from 'react';
import SavedViews from '@/components/ui/SavedViews';
import AppliedFilters from '@/components/ui/AppliedFilters';
import TableColumnMenu from '@/components/ui/TableColumnMenu';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useTableView } from '@/hooks/useTableView';
import { Link, useNavigate } from 'react-router-dom';
import { FiCalendar, FiUsers, FiCheckCircle, FiXCircle, FiRefreshCw, FiDownload, FiFileText, FiFile } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { Committee } from '@/types';
import { ROUTES } from '@/constants/routes';
import { committeeService } from '@/services/committeeService';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import StatusBadge from '@/components/ui/StatusBadge';
import RowActions from '@/components/ui/RowActions';
import { PersonCell } from '@/components/ui/Avatar';
import Dropdown from '@/components/ui/Dropdown';
import { useUndoableAction } from '@/hooks/useUndoableAction';
import { pct } from '@/utils/statSeries';

export default function CommitteesList() {
  const undo = useUndoableAction('committee');
  const navigate = useNavigate();
  const filters = useUrlFilters({});
  const { search: searchQuery, setSearch: setSearchQuery, debouncedSearch, page: currentPage, setPage: setCurrentPage, pageSize: itemsPerPage } = filters;
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCommittee, setSelectedCommittee] = useState<Committee | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);


  useEffect(() => {
    fetchCommittees();
  }, [debouncedSearch, currentPage, itemsPerPage]);

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
      setError(getFriendlyError(err, "Couldn't load committees. Refresh the page or try again."));
      console.error('Error fetching committees:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      
      const params: any = { limit: 10000 };
      if (debouncedSearch) params.search = debouncedSearch;
      
      const result = await committeeService.getAll(params);
      const dataToExport = result.data;

      if (dataToExport.length === 0) {
        toast.info('Nothing to export. Change your filters and try again.');
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
      toast.error(getFriendlyError(error, "Couldn't export committees. Check your connection and try again."));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCommittee) return;
    const target = selectedCommittee;
    setShowDeleteModal(false);
    setSelectedCommittee(null);
    // Confirmed first (cascades to meetings); the API call itself waits out the undo window
    undo.run({
      id: target.id,
      label: `${target.name || 'Committee'} deleted`,
      commit: () => committeeService.delete(target.id),
      onCommitted: fetchCommittees,
      errorMessage: "Couldn't delete the committee. Try again in a moment.",
    });
  };

  const columns: TableColumn<Committee>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    { key: 'name', label: 'Name', sortable: true, render: (name) => <PersonCell name={name} /> },
    {
      key: 'members',
      label: 'Members',
      render: (members) => (Array.isArray(members) ? members.length : 0),
    },
    {
      key: 'termEndDate',
      label: 'Term Ends',
      render: (value) => {
        if (!value) return '-';
        const endsOn = new Date(value);
        // Red once the term is inside the 60-day warning window used by the API sweep
        const daysLeft = Math.ceil((endsOn.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
        const urgent = daysLeft <= 60;
        return (
          <span
            className={`whitespace-nowrap text-xs font-medium ${
              urgent ? 'text-red-600 dark:text-red-400' : 'text-[#5B6963] dark:text-surface-muted'
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
      render: (status) => (
        <StatusBadge status={status || 'active'} />
      ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (date) => formatDate(date),
    },
    {
      key: 'actions',
      label: 'Actions',
      hideable: false,
      render: (_, row) => (
        <RowActions
          onView={() => navigate(ROUTES.COMMITTEES.DETAIL(row.id))}
          onEdit={() => navigate(`/committees/${row.id}/edit`)}
          onDelete={() => {
            setSelectedCommittee(row);
            setShowDeleteModal(true);
          }}
          deleteLabel="Delete"
          extra={[{ label: 'Meetings', icon: <FiCalendar />, onClick: () => navigate(`/committees/${row.id}/meetings`) }]}
          ariaLabels={{ view: 'View committee', edit: 'Edit committee', delete: 'Delete committee' }}
        />
      ),
    },
  ];

  const view = useTableView('committees', columns);

  const stats = [
    { title: 'Total Committees', value: pagination?.total || committees.length, icon: <FiUsers className="h-[17px] w-[17px]" />,
      tone: 'green' as const },
    {
      title: 'Active',
      value: committees.filter((c) => c.status === 'active' || !c.status).length,
      icon: <FiCheckCircle className="h-[17px] w-[17px]" />,
      tone: 'lime' as const,
      viz: committees.length > 0 ? { type: 'ring' as const, percent: pct(committees.filter((c) => c.status === 'active' || !c.status).length, committees.length) } : undefined,
      summary: `${committees.filter((c) => c.status === 'active' || !c.status).length} of ${committees.length} committees active`,
    },
    {
      title: 'Inactive',
      value: committees.filter((c) => c.status === 'inactive').length,
      icon: <FiXCircle className="h-[17px] w-[17px]" />,
      tone: 'neutral' as const,
      viz: committees.length > 0 ? { type: 'segments' as const, segments: [{ value: committees.filter((c) => c.status === 'active' || !c.status).length }, { value: committees.filter((c) => c.status === 'inactive').length, color: '#FDD817' }] } : undefined,
      summary: `${committees.filter((c) => c.status === 'inactive').length} committees inactive`,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Committees"
        description="Manage committees and meetings"
        actions={
          <>
            <Link to={ROUTES.COMMITTEES.MEETINGS}>
              <Button variant="secondary">
                <FiCalendar className="h-3.5 w-3.5" />
                Meetings
              </Button>
            </Link>
            <Link to="/committees/create">
              <Button>+ New Committee</Button>
            </Link>
          </>
        }
      />

<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats.map((stat, index) => (
            <StatCard key={index} variant="inline" {...stat} />
          ))}
        </div>

      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search committees' }}
          actions={
            <>
              <Button variant="secondary" iconOnly aria-label="Refresh list" onClick={fetchCommittees}>
                <FiRefreshCw className="h-3.5 w-3.5" />
              </Button>
              <TableColumnMenu {...view.menuProps} />
              <Dropdown
                trigger={
                  <Button variant="secondary" isLoading={isExporting}>
                    {!isExporting && <FiDownload className="h-3.5 w-3.5" />}
                    Export
                  </Button>
                }
                items={[
                  { label: 'Export CSV', icon: <FiFileText />, onClick: () => handleExport('csv'), disabled: isExporting },
                  { label: 'Export JSON', icon: <FiFile />, onClick: () => handleExport('json'), disabled: isExporting },
                  { label: 'Export PDF', icon: <FiDownload />, onClick: () => handleExport('pdf'), disabled: isExporting },
                ]}
              />
            </>
          }
        >
          <SavedViews pageKey="committees" filters={filters} />
        </FilterBar>
        <AppliedFilters filters={filters} />

        <div className="p-3.5">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchCommittees} className="mt-4" variant="secondary">
              Retry
            </Button>
          </div>
        ) : (
          <Table
            columns={view.columns}
            density={view.density}
            filtersActive={filters.activeCount > 0}
            onClearFilters={filters.clear}
            data={undo.filterHidden(committees, (c) => c.id)}
            emptyMessage="No committees found"
            showExport={false}
            onRowClick={(row) => navigate(ROUTES.COMMITTEES.DETAIL(row.id))}
          />
        )}

        {/* Pagination */}
        {pagination && (
          <div className="mt-3.5">
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
        </div>
      </Card>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedCommittee(null);
        }}
        title="Delete committee?"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowDeleteModal(false);
                setSelectedCommittee(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={deleting}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-[#5B6963] dark:text-surface-muted">
          Delete <strong>{selectedCommittee?.name}</strong>? This will also delete all
          associated meetings. This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

