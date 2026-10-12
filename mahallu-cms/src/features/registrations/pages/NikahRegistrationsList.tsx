import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiFileText, FiClock, FiCheckCircle, FiRefreshCw, FiDownload, FiFile } from 'react-icons/fi';
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
import RowActions from '@/components/ui/RowActions';
import { PersonCell } from '@/components/ui/Avatar';
import Dropdown from '@/components/ui/Dropdown';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { registrationService, NikahRegistration } from '@/services/registrationService';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { shareViz, waitingViz } from '@/utils/statSeries';

export default function NikahRegistrationsList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [registrations, setRegistrations] = useState<NikahRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    fetchRegistrations();
  }, [debouncedSearch, statusFilter, currentPage]);

  const fetchRegistrations = async () => {
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
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const result = await registrationService.getAllNikah(params);
      setRegistrations(result.data);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load nikah registrations. Refresh the page or try again."));
      console.error('Error fetching registrations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      
      const params: any = { limit: 10000 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter !== 'all') params.status = statusFilter;
      
      const result = await registrationService.getAllNikah(params);
      const dataToExport = result.data;

      if (dataToExport.length === 0) {
        toast.info('Nothing to export. Change your filters and try again.');
        return;
      }

      const filename = 'nikah-registrations';
      const title = 'Nikah Registrations';

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
      toast.error(getFriendlyError(error, "Couldn't export nikah registrations. Check your connection and try again."));
    } finally {
      setIsExporting(false);
    }
  };

  const columns: TableColumn<NikahRegistration>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    { key: 'groomName', label: 'Groom', sortable: true, render: (name) => <PersonCell name={name} /> },
    { key: 'brideName', label: 'Bride', sortable: true, render: (name) => <PersonCell name={name} /> },
    {
      key: 'nikahDate',
      label: 'Nikah Date',
      render: (date) => formatDate(date),
    },
    {
      key: 'status',
      label: 'Status',
      render: (status) => <StatusBadge status={status || 'pending'} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      hideable: false,
      render: (_, row) => (
        <RowActions
          onView={() => navigate(`/registrations/nikah/${row.id}`)}
          onEdit={() => navigate(`/registrations/nikah/${row.id}/edit`)}
          ariaLabels={{ view: 'View registration', edit: 'Edit registration' }}
        />
      ),
    },
  ];

  const stats = [
    { title: 'Total Registrations', value: pagination?.total || registrations.length, icon: <FiFileText className="h-[17px] w-[17px]" />, tone: 'green' as const },
    {
      title: 'Pending',
      value: registrations.filter((r) => r.status === 'pending' || !r.status).length, viz: waitingViz(registrations.filter((r) => r.status === 'pending' || !r.status).length), summary: `Pending: ${registrations.filter((r) => r.status === 'pending' || !r.status).length} of ${registrations.length}`,
      icon: <FiClock className="h-[17px] w-[17px]" />,
    },
    {
      title: 'Approved',
      value: registrations.filter((r) => r.status === 'approved').length, viz: shareViz(registrations.filter((r) => r.status === 'approved').length, registrations.length), summary: `Approved: ${registrations.filter((r) => r.status === 'approved').length} of ${registrations.length}`,
      icon: <FiCheckCircle className="h-[17px] w-[17px]" />,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Nikah registrations"
        description="Manage nikah registrations"
        actions={
          <Link to="/registrations/nikah/create">
            <Button>+ New registration</Button>
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
          search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search registrations' }}
          actions={
            <>
              <Button variant="secondary" iconOnly aria-label="Refresh list" onClick={fetchRegistrations}>
                <FiRefreshCw className="h-3.5 w-3.5" />
              </Button>
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
              aria-label="Filter by status"
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'pending', label: 'Pending' },
                { value: 'approved', label: 'Approved' },
                { value: 'rejected', label: 'Rejected' },
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
            <Button onClick={fetchRegistrations} className="mt-4" variant="secondary">
              Retry
            </Button>
          </div>
        ) : (
          <Table
            columns={columns}
            data={registrations}
            emptyMessage="No nikah registrations found"
            showExport={false}
            onRowClick={(row) => navigate(`/registrations/nikah/${row.id}`)}
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
    </div>
  );
}

