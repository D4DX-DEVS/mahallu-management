import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiCheck, FiHome, FiUsers, FiRefreshCw, FiDownload, FiFileText, FiFile } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { TableColumn } from '@/types';
import { Family } from '@/types';
import { ROUTES } from '@/constants/routes';
import { familyService } from '@/services/familyService';
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

export default function UnapprovedFamiliesList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    fetchFamilies();
  }, [debouncedSearch]);

  const fetchFamilies = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = { status: 'unapproved' };
      if (debouncedSearch) {
        params.search = debouncedSearch;
      }
      const result = await familyService.getAll(params);
      setFamilies(result.data || []);
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load unapproved families. Refresh the page or try again."));
      console.error('Error fetching families:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      const params: any = { status: 'unapproved', limit: 10000 };
      if (debouncedSearch) params.search = debouncedSearch;
      const result = await familyService.getAll(params);
      const dataToExport = result.data || [];
      if (dataToExport.length === 0) {
        toast.info('Nothing to export. Change your filters and try again.');
        return;
      }
      const filename = 'unapproved-families';
      const title = 'Unapproved Families';
      switch (type) {
        case 'csv': exportToCSV(columns, dataToExport, filename); break;
        case 'json': exportToJSON(columns, dataToExport, filename); break;
        case 'pdf': exportToPDF(columns, dataToExport, filename, title); break;
      }
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(getFriendlyError(error, "Couldn't export data. Check your connection and try again."));
    } finally {
      setIsExporting(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await familyService.update(id, { status: 'approved' });
      await fetchFamilies();
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't approve family. Try again in a moment."));
    }
  };

  const columns: TableColumn<Family>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    { key: 'mahallId', label: 'Mahall ID', render: (id) => id || '-' },
    { key: 'houseName', label: 'House Name', sortable: true, render: (name) => <PersonCell name={name} /> },
    {
      key: 'familyHead',
      label: 'Family Head',
      render: (head) => (head ? <PersonCell name={head} size={24} /> : '-'),
    },
    {
      key: 'members',
      label: 'Members',
      render: (members) => members?.length || 0,
    },
    { key: 'area', label: 'Area' },
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
          onView={() => navigate(ROUTES.FAMILIES.DETAIL(row.id))}
          onEdit={() => navigate(ROUTES.FAMILIES.EDIT(row.id))}
          extra={[{ label: 'Approve', icon: <FiCheck />, onClick: () => handleApprove(row.id) }]}
          ariaLabels={{ view: 'View family', edit: 'Edit family' }}
        />
      ),
    },
  ];

  const stats = [
    { title: 'Unapproved Families', value: families.length, icon: <FiHome className="h-[17px] w-[17px]" />,
      tone: 'green' as const,
      viz: families.length > 0 ? { type: 'dots' as const, count: families.length } : undefined,
      summary: `${families.length} families waiting for approval` },
    {
      title: 'Total Members',
      value: families.reduce((sum, f) => sum + (f.members?.length || 0), 0),
      icon: <FiUsers className="h-[17px] w-[17px]" />,
      tone: 'lime' as const,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Unapproved Families"
        description="Review and approve pending family registrations"
      />

<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {stats.map((stat, index) => (
            <StatCard key={index} variant="inline" {...stat} />
          ))}
        </div>

      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search families' }}
          actions={
            <>
              <Button variant="secondary" iconOnly aria-label="Refresh list" onClick={fetchFamilies}>
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
            <Button onClick={fetchFamilies} className="mt-4" variant="secondary">
              Retry
            </Button>
          </div>
        ) : (
          <Table
            columns={columns}
            data={families}
            emptyMessage="No unapproved families found"
            showExport={false}
            onRowClick={(row) => navigate(ROUTES.FAMILIES.DETAIL(row.id))}
          />
        )}
        </div>
      </Card>
    </div>
  );
}

