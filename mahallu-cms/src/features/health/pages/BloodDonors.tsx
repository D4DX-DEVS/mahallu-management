import { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { getHealthResources, deleteHealthResource, IHealthResource } from '@/services/healthService';
import TableCard from '@/components/ui/TableCard';
import TableToolbar from '@/components/ui/TableToolbar';
import FilterPanel from '@/components/ui/FilterPanel';
import Select from '@/components/ui/Select';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import ActionsMenu from '@/components/ui/ActionsMenu';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import PageHeader from '@/components/layout/PageHeader';
import { TableColumn } from '@/types';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import { toTitleCase } from '@/utils/format';

const BLOOD_GROUPS = ['A +ve', 'A -ve', 'B +ve', 'B -ve', 'AB +ve', 'AB -ve', 'O +ve', 'O -ve'];

export default function BloodDonors() {
  const navigate = useNavigate();
  const [donors, setDonors] = useState<IHealthResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [selectedBloodGroup, setSelectedBloodGroup] = useState('');
  const [deleting, setDeleting] = useState<IHealthResource | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 500);
  const isFiltered = Boolean(debouncedSearch || selectedBloodGroup);

  const fetchDonors = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getHealthResources(
        currentPage,
        itemsPerPage,
        'blood_donor',
        'active',
        selectedBloodGroup,
        debouncedSearch
      );
      setDonors(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
    } catch (err) {
      setError(loadErrorMessage(err, 'blood donors'));
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, selectedBloodGroup, debouncedSearch]);

  useEffect(() => {
    fetchDonors();
  }, [fetchDonors]);

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      setIsDeleting(true);
      await deleteHealthResource(deleting.id);
      toast.success('Donor removed');
      setDeleting(null);
      fetchDonors();
    } catch (err) {
      toast.error(errorMessage(err, { action: 'remove this donor' }));
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: TableColumn<IHealthResource>[] = [
    {
      key: 'name',
      label: 'Donor',
      sortable: true,
      width: '16rem',
      render: (name) => <span className="font-medium text-foreground">{toTitleCase(name)}</span>,
    },
    {
      key: 'bloodGroup',
      label: 'Blood group',
      sortable: true,
      width: '9rem',
      render: (group) => (group ? <Badge variant="danger">{group}</Badge> : '—'),
    },
    { key: 'contactNo', label: 'Phone', width: '9rem', render: (v) => <span className="tabular-nums">{v || '—'}</span> },
    { key: 'availability', label: 'Availability', priority: 'secondary', width: '14rem', render: (v) => v || '—' },
    {
      key: 'actions',
      label: '',
      width: '6.5rem',
      align: 'right',
      sortable: false,
      render: (_v, row) => (
        <ActionsMenu
          label={`Actions for ${toTitleCase(row.name)}`}
          items={[
            { label: 'Edit', icon: <FiEdit2 className="h-4 w-4" />, onClick: () => navigate(`/health/donors/${row.id}/edit`) },
            { label: 'Delete', icon: <FiTrash2 className="h-4 w-4" />, variant: 'danger', onClick: () => setDeleting(row) },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Blood donors"
        description="Registered donors, filterable by blood group."
        actions={
          <Button icon={<FiPlus />} collapseLabel onClick={() => navigate('/health/donors/create')}>
            Add donor
          </Button>
        }
      />

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={(value) => {
            setSearchQuery(value);
            setCurrentPage(1);
          }}
          searchEntity="blood donors"
          onFilterClick={() => setIsFilterVisible((open) => !open)}
          isFilterVisible={isFilterVisible}
          hasFilters
          activeFilterCount={selectedBloodGroup ? 1 : 0}
          onRefresh={fetchDonors}
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-52">
              <Select
                label="Blood group"
                options={[{ value: '', label: 'All blood groups' }, ...BLOOD_GROUPS.map((group) => ({ value: group, label: group }))]}
                value={selectedBloodGroup}
                onChange={(e) => {
                  setSelectedBloodGroup(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            {selectedBloodGroup && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSelectedBloodGroup('');
                  setCurrentPage(1);
                }}
              >
                Clear filters
              </Button>
            )}
          </FilterPanel>
        )}

        {error ? (
          <EmptyState variant="error" entity="blood donors" description={error} action={{ label: 'Try again', onClick: fetchDonors }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={donors}
              isLoading={loading}
              entity="blood donors"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? {
                      label: 'Clear filters',
                      onClick: () => {
                        setSearchQuery('');
                        setSelectedBloodGroup('');
                        setCurrentPage(1);
                      },
                    }
                  : { label: 'Add donor', onClick: () => navigate('/health/donors/create') }
              }
              onRowClick={(row) => navigate(`/health/donors/${row.id}/edit`)}
            />

            <div className="mt-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                entity="blood donors"
                onPageChange={setCurrentPage}
                onItemsPerPageChange={(size) => {
                  setItemsPerPage(size);
                  setCurrentPage(1);
                }}
              />
            </div>
          </>
        )}
      </TableCard>

      <ConfirmDialog
        isOpen={Boolean(deleting)}
        title={`Remove ${deleting?.name ? toTitleCase(deleting.name) : 'this donor'}?`}
        message="This permanently removes the donor record and cannot be undone."
        confirmLabel="Remove donor"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
