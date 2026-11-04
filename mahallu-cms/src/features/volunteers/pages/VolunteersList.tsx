import { useEffect, useState, useCallback } from 'react';
import { FiEdit2, FiEye, FiPlus, FiTrash2 } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { volunteerService, type VolunteerProfile, VOLUNTEER_WINGS } from '@/services/volunteerService';
import Button from '@/components/ui/Button';
import TableCard from '@/components/ui/TableCard';
import TableToolbar from '@/components/ui/TableToolbar';
import FilterPanel from '@/components/ui/FilterPanel';
import Select from '@/components/ui/Select';
import Table from '@/components/ui/Table';
import ActionsMenu from '@/components/ui/ActionsMenu';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import StatusBadge from '@/components/ui/StatusBadge';
import PageHeader from '@/components/layout/PageHeader';
import { TableColumn } from '@/types';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import { toTitleCase } from '@/utils/format';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const volunteerName = (volunteer: VolunteerProfile) => {
  if (volunteer.memberId && typeof volunteer.memberId === 'object') {
    return toTitleCase(volunteer.memberId.name);
  }
  return '—';
};

export default function VolunteersList() {
  const navigate = useNavigate();
  const [volunteers, setVolunteers] = useState<VolunteerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [wingFilter, setWingFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [deleting, setDeleting] = useState<VolunteerProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const activeFilterCount = (wingFilter ? 1 : 0) + (statusFilter ? 1 : 0);
  const isFiltered = activeFilterCount > 0;

  const fetchVolunteers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await volunteerService.getVolunteers({
        page: currentPage,
        limit: itemsPerPage,
        wing: wingFilter || undefined,
        status: statusFilter || undefined,
      });
      setVolunteers(result.data);
      setTotalPages(result.pagination?.totalPages || 1);
      setTotalItems(result.pagination?.total ?? result.data.length);
    } catch (err) {
      setError(loadErrorMessage(err, 'volunteers'));
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, wingFilter, statusFilter]);

  useEffect(() => {
    fetchVolunteers();
  }, [fetchVolunteers]);

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      setIsDeleting(true);
      await volunteerService.deleteVolunteer(deleting.id);
      toast.success('Volunteer deleted');
      setDeleting(null);
      fetchVolunteers();
    } catch (err) {
      toast.error(errorMessage(err, { action: 'delete this volunteer' }));
    } finally {
      setIsDeleting(false);
    }
  };

  const clearFilters = () => {
    setWingFilter('');
    setStatusFilter('');
    setCurrentPage(1);
  };

  const columns: TableColumn<VolunteerProfile>[] = [
    {
      key: 'memberId',
      label: 'Volunteer',
      sortable: false,
      width: '16rem',
      render: (_v, volunteer) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">{volunteerName(volunteer)}</div>
          <div className="truncate text-xs text-muted-foreground">
            {(volunteer.wings ?? []).map((w) => toTitleCase(w)).join(', ') || 'No wing'}
          </div>
        </div>
      ),
    },
    {
      key: 'serviceTypes',
      label: 'Service types',
      sortable: false,
      priority: 'secondary',
      width: '20rem',
      render: (_v, volunteer) => {
        const types = volunteer.serviceTypes ?? [];
        if (types.length === 0) return '—';
        return (
          <span>
            {types.slice(0, 3).map((st) => toTitleCase(st.replace(/_/g, ' '))).join(', ')}
            {types.length > 3 && <span className="text-muted-foreground"> +{types.length - 3}</span>}
          </span>
        );
      },
    },
    { key: 'status', label: 'Status', sortable: true, width: '8rem', render: (_v, volunteer) => <StatusBadge status={volunteer.status} /> },
    {
      key: 'actions',
      label: '',
      align: 'right',
      sortable: false,
      width: '6.5rem',
      render: (_v, volunteer) => (
        <ActionsMenu
          label={`Actions for ${volunteerName(volunteer)}`}
          items={[
            { label: 'View', icon: <FiEye className="h-4 w-4" />, onClick: () => navigate(`/volunteers/${volunteer.id}`) },
            { label: 'Edit', icon: <FiEdit2 className="h-4 w-4" />, onClick: () => navigate(`/volunteers/${volunteer.id}/edit`) },
            { label: 'Delete', icon: <FiTrash2 className="h-4 w-4" />, variant: 'danger', onClick: () => setDeleting(volunteer) },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Volunteers"
        description="People who have signed up to help, by wing."
        actions={
          <Button icon={<FiPlus />} collapseLabel onClick={() => navigate('/volunteers/create')}>
            Add volunteer
          </Button>
        }
      />

      <TableCard>
        <TableToolbar
          onFilterClick={() => setIsFilterVisible((open) => !open)}
          isFilterVisible={isFilterVisible}
          hasFilters
          activeFilterCount={activeFilterCount}
          onRefresh={fetchVolunteers}
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-52">
              <Select
                label="Wing"
                options={[{ value: '', label: 'All wings' }, ...VOLUNTEER_WINGS.map((w) => ({ value: w.value, label: w.label }))]}
                value={wingFilter}
                onChange={(e) => {
                  setWingFilter(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className="w-full sm:w-52">
              <Select
                label="Status"
                options={STATUS_OPTIONS}
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            {activeFilterCount > 0 && (
              <Button variant="ghost" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </FilterPanel>
        )}

        {error ? (
          <EmptyState variant="error" entity="volunteers" description={error} action={{ label: 'Try again', onClick: fetchVolunteers }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={volunteers}
              isLoading={loading}
              entity="volunteers"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? { label: 'Clear filters', onClick: clearFilters }
                  : { label: 'Add volunteer', onClick: () => navigate('/volunteers/create') }
              }
              rowKey={(volunteer) => volunteer.id}
              onRowClick={(volunteer) => navigate(`/volunteers/${volunteer.id}`)}
            />

            <div className="mt-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                entity="volunteers"
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
        title={`Delete ${deleting ? volunteerName(deleting) : 'this volunteer'}?`}
        message="This permanently removes the volunteer record and cannot be undone."
        confirmLabel="Delete volunteer"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
