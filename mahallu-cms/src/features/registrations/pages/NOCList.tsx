import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiCheckCircle, FiClock, FiFileText, FiPlus } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import FilterPanel from '@/components/ui/FilterPanel';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import RichTextEditor from '@/components/ui/RichTextEditor';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import { toast } from '@/store/toastStore';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { registrationService, NOC } from '@/services/registrationService';
import { fetchAllPages } from '@/services/api';
import { memberService } from '@/services/memberService';
import { Member } from '@/types';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate, toTitleCase } from '@/utils/format';
import { ROUTES } from '@/constants/routes';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { downloadNocPdf } from '@/utils/nocPdf';
import { DEFAULT_NOC_DESCRIPTION, createNocSchema, CreateNocFormData } from '../nocFormConfig';
import { buildNocColumns } from '../nocColumns';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

export default function NOCList() {
  const navigate = useNavigate();
  const location = useLocation();
  const isNikahNOC = location.pathname === ROUTES.REGISTRATIONS.NOC.NIKAH;
  const isCommonNOC = location.pathname === ROUTES.REGISTRATIONS.NOC.COMMON;

  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>(() => {
    if (isNikahNOC) return 'nikah';
    if (isCommonNOC) return 'common';
    return 'all';
  });
  const [statusFilter, setStatusFilter] = useState('all');
  const [nocs, setNocs] = useState<NOC[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

  const debouncedSearch = useDebounce(searchQuery, 500);

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
      setTypeFilter('nikah');
    } else if (isCommonNOC) {
      setValue('type', 'common');
      setTypeFilter('common');
    }
  }, [isNikahNOC, isCommonNOC, setValue]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchNOCs();
  }, [debouncedSearch, typeFilter, statusFilter, currentPage]);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        // The list endpoint caps a page at 100 and answers 400 above it, so the
        // old single `limit: 1000` call failed and left this dropdown empty.
        const all = await fetchAllPages<Member>((params) => memberService.getAll(params), 10);
        setMembers(all);
      } catch (err) {
        setMembers([]);
        toast.error(loadErrorMessage(err, 'members'));
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
      setError(loadErrorMessage(err, 'nocs'));
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
      const fieldErrors = err.response?.data?.errors;
      const detail = Array.isArray(fieldErrors)
        ? fieldErrors
            .map((e: any) => e.msg)
            .filter(Boolean)
            .join('; ')
        : null;
      setCreateError(detail || errorMessage(err, { action: 'create noc. please try again' }));
      console.error('Error creating NOC:', err);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);

      const filters: any = {};
      if (debouncedSearch) filters.search = debouncedSearch;
      if (typeFilter !== 'all') filters.type = typeFilter;
      if (statusFilter !== 'all') filters.status = statusFilter;

      // The list endpoint caps a page at 100 and answers 400 above it, so the
      // old single `limit: 10000` export call failed for any non-empty result.
      const dataToExport = await fetchAllPages<NOC>((params) =>
        registrationService.getAllNOC({ ...filters, ...params })
      );

      if (dataToExport.length === 0) {
        toast.info('No NOCs to export');
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
      toast.error(errorMessage(error, { action: 'export NOCs' }));
    } finally {
      setIsExporting(false);
    }
  };

  const columns = buildNocColumns({ navigate });

  const stats = [
    {
      title: 'Total NOCs',
      value: pagination?.total || nocs.length,
      icon: <FiFileText className="h-5 w-5" />,
    },
    {
      title: 'Pending',
      value: nocs.filter((n) => n.status === 'pending' || !n.status).length,
      icon: <FiClock className="h-5 w-5" />,
    },
    {
      title: 'Approved',
      value: nocs.filter((n) => n.status === 'approved').length,
      icon: <FiCheckCircle className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <PageHeader
          title={isNikahNOC ? 'Nikah NOC' : isCommonNOC ? 'Common NOC' : 'NOC (No Objection Certificate)'}
          description={
            isNikahNOC
              ? 'Manage Nikah NOC requests'
              : isCommonNOC
                ? 'Manage Common NOC requests'
                : 'Manage NOC requests'
          }
          breadcrumbs={[{ label: 'Registrations', path: ROUTES.REGISTRATIONS.NIKAH }]}
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>
      </div>

      <TableCard>
        <div className="mb-4">
          <Button variant="outline" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? 'Close NOC Form' : '+ Create NOC'}
          </Button>
        </div>

        {showCreate && (
          <div className="mb-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
            <form onSubmit={handleSubmit(handleCreateNoc)} className="space-y-4">
              {createError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900 dark:border-red-700 dark:text-red-200">
                  {createError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Applicant"
                  options={[
                    { value: '', label: 'Select applicant...' },
                    ...members.map((member) => ({
                      value: member.id,
                      label: `${toTitleCase(member.name)} (${toTitleCase(member.familyName)})`,
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
              <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={isCreating}>
                  Create NOC
                </Button>
              </div>
            </form>
          </div>
        )}

        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onFilterClick={() => setIsFilterVisible(!isFilterVisible)}
          isFilterVisible={isFilterVisible}
          hasFilters={true}
          onRefresh={fetchNOCs}
          onExport={handleExport}
          isExporting={isExporting}
          actionButtons={
            <Button size="md" onClick={() => setShowCreate(true)} icon={<FiPlus />} collapseLabel>
              New NOC
            </Button>
          }
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            {!isNikahNOC && !isCommonNOC && (
              <div className="w-full sm:w-32">
                <Select
                  options={[
                    { value: 'all', label: 'All Types' },
                    { value: 'common', label: 'Common' },
                    { value: 'nikah', label: 'Nikah' },
                  ]}
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
            )}
            <div className="w-full sm:w-32">
              <Select
                options={[
                  { value: 'all', label: 'All Status' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'correction_required', label: 'Correction Required' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'rejected', label: 'Rejected' },
                ]}
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </FilterPanel>
        )}

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <div className="text-center py-10">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchNOCs} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <Table
            fixedLayout
            striped
            columns={columns}
            data={nocs}
            emptyMessage="No NOCs found"
            showExport={false}
            onRowClick={(row) => navigate(`/registrations/noc/${row.id}`)}
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
    </div>
  );
}
