import { useState, useEffect } from 'react';
import SavedViews from '@/components/ui/SavedViews';
import AppliedFilters from '@/components/ui/AppliedFilters';
import TableColumnMenu from '@/components/ui/TableColumnMenu';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useTableView } from '@/hooks/useTableView';
import { Link, useNavigate } from 'react-router-dom';
import { FiInbox, FiCheckCircle, FiXCircle, FiRefreshCw, FiDownload, FiFileText, FiFile } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import FilterBar from '@/components/ui/FilterBar';
import Dropdown from '@/components/ui/Dropdown';
import Badge from '@/components/ui/Badge';
import StatusBadge from '@/components/ui/StatusBadge';
import RowActions from '@/components/ui/RowActions';
import { PersonCell } from '@/components/ui/Avatar';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { Institute } from '@/types';
import { ROUTES } from '@/constants/routes';
import { instituteService } from '@/services/instituteService';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { shareViz } from '@/utils/statSeries';

export default function InstitutesList() {
  const navigate = useNavigate();
  const filters = useUrlFilters({ type: 'all' });
  const { search: searchQuery, setSearch: setSearchQuery, debouncedSearch, page: currentPage, setPage: setCurrentPage, pageSize: itemsPerPage } = filters;
  const typeFilter = filters.values.type;
  const setTypeFilter = (v: string) => filters.setFilter('type', v);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInstitute, setSelectedInstitute] = useState<Institute | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);


  useEffect(() => {
    fetchInstitutes();
  }, [debouncedSearch, typeFilter, currentPage, itemsPerPage]);

  const fetchInstitutes = async () => {
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
      const result = await instituteService.getAll(params);
      setInstitutes(result.data);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load institutes. Refresh the page or try again."));
      console.error('Error fetching institutes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      const params: any = { limit: 10000 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (typeFilter && typeFilter !== 'all') params.type = typeFilter;
      const result = await instituteService.getAll(params);
      const dataToExport = result.data;
      if (dataToExport.length === 0) { toast.info('Nothing to export. Change your filters and try again.'); return; }
      const filename = 'institutes';
      const title = 'All Institutes';
      switch (type) {
        case 'csv': exportToCSV(columns, dataToExport, filename); break;
        case 'json': exportToJSON(columns, dataToExport, filename); break;
        case 'pdf': exportToPDF(columns, dataToExport, filename, title); break;
      }
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(getFriendlyError(error, "Couldn't export institutes. Check your connection and try again."));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedInstitute) return;
    try {
      setDeleting(true);
      await instituteService.delete(selectedInstitute.id);
      await fetchInstitutes();
      setShowDeleteModal(false);
      setSelectedInstitute(null);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't delete institute. Try again in a moment."));
      setDeleting(false);
    }
  };

  const columns: TableColumn<Institute>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    { key: 'name', label: 'Name', sortable: true, render: (name, row) => <PersonCell name={name} subtitle={row.place} /> },
    { key: 'place', label: 'Place' },
    {
      key: 'type',
      label: 'Type',
      render: (type) => <Badge variant="info" className="capitalize">{type}</Badge>,
    },
    {
      key: 'joinDate',
      label: 'Join Date',
      render: (date) => formatDate(date),
    },
    {
      key: 'status',
      label: 'Status',
      render: (status) => <StatusBadge status={status || 'active'} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      hideable: false,
      render: (_, row) => (
        <RowActions
          onView={() => navigate(ROUTES.INSTITUTES.DETAIL(row.id))}
          onEdit={() => navigate(`/institutes/${row.id}/edit`)}
          onDelete={() => { setSelectedInstitute(row); setShowDeleteModal(true); }}
          ariaLabels={{ view: 'View institute', edit: 'Edit institute', delete: 'Delete institute' }}
        />
      ),
    },
  ];

  const view = useTableView('institutes', columns);

  const stats = [
    { title: 'Total Institutes', value: pagination?.total || institutes.length, icon: <FiInbox className="h-[17px] w-[17px]" />, tone: 'green' as const },
    {
      title: 'Active',
      value: institutes.filter((i) => i.status === 'active' || !i.status).length, viz: shareViz(institutes.filter((i) => i.status === 'active' || !i.status).length, institutes.length), summary: `Active: ${institutes.filter((i) => i.status === 'active' || !i.status).length} of ${institutes.length}`,
      icon: <FiCheckCircle className="h-[17px] w-[17px]" />, tone: 'lime' as const,
    },
    {
      title: 'Inactive',
      value: institutes.filter((i) => i.status === 'inactive').length, viz: shareViz(institutes.filter((i) => i.status === 'inactive').length, institutes.length, '#E0B400'), summary: `Inactive: ${institutes.filter((i) => i.status === 'inactive').length} of ${institutes.length}`,
      icon: <FiXCircle className="h-[17px] w-[17px]" />, tone: 'neutral' as const,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Institutes"
        description="Manage institutes, madrasas, and other institutions"
        actions={
          <Link to={ROUTES.INSTITUTES.CREATE}>
            <Button>+ New institute</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((stat, index) => (
          <StatCard key={index} variant="inline" {...stat} />
        ))}
      </div>

      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search institutes' }}
          actions={
            <>
              <Button variant="secondary" iconOnly aria-label="Refresh list" onClick={fetchInstitutes}>
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
          <div className="w-40">
            <Select
              options={[
                { value: 'all', label: 'All Types' },
                { value: 'institute', label: 'Institute' },
                { value: 'madrasa', label: 'Madrasa' },
                { value: 'orphanage', label: 'Orphanage' },
                { value: 'hospital', label: 'Hospital' },
                { value: 'other', label: 'Other' },
              ]}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            />
          </div>
          <SavedViews pageKey="institutes" filters={filters} />
        </FilterBar>
        <AppliedFilters filters={filters} config={{type: { label: 'Type' }}} />

        <div className="p-3.5">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-[#B3261E] dark:text-red-300">{error}</p>
            <Button onClick={fetchInstitutes} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <Table
            columns={view.columns}
            density={view.density}
            filtersActive={filters.activeCount > 0}
            onClearFilters={filters.clear}
            data={institutes}
            emptyMessage="No institutes found"
            exportFilename="institutes"
            exportTitle="All Institutes"
            showExport={false}
            onRowClick={(row) => navigate(ROUTES.INSTITUTES.DETAIL(row.id))}
            onExportAll={async () => {
              const params: any = {
                limit: 10000,
              };
              if (debouncedSearch) {
                params.search = debouncedSearch;
              }
              if (typeFilter !== 'all') {
                params.type = typeFilter;
              }
              const result = await instituteService.getAll(params);
              return result.data;
            }}
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
          setSelectedInstitute(null);
        }}
        title="Delete institute?"
        footer={
          <>
            <Button variant="outline" onClick={() => {
              setShowDeleteModal(false);
              setSelectedInstitute(null);
            }}>
              Cancel
            </Button>
            <Button variant="danger-solid" onClick={handleDelete} isLoading={deleting}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-[#5B6963] dark:text-surface-muted">
          Delete <strong>{selectedInstitute?.name}</strong>? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

