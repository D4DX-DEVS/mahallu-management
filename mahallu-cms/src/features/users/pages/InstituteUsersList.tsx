import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiUsers, FiCheckCircle, FiXCircle, FiRefreshCw, FiDownload, FiFileText, FiFile } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { TableColumn } from '@/types';
import { User } from '@/types';
import { userService } from '@/services/userService';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import StatusBadge from '@/components/ui/StatusBadge';
import RowActions from '@/components/ui/RowActions';
import { PersonCell } from '@/components/ui/Avatar';
import Dropdown from '@/components/ui/Dropdown';
import { monthlySeries, shareViz } from '@/utils/statSeries';

export default function InstituteUsersList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
    const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    fetchUsers();
  }, [debouncedSearch]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = { role: 'institute' };
      if (debouncedSearch) {
        params.search = debouncedSearch;
      }
      const result = await userService.getAll(params);
      setUsers(result.data || []);
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load institute users. Refresh the page or try again."));
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      
      const params: any = { role: 'institute', limit: 10000 };
      if (debouncedSearch) params.search = debouncedSearch;
      
      const result = await userService.getAll(params);
      const dataToExport = result.data;

      if (dataToExport.length === 0) {
        toast.info('Nothing to export. Change your filters and try again.');
        return;
      }

      const filename = 'institute-users';
      const title = 'Institute Users';

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
      toast.error(getFriendlyError(error, "Couldn't export data. Check your connection and try again."));
    } finally {
      setIsExporting(false);
    }
  };

  const columns: TableColumn<User>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    { key: 'name', label: 'Name', sortable: true, render: (name, row) => <PersonCell name={name} src={row.photoUrl} /> },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email', render: (email) => email || '-' },
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
      render: (_, row) => (
        <RowActions
          onView={() => navigate(`/users/institute/${row.id}`)}
          onEdit={() => navigate(`/users/institute/${row.id}/edit`)}
          ariaLabels={{ view: 'View user', edit: 'Edit user' }}
        />
      ),
    },
  ];

  const stats = [
    { title: 'Total Institute Users', value: users.length, viz: monthlySeries(users as any[], (r: any) => r.createdAt).length ? { type: 'bars' as const, values: monthlySeries(users as any[], (r: any) => r.createdAt) } : undefined, icon: <FiUsers className="h-[17px] w-[17px]" />, tone: 'green' as const },
    {
      title: 'Active',
      value: users.filter((u) => u.status === 'active' || !u.status).length, viz: shareViz(users.filter((u) => u.status === 'active' || !u.status).length, users.length), summary: `Active: ${users.filter((u) => u.status === 'active' || !u.status).length} of ${users.length}`,
      icon: <FiCheckCircle className="h-[17px] w-[17px]" />, tone: 'lime' as const,
    },
    {
      title: 'Inactive',
      value: users.filter((u) => u.status === 'inactive').length, viz: shareViz(users.filter((u) => u.status === 'inactive').length, users.length, '#E0B400'), summary: `Inactive: ${users.filter((u) => u.status === 'inactive').length} of ${users.length}`,
      icon: <FiXCircle className="h-[17px] w-[17px]" />, tone: 'neutral' as const,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Institute Users"
        description="Manage institute users"
        actions={
          <Link to="/users/institute/create">
            <Button>+ New Institute User</Button>
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
          search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search' }}
          actions={
            <>
              <Button variant="secondary" iconOnly aria-label="Refresh list" onClick={fetchUsers}>
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
        </FilterBar>

        <div className="p-3.5">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchUsers} className="mt-4" variant="secondary">
              Retry
            </Button>
          </div>
        ) : (
          <Table
            columns={columns}
            data={users}
            emptyMessage="No institute users found"
            showExport={false}
            onRowClick={(row) => navigate(`/users/institute/${row.id}`)}
          />
        )}
        </div>
      </Card>
    </div>
  );
}

