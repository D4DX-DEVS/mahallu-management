import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiEye, FiDollarSign, FiUsers, FiCreditCard, FiDownload } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import Dropdown from '@/components/ui/Dropdown';
import { TableColumn, Pagination as PaginationType, Member } from '@/types';
import { memberService } from '@/services/memberService';
import { collectibleService } from '@/services/collectibleService';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/utils/format';
import { ROUTES } from '@/constants/routes';
import { exportToCSV, exportToJSON } from '@/utils/exportUtils';
import { exportInvoicesToPdf, InvoiceDetails } from '@/utils/invoiceUtils';
import { toast } from '@/store/toastStore';

interface MemberVarisangyaData extends Member {
  totalVarisangya?: number;
  varisangyaCount?: number;
  lastPaymentDate?: string;
}

const MEMBER_BASE = ROUTES.COLLECTIBLES.MEMBER_VARISANGYA.BASE;

const getMemberId = (v: any) => (typeof v.memberId === 'object' && v.memberId != null ? v.memberId.id : v.memberId);

export default function MemberVarisangyaList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [members, setMembers] = useState<MemberVarisangyaData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingRowId, setExportingRowId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<PaginationType | null>(null);

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    fetchMembers();
  }, [debouncedSearch, currentPage]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = { page: currentPage, limit: itemsPerPage };
      if (debouncedSearch) params.search = debouncedSearch;
      const membersResult = await memberService.getAll(params);
      const membersData = membersResult.data;
      const varisangyasResult = await collectibleService.getAllVarisangyas();
      const allVarisangyas = varisangyasResult.data;
      const membersWithVarisangya = membersData.map((member) => {
        const memberVarisangyas = allVarisangyas.filter((v) => getMemberId(v) === member.id);
        const totalVarisangya = memberVarisangyas.reduce((sum, v) => sum + (v.amount || 0), 0);
        const lastPayment = memberVarisangyas.sort(
          (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
        )[0];
        return {
          ...member,
          totalVarisangya,
          varisangyaCount: memberVarisangyas.length,
          lastPaymentDate: lastPayment?.paymentDate,
        };
      });
      setMembers(membersWithVarisangya);
      if (membersResult.pagination) setPagination(membersResult.pagination);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch members');
      console.error('Error fetching members:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      const params: any = { limit: 10000 };
      if (debouncedSearch) params.search = debouncedSearch;
      const membersResult = await memberService.getAll(params);
      const membersData = membersResult.data;
      const varisangyasResult = await collectibleService.getAllVarisangyas();
      const allVarisangyas = varisangyasResult.data;
      const dataToExport = membersData.map((member) => {
        const memberVarisangyas = allVarisangyas.filter((v) => getMemberId(v) === member.id);
        const totalVarisangya = memberVarisangyas.reduce((sum, v) => sum + (v.amount || 0), 0);
        const lastPayment = memberVarisangyas.sort(
          (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
        )[0];
        return {
          ...member,
          totalVarisangya,
          varisangyaCount: memberVarisangyas.length,
          lastPaymentDate: lastPayment?.paymentDate,
        };
      });
      if (dataToExport.length === 0) {
        toast.info('No member varisangya data to export');
        return;
      }
      switch (type) {
        case 'csv':
          exportToCSV(columns, dataToExport, 'member-varisangya');
          break;
        case 'json':
          exportToJSON(columns, dataToExport, 'member-varisangya');
          break;
        case 'pdf':
          {
            const invoices: InvoiceDetails[] = [];
            for (const member of membersData) {
              const memberVarisangyas = allVarisangyas.filter((v) => getMemberId(v) === member.id);
              for (const entry of memberVarisangyas) {
                invoices.push({
                  title: 'Member Varisangya Payment',
                  receiptNo: entry.receiptNo,
                  payerLabel: 'Member',
                  payerName: member.name || '-',
                  amount: entry.amount,
                  paymentDate: entry.paymentDate,
                  paymentMethod: entry.paymentMethod,
                  remarks: entry.remarks,
                });
              }
            }
            await exportInvoicesToPdf(invoices, `member-varisangya-invoices-${new Date().toISOString().split('T')[0]}`);
          }
          break;
      }
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error?.message || 'Failed to export member varisangya data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportRow = async (row: MemberVarisangyaData, type: 'csv' | 'json' | 'pdf') => {
    try {
      setExportingRowId(row.id);
      const filename = `member-varisangya-${(row.name || row.id).replace(/\s+/g, '-')}`;
      const singleRow = [row];
      switch (type) {
        case 'csv':
          exportToCSV(columns, singleRow, filename);
          break;
        case 'json':
          exportToJSON(columns, singleRow, filename);
          break;
        case 'pdf':
          {
            const varisangyasResult = await collectibleService.getAllVarisangyas({ memberId: row.id });
            const memberVarisangyas = varisangyasResult.data || [];
            if (memberVarisangyas.length === 0) {
              toast.info('No payment records to export for this member');
              return;
            }
            const invoices: InvoiceDetails[] = memberVarisangyas.map((entry: any) => ({
              title: 'Member Varisangya Payment',
              receiptNo: entry.receiptNo || '-',
              payerLabel: 'Member',
              payerName: row.name || '-',
              amount: entry.amount,
              paymentDate: entry.paymentDate,
              paymentMethod: entry.paymentMethod || '-',
              remarks: entry.remarks || '',
            }));
            await exportInvoicesToPdf(invoices, filename);
          }
          break;
      }
    } catch (error: any) {
      console.error('Row export error:', error);
      toast.error(error?.message || 'Failed to export member varisangya records');
    } finally {
      setExportingRowId(null);
    }
  };

  const columns: TableColumn<MemberVarisangyaData>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    {
      key: 'name',
      label: 'Member Name',
      render: (name, row) => (
        <Link to={ROUTES.MEMBERS.DETAIL(row.id)} className="text-primary-600 hover:text-primary-700 dark:text-primary-400">
          {name}
        </Link>
      ),
    },
    { key: 'familyName', label: 'Family' },
    { key: 'varisangyaCount', label: 'Payments', render: (count) => count || 0 },
    { key: 'totalVarisangya', label: 'Total Amount', render: (amount) => `₹${(amount || 0).toLocaleString()}` },
    { key: 'lastPaymentDate', label: 'Last Payment', render: (date) => (date ? formatDate(date) : '-') },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`${MEMBER_BASE}?view=transactions&memberId=${row.id}`);
            }}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
            title="View Transactions"
          >
            <FiEye className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`${MEMBER_BASE}?view=wallet&memberId=${row.id}`);
            }}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
            title="View Wallet"
          >
            <FiDollarSign className="h-4 w-4" />
          </button>
          <Dropdown
            align="right"
            trigger={
              <button
                onClick={(e) => e.stopPropagation()}
                disabled={exportingRowId === row.id}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors disabled:opacity-50"
                title="Export"
              >
                {exportingRowId === row.id ? <LoadingSpinner size="sm" /> : <FiDownload className="h-4 w-4" />}
              </button>
            }
            items={[
              { label: 'Export as CSV', onClick: () => handleExportRow(row, 'csv') },
              { label: 'Export as JSON', onClick: () => handleExportRow(row, 'json') },
              { label: 'Export as PDF', onClick: () => handleExportRow(row, 'pdf') },
            ]}
          />
        </div>
      ),
    },
  ];

  const totalAmount = members.reduce((sum, m) => sum + (m.totalVarisangya || 0), 0);
  const totalPayments = members.reduce((sum, m) => sum + (m.varisangyaCount || 0), 0);
  const stats = [
    { title: 'Total Members', value: pagination?.total || members.length, icon: <FiUsers className="h-5 w-5" /> },
    { title: 'Total Payments', value: totalPayments, icon: <FiCreditCard className="h-5 w-5" /> },
    { title: 'Total Amount', value: `₹${totalAmount.toLocaleString()}`, icon: <FiDollarSign className="h-5 w-5" /> },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>
      <Card>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onFilterClick={() => setIsFilterVisible(!isFilterVisible)}
          isFilterVisible={isFilterVisible}
          hasFilters={false}
          onRefresh={fetchMembers}
          onExport={handleExport}
          isExporting={isExporting}
        />
        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchMembers} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <Table columns={columns} data={members} emptyMessage="No members found" showExport={false} />
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
    </div>
  );
}
