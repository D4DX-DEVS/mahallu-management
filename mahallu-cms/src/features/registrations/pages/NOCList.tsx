import { useState, useEffect } from 'react';
import SavedViews from '@/components/ui/SavedViews';
import AppliedFilters from '@/components/ui/AppliedFilters';
import TableColumnMenu from '@/components/ui/TableColumnMenu';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useTableView } from '@/hooks/useTableView';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiFileText, FiClock, FiCheckCircle, FiDownload, FiRefreshCw, FiFile } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import RichTextEditor from '@/components/ui/RichTextEditor';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Pagination from '@/components/ui/Pagination';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import Dropdown from '@/components/ui/Dropdown';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { registrationService, NOC } from '@/services/registrationService';
import { memberService } from '@/services/memberService';
import { Member } from '@/types';
import { formatDate } from '@/utils/format';
import { ROUTES } from '@/constants/routes';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { downloadNocPdf } from '@/utils/nocPdf';
import { DEFAULT_NOC_DESCRIPTION, createNocSchema, CreateNocFormData } from '../nocFormConfig';
import { buildNocColumns } from '../nocColumns';
import { shareViz, waitingViz } from '@/utils/statSeries';

export default function NOCList() {
  const navigate = useNavigate();
  const location = useLocation();
  const isNikahNOC = location.pathname === ROUTES.REGISTRATIONS.NOC.NIKAH;
  const isCommonNOC = location.pathname === ROUTES.REGISTRATIONS.NOC.COMMON;
  
  const filters = useUrlFilters({ type: 'all', status: 'all' });
  const { search: searchQuery, setSearch: setSearchQuery, debouncedSearch, page: currentPage, setPage: setCurrentPage, pageSize: itemsPerPage } = filters;
  const typeFilter = isNikahNOC ? 'nikah' : isCommonNOC ? 'common' : filters.values.type;
  const statusFilter = filters.values.status;
  const setTypeFilter = (v: string) => filters.setFilter('type', v);
  const setStatusFilter = (v: string) => filters.setFilter('status', v);
  const [nocs, setNocs] = useState<NOC[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);


  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors: createErrors, isSubmitting: isCreating },
  } = useForm<CreateNocFormData>({
    resolver: zodResolver(createNocSchema),
    defaultValues: {
      type: 'common',
      purposeDescription: DEFAULT_NOC_DESCRIPTION,
    },
  });

  const selectedApplicantId = watch('applicantId');
  const purposeDescription = watch('purposeDescription');

  useEffect(() => {
    if (isNikahNOC) {
      setValue('type', 'nikah');
    } else if (isCommonNOC) {
      setValue('type', 'common');
    }
  }, [isNikahNOC, isCommonNOC, setValue]);

  useEffect(() => {
    fetchNOCs();
  }, [debouncedSearch, typeFilter, statusFilter, currentPage, itemsPerPage]);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const result = await memberService.getAll({ limit: 1000 });
        setMembers(result.data || []);
      } catch (err) {
        console.error('Error fetching members:', err);
        setMembers([]);
      }
    };
    fetchMembers();
  }, []);

  useEffect(() => {
    if (!selectedApplicantId) return;
    const selectedMember = members.find((m) => m.id === selectedApplicantId);
    if (!selectedMember) return;
    setValue('applicantName', selectedMember.name);
    setValue('applicantPhone', selectedMember.phone || '');
  }, [selectedApplicantId, members, setValue]);

  const fetchNOCs = async () => {
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
      const result = await registrationService.getAllNOC(params);
      setNocs(result.data);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load NOCs. Refresh the page or try again."));
      console.error('Error fetching NOCs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNoc = async (data: CreateNocFormData) => {
    try {
      setCreateError(null);
      await registrationService.createNOC({
        applicantId: data.applicantId,
        applicantName: data.applicantName,
        applicantNameMl: data.applicantNameMl,
        applicantPhone: data.applicantPhone,
        purposeTitle: data.purposeTitle,
        purposeTitleMl: data.purposeTitleMl,
        purposeDescription: data.purposeDescription,
        type: data.type,
      });
      reset({
        type: data.type,
        purposeDescription: DEFAULT_NOC_DESCRIPTION,
      });
      setShowCreate(false);
      await fetchNOCs();
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't create NOC. Check the details and try again."));
      console.error('Error creating NOC:', err);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      
      const params: any = { limit: 10000 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (typeFilter !== 'all') params.type = typeFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      
      const result = await registrationService.getAllNOC(params);
      const dataToExport = result.data;

      if (dataToExport.length === 0) {
        toast.info('Nothing to export. Change your filters and try again.');
        return;
      }

      const filename = 'noc-list';
      const title = 'NOC List';

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
      toast.error(getFriendlyError(error, "Couldn't export NOCs. Check your connection and try again."));
    } finally {
      setIsExporting(false);
    }
  };

  const columns = buildNocColumns({ navigate });

  const view = useTableView('noc', columns);

  const stats = [
    { title: 'Total NOCs', value: pagination?.total || nocs.length, icon: <FiFileText className="h-[17px] w-[17px]" />, tone: 'green' as const },
    {
      title: 'Pending',
      value: nocs.filter((n) => n.status === 'pending' || !n.status).length, viz: waitingViz(nocs.filter((n) => n.status === 'pending' || !n.status).length), summary: `Pending: ${nocs.filter((n) => n.status === 'pending' || !n.status).length} of ${nocs.length}`,
      icon: <FiClock className="h-[17px] w-[17px]" />,
    },
    {
      title: 'Approved',
      value: nocs.filter((n) => n.status === 'approved').length, viz: shareViz(nocs.filter((n) => n.status === 'approved').length, nocs.length), summary: `Approved: ${nocs.filter((n) => n.status === 'approved').length} of ${nocs.length}`,
      icon: <FiCheckCircle className="h-[17px] w-[17px]" />,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={isNikahNOC ? 'Nikah NOC' : isCommonNOC ? 'Common NOC' : 'NOC (No Objection Certificate)'}
        description={isNikahNOC ? 'Manage Nikah NOC requests' : isCommonNOC ? 'Manage Common NOC requests' : 'Manage NOC requests'}
        actions={<Button onClick={() => setShowCreate(true)}>+ New NOC</Button>}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((stat, index) => (
          <StatCard key={index} variant="inline" {...stat} />
        ))}
      </div>

      {showCreate && (
        <Card>
          <div className="mb-3.5">
            <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">Create NOC</h2>
            <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Enter the applicant and purpose details</p>
          </div>
          <form onSubmit={handleSubmit(handleCreateNoc)} className="space-y-4">
            {createError && (
              <Alert tone="danger">{createError}</Alert>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Applicant"
                options={[
                  { value: '', label: 'Select applicant...' },
                  ...members.map((member) => ({
                    value: member.id,
                    label: `${member.name} (${member.familyName})`,
                  })),
                ]}
                {...register('applicantId')}
                className="md:col-span-2"
              />
              <Input
                label="Applicant Name"
                {...register('applicantName')}
                error={createErrors.applicantName?.message}
                required
                placeholder="Applicant Name"
              />
              <div className="hidden">
              <Input
                label="Applicant Name (Malayalam)"
                {...register('applicantNameMl')}
                placeholder="അപേക്ഷകന്റെ പേര്"
                className="font-malayalam"
              />
              </div>
              <Input
                label="Applicant Phone"
                type="tel"
                {...register('applicantPhone')}
                placeholder="Phone Number"
              />
              <Input
                label="Purpose Title"
                {...register('purposeTitle')}
                error={createErrors.purposeTitle?.message}
                required
                placeholder="Purpose Title"
                className="md:col-span-2"
              />
              <div className="hidden">
              <Input
                label="Purpose Title (Malayalam)"
                {...register('purposeTitleMl')}
                placeholder="ഉദ്ദേശ്യം"
                className="md:col-span-2 font-malayalam"
              />
              </div>
              <Select
                label="NOC Type"
                options={[
                  { value: 'common', label: 'Common' },
                  { value: 'nikah', label: 'Nikah' },
                ]}
                {...register('type')}
                error={createErrors.type?.message}
                required
              />
              <div className="md:col-span-2">
                <RichTextEditor
                  label="Purpose Description"
                  value={purposeDescription || DEFAULT_NOC_DESCRIPTION}
                  onChange={(val) => setValue('purposeDescription', val)}
                  error={createErrors.purposeDescription?.message}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isCreating}>
                Create NOC
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search NOCs' }}
          actions={
            <>
              <Button variant="secondary" iconOnly aria-label="Refresh list" onClick={fetchNOCs}>
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
          {!isNikahNOC && !isCommonNOC && (
            <div className="w-36">
              <Select
                aria-label="Filter by type"
                options={[
                  { value: 'all', label: 'All Types' },
                  { value: 'common', label: 'Common' },
                  { value: 'nikah', label: 'Nikah' },
                ]}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              />
            </div>
          )}
          <div className="w-36">
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
          <SavedViews pageKey="noc" filters={filters} />
        </FilterBar>
        <AppliedFilters filters={filters} config={{type: { label: 'Type' }, status: { label: 'Status' }}} />

        <div className="p-3.5">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchNOCs} className="mt-4" variant="secondary">
              Retry
            </Button>
          </div>
        ) : (
          <Table
            columns={view.columns}
            density={view.density}
            filtersActive={filters.activeCount > 0}
            onClearFilters={filters.clear}
            data={nocs}
            emptyMessage="No NOCs found"
            showExport={false}
            onRowClick={(row) => navigate(`/registrations/noc/${row.id}`)}
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

