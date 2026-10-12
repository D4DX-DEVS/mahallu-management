import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiCreditCard, FiDollarSign, FiRefreshCw, FiDownload, FiFileText, FiFile } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import RowActions from '@/components/ui/RowActions';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import FilterBar from '@/components/ui/FilterBar';
import Dropdown from '@/components/ui/Dropdown';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { masterAccountService, InstituteAccount } from '@/services/masterAccountService';
import { instituteService } from '@/services/instituteService';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { PersonCell } from '@/components/ui/Avatar';
import StatusBadge from '@/components/ui/StatusBadge';

export default function InstituteAccountsList() {
  const { currentInstituteId: userInstituteId } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [accounts, setAccounts] = useState<InstituteAccount[]>([]);
  const [institutes, setInstitutes] = useState<{ id: string; name: string }[]>([]);
  const [instituteFilter, setInstituteFilter] = useState(userInstituteId || 'all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<InstituteAccount | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editForm, setEditForm] = useState({ accountName: '', accountNumber: '', bankName: '', ifscCode: '', balance: 0, status: 'active' as 'active' | 'inactive' });

  useEffect(() => {
    if (!userInstituteId) {
      instituteService.getAll({ limit: 1000 }).then(r => setInstitutes(r.data.map((i: any) => ({ id: i.id, name: i.name })))).catch(() => {});
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [currentPage, instituteFilter]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {
        page: currentPage,
        limit: itemsPerPage,
      };
      if (instituteFilter !== 'all') params.instituteId = instituteFilter;
      const result = await masterAccountService.getAllInstituteAccounts(params);
      setAccounts(Array.isArray(result.data) ? result.data : []);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load institute accounts. Refresh the page or try again."));
      console.error('Error fetching accounts:', err);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      const params = { limit: 10000 };
      const result = await masterAccountService.getAllInstituteAccounts(params);
      const dataToExport = Array.isArray(result.data) ? result.data : [];
      if (dataToExport.length === 0) { toast.info('Nothing to export. Change your filters and try again.'); return; }
      const filename = 'institute-accounts';
      const title = 'Institute Accounts';
      switch (type) {
        case 'csv': exportToCSV(columns, dataToExport, filename); break;
        case 'json': exportToJSON(columns, dataToExport, filename); break;
        case 'pdf': exportToPDF(columns, dataToExport, filename, title); break;
      }
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(getFriendlyError(error, "Couldn't export institute accounts. Check your connection and try again."));
    } finally {
      setIsExporting(false);
    }
  };

  const columns: TableColumn<InstituteAccount>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    { key: 'accountName', label: 'Account', render: (v, row) => <PersonCell name={v || row.bankName || 'Account'} subtitle={row.bankName} /> },
    { key: 'accountNumber', label: 'Account Number' },
    { key: 'bankName', label: 'Bank Name' },
    { key: 'ifscCode', label: 'IFSC Code' },
    {
      key: 'balance',
      label: 'Balance',
      render: (balance) => <span className={(balance || 0) < 0 ? 'font-semibold text-[#B3261E] dark:text-red-300' : 'font-semibold text-[#0B4837] dark:text-brand-lime'}>{`₹${balance?.toLocaleString() || 0}`}</span>,
    },
    { key: 'status', label: 'Status', render: (s) => <StatusBadge status={s || 'active'} /> },
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
          onEdit={() => openEditModal(row)}
          onDelete={() => { setSelectedAccount(row); setShowDeleteModal(true); }}
          ariaLabels={{ edit: 'Edit', delete: 'Delete' }}
        />
      ),
    },
  ];

  const openEditModal = (account: InstituteAccount) => {
    setSelectedAccount(account);
    setEditForm({
      accountName: (account as any).accountName || '',
      accountNumber: account.accountNumber || '',
      bankName: account.bankName || '',
      ifscCode: account.ifscCode || '',
      balance: account.balance || 0,
      status: account.status || 'active',
    });
    setShowEditModal(true);
  };

  const handleEdit = async () => {
    if (!selectedAccount) return;
    try {
      await masterAccountService.updateInstituteAccount(selectedAccount.id, editForm);
      await fetchAccounts();
      setShowEditModal(false);
      setSelectedAccount(null);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't update account. Try again in a moment."));
    }
  };

  const handleDelete = async () => {
    if (!selectedAccount) return;
    try {
      setDeleting(true);
      await masterAccountService.deleteInstituteAccount(selectedAccount.id);
      await fetchAccounts();
      setShowDeleteModal(false);
      setSelectedAccount(null);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't delete account. Try again in a moment."));
    } finally {
      setDeleting(false);
    }
  };

  const stats = [
    { title: 'Total Accounts', value: pagination?.total || accounts.length, icon: <FiCreditCard className="h-[17px] w-[17px]" /> },
    {
      title: 'Total Balance',
      value: `₹${accounts.reduce((sum, a) => sum + (a.balance || 0), 0).toLocaleString()}`,
      icon: <FiDollarSign className="h-[17px] w-[17px]" />,
      tone: 'lime' as const,
      viz: accounts.filter((a) => (a.balance || 0) > 0).length >= 2 ? { type: 'ladder' as const, values: accounts.map((a) => a.balance || 0) } : undefined,
    },
  ];

  return (
    <div className="space-y-4">
    <div className="space-y-3">
      <PageHeader title="Institute Accounts" description="Manage institute bank accounts"
        actions={
          <Link to="/master-accounts/institute/create"><Button>+ New account</Button></Link>
        }
      />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {stats.map((stat, index) => (
            <StatCard key={index} variant="inline" {...stat} />
          ))}
        </div>
      </div>

      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search accounts' }}
          actions={
            <>
              <Button variant="secondary" iconOnly aria-label="Refresh list" onClick={fetchAccounts}>
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
          {!userInstituteId && (
            <>
              <div className="w-64">
                <Select
                  options={[{ value: 'all', label: 'All Institutes' }, ...institutes.map(i => ({ value: i.id, label: i.name }))]}
                  value={instituteFilter}
                  onChange={(e) => setInstituteFilter(e.target.value)}
                />
              </div>
            </>
          )}
        </FilterBar>

        <div className="p-3.5">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <LoadingSpinner />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-[#B3261E] dark:text-red-300">{error}</p>
              <Button onClick={fetchAccounts} className="mt-4" variant="outline">
                Retry
              </Button>
            </div>
          ) : (
            <>
              <Table columns={columns} data={accounts} emptyMessage="No institute accounts found" showExport={false} />
              {pagination && pagination.totalPages > 1 && (
                <div className="mt-3.5">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={pagination.totalPages}
                    totalItems={pagination.total}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                  />
                </div>
              )}
            </>
          )}
      
        </div>
      </Card>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setSelectedAccount(null); }}
        title="Edit Institute Account"
        footer={
          <>
            <Button variant="outline" onClick={() => { setShowEditModal(false); setSelectedAccount(null); }}>Cancel</Button>
            <Button onClick={handleEdit}>Save Changes</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Account Name" value={editForm.accountName} onChange={(e) => setEditForm({ ...editForm, accountName: e.target.value })} />
          <Input label="Account Number" value={editForm.accountNumber} onChange={(e) => setEditForm({ ...editForm, accountNumber: e.target.value })} />
          <Input label="Bank Name" value={editForm.bankName} onChange={(e) => setEditForm({ ...editForm, bankName: e.target.value })} />
          <Input label="IFSC Code" value={editForm.ifscCode} onChange={(e) => setEditForm({ ...editForm, ifscCode: e.target.value })} />
          <Input label="Balance" type="number" value={editForm.balance} onChange={(e) => setEditForm({ ...editForm, balance: parseFloat(e.target.value) || 0 })} />
          <Select label="Status" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as 'active' | 'inactive' })} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setSelectedAccount(null); }}
        title="Delete institute account?"
        footer={
          <>
            <Button variant="outline" onClick={() => { setShowDeleteModal(false); setSelectedAccount(null); }}>Cancel</Button>
            <Button variant="danger-solid" onClick={handleDelete} isLoading={deleting}>Delete</Button>
          </>
        }
      >
        <p className="text-[13px] text-[#5B6963] dark:text-surface-muted">
          Delete <strong>{(selectedAccount as any)?.accountName || selectedAccount?.accountNumber}</strong>? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

