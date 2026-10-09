import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiCheckCircle, FiClock, FiFileText, FiList, FiPlus, FiTrash2 } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import ActionsMenu from '@/components/ui/ActionsMenu';
import FilterPanel from '@/components/ui/FilterPanel';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Modal from '@/components/ui/Modal';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { marriageAssistanceService, MarriageAssistance } from '@/services/marriageAssistanceService';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { useServerCounts } from '@/hooks/useServerCounts';
import StatusBadge from '@/components/ui/StatusBadge';
import { toTitleCase } from '@/utils/format';

export default function MarriageAssistanceList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [records, setRecords] = useState<MarriageAssistance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; label: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MarriageAssistance | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchRecords();
  }, [debouncedSearch, typeFilter, statusFilter, currentPage, itemsPerPage]);

  const fetchRecords = async () => {
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
      const result = await marriageAssistanceService.getAll(params);
      setRecords(result.data);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err: any) {
      setError(loadErrorMessage(err, 'marriage assistance records'));
      console.error('Error fetching records:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id: string, label: string) => {
    setDeleteConfirm({ id, label });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;

    setIsDeleting(true);
    try {
      await marriageAssistanceService.delete(deleteConfirm.id);
      await fetchRecords();
      toast.success('Entry deleted');
      setDeleteConfirm(null);
    } catch (err: any) {
      const message = errorMessage(err, { action: 'delete record' });
      toast.error(message);
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirm(null);
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      proposal_support: 'Proposal Support',
      financial_assistance: 'Financial Assistance',
      premarital_counselling: 'Premarital Counselling',
    };
    return labels[type] || type;
  };

  const columns: TableColumn<MarriageAssistance>[] = [
    {
      key: 'memberId',
      label: 'Member / family',
      width: '16rem',
      sortable: false,
      render: (_, row) => {
        const member = typeof row.memberId === 'object' ? row.memberId?.name : '—';
        const family = typeof row.familyId === 'object' ? row.familyId?.houseName : '—';
        return (
          <span className="font-medium text-foreground">{toTitleCase(member !== '—' ? member : family) || '—'}</span>
        );
      },
    },
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      width: '12rem',
      render: (type) => getTypeLabel(type as string),
    },
    {
      key: 'amount',
      label: 'Amount',
      width: '9rem',
      align: 'right',
      sortable: true,
      render: (amount) => (amount ? `₹${amount.toLocaleString('en-IN')}` : '—'),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      width: '9rem',
      render: (status) => <StatusBadge status={status as string} />,
    },
    {
      key: 'actions',
      label: '',
      width: '6.5rem',
      align: 'right',
      sortable: false,
      render: (_, row) => {
        const label = toTitleCase(
          typeof row.memberId === 'object'
            ? row.memberId?.name
            : typeof row.familyId === 'object'
              ? row.familyId?.houseName
              : 'Record'
        );
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <ActionsMenu
              label={`Actions for ${label}`}
              items={[
                ...(row.type === 'premarital_counselling'
                  ? [
                      {
                        label: 'Create Counselling Case',
                        icon: <FiPlus className="h-4 w-4" />,
                        onClick: () => navigate('/counselling/create'),
                      },
                    ]
                  : []),
                {
                  label: 'Delete',
                  icon: <FiTrash2 className="h-4 w-4" />,
                  variant: 'danger' as const,
                  onClick: () => handleDeleteClick(row.id, label),
                },
              ]}
            />
          </div>
        );
      },
    },
  ];

  // Whole-list counts from the server: these cards used to count only the rows on this page.
  const countBase: { search?: string; type?: string } = {};
  if (debouncedSearch) countBase.search = debouncedSearch;
  if (typeFilter !== 'all') countBase.type = typeFilter;
  const statusCounts = useServerCounts(
    {
      requested: () => marriageAssistanceService.getAll({ ...countBase, status: 'requested', page: 1, limit: 1 }),
      completed: () => marriageAssistanceService.getAll({ ...countBase, status: 'completed', page: 1, limit: 1 }),
    },
    [records]
  );

  const stats = [
    {
      title: 'Total Requests',
      value: pagination?.total || records.length,
      icon: <FiFileText className="h-5 w-5" />,
    },
    {
      title: 'Pending',
      value: statusCounts.requested ?? records.filter((r) => r.status === 'requested').length,
      icon: <FiClock className="h-5 w-5" />,
    },
    {
      title: 'Completed',
      value: statusCounts.completed ?? records.filter((r) => r.status === 'completed').length,
      icon: <FiCheckCircle className="h-5 w-5" />,
    },
  ];

  const activeFilterCount = (typeFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0);
  const isFiltered = Boolean(debouncedSearch) || typeFilter !== 'all' || statusFilter !== 'all';

  return (
    <>
      <PageHeader
        title="Marriage assistance"
        description="Manage marriage assistance requests."
        actions={
          <>
            <Link to="/registers/marriageable">
              <Button variant="outline" icon={<FiList />} collapseLabel>Marriageable register</Button>
            </Link>
            <Link to="/registrations/marriage-assistance/create">
              <Button icon={<FiPlus />} collapseLabel>New request</Button>
            </Link>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchEntity="marriage assistance records"
          onFilterClick={() => setIsFilterVisible((open) => !open)}
          isFilterVisible={isFilterVisible}
          hasFilters
          activeFilterCount={activeFilterCount}
          onRefresh={fetchRecords}
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-52">
              <Select
                label="Type"
                options={[
                  { value: 'all', label: 'All types' },
                  { value: 'proposal_support', label: 'Proposal support' },
                  { value: 'financial_assistance', label: 'Financial assistance' },
                  { value: 'premarital_counselling', label: 'Premarital counselling' },
                ]}
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className="w-full sm:w-52">
              <Select
                label="Status"
                options={[
                  { value: 'all', label: 'All statuses' },
                  { value: 'requested', label: 'Requested' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'completed', label: 'Completed' },
                ]}
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                onClick={() => {
                  setTypeFilter('all');
                  setStatusFilter('all');
                  setCurrentPage(1);
                }}
              >
                Clear filters
              </Button>
            )}
          </FilterPanel>
        )}

        {error ? (
          <EmptyState
            variant="error"
            entity="marriage assistance records"
            description={error}
            action={{ label: 'Try again', onClick: fetchRecords }}
          />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={records}
              isLoading={loading}
              entity="marriage assistance records"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? { label: 'Clear filters', onClick: () => { setSearchQuery(''); setTypeFilter('all'); setStatusFilter('all'); setCurrentPage(1); } }
                  : { label: 'New request', onClick: () => navigate('/registrations/marriage-assistance/create') }
              }
              onRowClick={(row) => {
                setSelectedRecord(row);
                setShowViewModal(true);
              }}
            />

            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="marriage assistance records"
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={(size) => {
                    setItemsPerPage(size);
                    setCurrentPage(1);
                  }}
                />
              </div>
            )}
          </>
        )}
      </TableCard>

      {/* View Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedRecord(null);
        }}
        title="Marriage Assistance Details"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowViewModal(false);
                setSelectedRecord(null);
              }}
            >
              Close
            </Button>
            {selectedRecord && (
              <Button
                variant="danger"
                onClick={() => {
                  const label = toTitleCase(
                    typeof selectedRecord.memberId === 'object'
                      ? selectedRecord.memberId?.name
                      : typeof selectedRecord.familyId === 'object'
                        ? selectedRecord.familyId?.houseName
                        : 'Record'
                  );
                  setShowViewModal(false);
                  handleDeleteClick(selectedRecord.id, label);
                }}
              >
                Delete
              </Button>
            )}
          </>
        }
      >
        {selectedRecord && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Member/Family</p>
              <p className="text-gray-900 dark:text-gray-100 font-medium">
                {toTitleCase(
                  typeof selectedRecord.memberId === 'object'
                    ? selectedRecord.memberId?.name
                    : typeof selectedRecord.familyId === 'object'
                      ? selectedRecord.familyId?.houseName
                      : '—'
                ) || '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Type</p>
              <p className="text-gray-900 dark:text-gray-100">{getTypeLabel(selectedRecord.type)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Amount</p>
              <p className="text-gray-900 dark:text-gray-100">
                {selectedRecord.amount ? `₹${selectedRecord.amount.toLocaleString()}` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
              <p className="text-gray-900 dark:text-gray-100 capitalize">{selectedRecord.status}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Notes</p>
              <p className="text-gray-900 dark:text-gray-100">{selectedRecord.notes || '—'}</p>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title={deleteConfirm ? `Delete record for ${deleteConfirm.label}?` : 'Delete this record?'}
        message="This permanently removes the marriage assistance record and cannot be undone."
        confirmLabel="Delete record"
        cancelLabel="Cancel"
        isLoading={isDeleting}
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </>
  );
}
