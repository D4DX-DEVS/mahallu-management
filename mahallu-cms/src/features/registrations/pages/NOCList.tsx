import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiEye, FiEdit2, FiX, FiFileText, FiClock, FiCheckCircle, FiDownload } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import RichTextEditor from '@/components/ui/RichTextEditor';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { registrationService, NOC } from '@/services/registrationService';
import { memberService } from '@/services/memberService';
import { Member } from '@/types';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/utils/format';
import { ROUTES } from '@/constants/routes';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { downloadNocPdf } from '@/utils/nocPdf';

const DEFAULT_NOC_DESCRIPTION = `
<p>To Whom It May Concern,</p>
<p><strong>Subject: No Objection Certificate for Nikah</strong></p>
<p>
  This is to certify that <strong>Mr. [Groom's Full Name]</strong>, son of Mr. [Groom's Father's Name], and
  <strong>Ms. [Bride's Full Name]</strong>, daughter of Mr. [Bride's Father's Name], have approached our Mahall
  for the purpose of solemnizing their marriage through the Islamic Nikah ceremony.
</p>
<p>
  We, the undersigned members of the Mahall committee, hereby declare that we have no objections to the
  aforementioned union, and we consider it in compliance with Islamic customs and teachings. We have
  conducted the necessary due diligence, reviewed the documentation, and ensured that both parties meet
  the requirements for marriage in accordance with Islamic law.
</p>
<p>
  Furthermore, we have performed all required religious and legal checks and verifications, and it is our
  firm belief that the union between <strong>Mr. [Groom's Full Name]</strong> and <strong>Ms. [Bride's Full Name]</strong>
  is permissible under Islamic law.
</p>
<p>The current marital status of the parties is as follows:</p>
<ul>
  <li><strong>Mr. [Groom's Full Name]</strong> - [Current Marital Status] - [Number of Marriages]</li>
  <li><strong>Ms. [Bride's Full Name]</strong> - [Current Marital Status] - [Number of Marriages]</li>
</ul>
<p>
  This No Objection Certificate is issued to facilitate the Nikah ceremony and to confirm that the Mahall
  does not raise any objections to this marriage. We wish the couple a blessed and harmonious marital life.
</p>
<p>
  For any further inquiries or information, please feel free to contact our Mahall office at
  [Contact Information].
</p>
<p>Yours faithfully,</p>
<p>[Signature of the Mahall Committee Member]</p>
<p>[Printed Name of the Mahall Committee Member]</p>
`.trim();

const createNocSchema = z.object({
  applicantId: z.string().optional(),
  applicantName: z.string().min(1, 'Applicant name is required'),
  applicantNameMl: z.string().optional(),
  applicantPhone: z.string().optional(),
  purposeTitle: z.string().min(1, 'Purpose title is required'),
  purposeTitleMl: z.string().optional(),
  purposeDescription: z.string().min(1, 'Purpose description is required'),
  type: z.enum(['common', 'nikah']),
});

type CreateNocFormData = z.infer<typeof createNocSchema>;

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
    fetchNOCs();
  }, [debouncedSearch, typeFilter, statusFilter, currentPage]);

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
      setError(err.response?.data?.message || 'Failed to fetch NOCs');
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
      setCreateError(err.response?.data?.message || 'Failed to create NOC. Please try again.');
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
        alert('No data to export');
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
      alert(error?.message || 'Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const columns: TableColumn<NOC>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    { key: 'applicantName', label: 'Applicant', sortable: true },
    {
      key: 'purposeTitle',
      label: 'Purpose',
      render: (value, row) => value || row.purpose || '-',
    },
    {
      key: 'type',
      label: 'Type',
      render: (type) => (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 capitalize">
          {type}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (status) => {
        const statusColors: Record<string, string> = {
          pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
          approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
          rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        };
        return (
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[status || 'pending']}`}>
            {status || 'pending'}
          </span>
        );
      },
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
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/registrations/noc/${row.id}`);
            }}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
            title="View"
          >
            <FiEye className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const nocId = (row as any)._id || row.id || '';
              const mahalluName =
                row.tenantId && typeof row.tenantId === 'object'
                  ? (row.tenantId as any).name
                  : undefined;
              downloadNocPdf(
                {
                  ...row,
                  id: nocId,
                  mahalluName,
                  approvedBy: row.approvedBy,
                },
                `noc-${row.applicantName}-${nocId.slice(-6)}`
              );
            }}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
            title="Download"
          >
            <FiDownload className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/registrations/noc/${row.id}/edit`);
            }}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
            title="Edit"
          >
            <FiEdit2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const stats = [
    { title: 'Total NOCs', value: pagination?.total || nocs.length, icon: <FiFileText className="h-5 w-5" /> },
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {isNikahNOC ? 'Nikah NOC' : isCommonNOC ? 'Common NOC' : 'NOC (No Objection Certificate)'}
            </h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              {isNikahNOC ? 'Manage Nikah NOC requests' : isCommonNOC ? 'Manage Common NOC requests' : 'Manage NOC requests'}
            </p>
          </div>
          <Breadcrumb
            items={[
              { label: 'Dashboard', path: '/dashboard' },
              { label: 'Registrations', path: ROUTES.REGISTRATIONS.NIKAH },
              {
                label: isNikahNOC ? 'Nikah NOC' : isCommonNOC ? 'Common NOC' : 'NOC',
                path: isNikahNOC ? ROUTES.REGISTRATIONS.NOC.NIKAH : isCommonNOC ? ROUTES.REGISTRATIONS.NOC.COMMON : '#',
              },
            ]}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>
      </div>

      <Card>
        <div className="mb-6">
          <Button variant="outline" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? 'Close NOC Form' : '+ Create NOC'}
          </Button>
        </div>

        {showCreate && (
          <div className="mb-8 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
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
            <Button size="md" onClick={() => setShowCreate(true)}>
              + New NOC
            </Button>
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
            {!isNikahNOC && !isCommonNOC && (
              <div className="w-32">
                <Select
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
            <div className="w-32">
              <Select
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
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchNOCs} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <Table
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
      </Card>
    </div>
  );
}

