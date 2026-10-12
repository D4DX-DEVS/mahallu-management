import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiDollarSign, FiUsers, FiCreditCard, FiDownload, FiRefreshCw, FiFileText, FiFile } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Pagination from '@/components/ui/Pagination';
import RowActions from '@/components/ui/RowActions';
import { PersonCell } from '@/components/ui/Avatar';
import Dropdown from '@/components/ui/Dropdown';
import FilterBar from '@/components/ui/FilterBar';
import { TableColumn, Pagination as PaginationType, Member } from '@/types';
import { memberService } from '@/services/memberService';
import { collectibleService } from '@/services/collectibleService';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/utils/format';
import { ROUTES } from '@/constants/routes';
import { exportToCSV, exportToJSON } from '@/utils/exportUtils';
import { exportInvoicesToPdf, InvoiceDetails } from '@/utils/invoiceUtils';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

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
      setError(getFriendlyError(err, "Couldn't load members. Refresh the page or try again."));
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
        toast.info('Nothing to export. Change your filters and try again.');
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
      toast.error(getFriendlyError(error, "Couldn't export member varisangya data. Check your connection and try again."));
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
      toast.error(getFriendlyError(error, "Couldn't export member varisangya records. Check your connection and try again."));
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
          <PersonCell name={name} src={row.photoUrl} />
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
      hideable: false,
      render: (_, row) => {
        const busy = exportingRowId === row.id ? 'Exporting...' : undefined;
        return (
          <RowActions
            onView={() => navigate(`${MEMBER_BASE}?view=transactions&memberId=${row.id}`)}
            viewLabel="View transactions"
            extra={[
              { label: 'View wallet', icon: <FiDollarSign />, onClick: () => navigate(`${MEMBER_BASE}?view=wallet&memberId=${row.id}`) },
              { label: 'Export as CSV', icon: <FiDownload />, onClick: () => handleExportRow(row, 'csv'), disabledReason: busy },
              { label: 'Export as JSON', icon: <FiFile />, onClick: () => handleExportRow(row, 'json'), disabledReason: busy },
              { label: 'Export as PDF', icon: <FiFileText />, onClick: () => handleExportRow(row, 'pdf'), disabledReason: busy },
            ]}
          />
        );
      },
    },
  ];

  const totalAmount = members.reduce((sum, m) => sum + (m.totalVarisangya || 0), 0);
  const totalPayments = members.reduce((sum, m) => sum + (m.varisangyaCount || 0), 0);
  const stats = [
    { title: 'Total Members', value: pagination?.total || members.length, icon: <FiUsers className="h-[17px] w-[17px]" /> },
    { title: 'Total Payments', value: totalPayments, icon: <FiCreditCard className="h-[17px] w-[17px]" /> },
    { title: 'Total Amount', value: `₹${totalAmount.toLocaleString()}`, icon: <FiDollarSign className="h-[17px] w-[17px]" />, tone: 'lime' as const, viz: members.filter((r) => (r.totalVarisangya || 0) > 0).length >= 2 ? { type: 'ladder' as const, values: members.map((r) => r.totalVarisangya || 0) } : undefined, summary: `Total amount ₹${totalAmount.toLocaleString()}, top contributors ranked` },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((stat, index) => (
          <StatCard key={index} variant="inline" {...stat} />
        ))}
      </div>
      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search members' }}
          actions={
            <>
              <Button variant="secondary" iconOnly aria-label="Refresh list" onClick={fetchMembers}>
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
        />

        <div className="p-3.5">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchMembers} className="mt-4" variant="secondary">
              Retry
            </Button>
          </div>
        ) : (
          <Table columns={columns} data={members} emptyMessage="No members found" showExport={false} />
        )}
        {pagination && (
          <div className="mt-3.5">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              onPageChange={(page) => setCurrentPage(page)}
            />
          </div>
        )}
        </div>
      </Card>
    </div>
  );
}
