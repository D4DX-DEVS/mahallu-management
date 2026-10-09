import { useState, useEffect } from 'react';
import { FiPlus } from 'react-icons/fi';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import TableCard from '@/components/ui/TableCard';
import TableToolbar from '@/components/ui/TableToolbar';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { Khateeb, religiousService, KHATEEB_STATUS_OPTIONS } from '@/services/religiousService';
import { memberService } from '@/services/memberService';
import { useDebounce } from '@/hooks/useDebounce';
import { ROUTES } from '@/constants/routes';
import { Member } from '@/types';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';
import StatusBadge from '@/components/ui/StatusBadge';
import { optionalPhoneSchema, sanitizeDigits } from '@/utils/validation';
import { fetchAllPages } from '@/services/api';
import { logError } from '@/utils/safeLog';

const khateebSchema = z.object({
  name: z.string().max(200, 'Please keep the name to 200 characters or less.').min(1, 'Name is required'),
  nameMl: z.string().max(200, 'Please keep the name to 200 characters or less.').optional(),
  memberId: z.string().max(200, 'Please keep the member to 200 characters or less.').optional(),
  qualifications: z.string().max(200, 'Please keep the qualifications to 200 characters or less.').optional(),
  contactNo: optionalPhoneSchema,
  status: z.enum(['active', 'inactive']).optional(),
});

type KhateebFormData = z.infer<typeof khateebSchema>;

export default function KhateebsList() {
  const [khateebs, setKhateebs] = useState<Khateeb[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingKhateeb, setEditingKhateeb] = useState<Khateeb | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedKhateeb, setSelectedKhateeb] = useState<Khateeb | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  const debouncedSearch = useDebounce(searchQuery, 500);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm<KhateebFormData>({
    resolver: zodResolver(khateebSchema),
    defaultValues: {
      status: 'active',
    },
  });

  useEffect(() => {
    fetchMembers();
    fetchKhateebs();
  }, [debouncedSearch, currentPage, itemsPerPage]);

  const fetchMembers = async () => {
    try {
      setLoadingMembers(true);
      const allRows = await fetchAllPages((page) => memberService.getAll(page));
      setMembers(allRows || []);
    } catch (err) {
      logError('Error fetching members', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const fetchKhateebs = async () => {
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
      const result = await religiousService.getAllKhateebs(params);
      setKhateebs(result.data);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err: any) {
      setError(loadErrorMessage(err, 'khateebs'));
      logError('Error fetching khateebs', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (khateeb?: Khateeb) => {
    if (khateeb) {
      setEditingKhateeb(khateeb);
      reset({
        name: khateeb.name,
        nameMl: khateeb.nameMl || '',
        memberId: typeof khateeb.memberId === 'object' ? khateeb.memberId.id : khateeb.memberId,
        qualifications: khateeb.qualifications || '',
        contactNo: khateeb.contactNo || '',
        status: khateeb.status,
      });
    } else {
      setEditingKhateeb(null);
      reset({ status: 'active' });
    }
    setShowModal(true);
  };

  const onSubmit = async (data: KhateebFormData) => {
    try {
      if (editingKhateeb) {
        await religiousService.updateKhateeb(editingKhateeb.id, data);
      } else {
        await religiousService.createKhateeb(data);
      }
      setShowModal(false);
      reset();
      fetchKhateebs();
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'save khateeb' }));
    }
  };

  const handleDelete = async () => {
    if (!selectedKhateeb) return;
    try {
      setDeleting(true);
      await religiousService.deleteKhateeb(selectedKhateeb.id);
      toast.success('Khateeb deleted');
      setShowDeleteModal(false);
      setSelectedKhateeb(null);
      fetchKhateebs();
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'delete khateeb' }));
    } finally {
      setDeleting(false);
    }
  };

  const memberOptions = members.map((m) => ({
    value: m.id,
    label: toTitleCase(m.name),
  }));

  const columns = [
    {
      key: 'name',
      label: 'Khateeb',
      sortable: true,
      width: '16rem',
      render: (_: any, khateeb: Khateeb) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{toTitleCase(khateeb.name)}</p>
          {khateeb.nameMl && <p className="truncate text-xs text-muted-foreground">{khateeb.nameMl}</p>}
        </div>
      ),
    },
    {
      key: 'qualifications',
      label: 'Qualifications',
      sortable: false,
      priority: 'secondary' as const,
      width: '18rem',
      render: (_: any, khateeb: Khateeb) => khateeb.qualifications || '—',
    },
    {
      key: 'contactNo',
      label: 'Contact',
      sortable: false,
      width: '9rem',
      render: (_: any, khateeb: Khateeb) => <span className="tabular-nums">{khateeb.contactNo || '—'}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      width: '8rem',
      render: (_: any, khateeb: Khateeb) => <StatusBadge status={khateeb.status} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Khateebs"
        description="Speakers who deliver the Friday khutbah."
        actions={
          <Button icon={<FiPlus />} collapseLabel onClick={() => handleOpenModal()}>
            New khateeb
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
          searchEntity="khateebs"
          onRefresh={fetchKhateebs}
        />

        {error ? (
          <EmptyState variant="error" entity="khateebs" description={error} action={{ label: 'Try again', onClick: fetchKhateebs }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={khateebs}
              isLoading={loading}
              entity="khateebs"
              emptyVariant={debouncedSearch ? 'no-results' : 'empty'}
              emptyAction={
                debouncedSearch
                  ? { label: 'Clear filters', onClick: () => { setSearchQuery(''); setCurrentPage(1); } }
                  : { label: 'Add khateeb', onClick: () => handleOpenModal() }
              }
              onRowClick={(row) => handleOpenModal(row)}
            />

            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="khateebs"
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

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          reset();
        }}
        title={editingKhateeb ? 'Edit Khateeb' : 'New Khateeb'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Name *"
            {...register('name')}
            error={errors.name?.message}
            placeholder="Enter khateeb name"
          />

          <Input label="Name (Malayalam)" {...register('nameMl')} placeholder="Enter name in Malayalam" />

          <Select
            label="Member (Optional)"
            {...register('memberId')}
            options={memberOptions}
            placeholder="Link to a member record"
          />

          <div>
            <label className="block text-sm font-medium mb-2">Qualifications</label>
            <textarea
              aria-label="Qualifications"
              {...register('qualifications')}
              placeholder="Enter educational qualifications and Islamic background"
              className="w-full px-3 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
              rows={3}
            />
          </div>

          <Input
            label="Contact No"
            type="tel"
            inputMode="numeric"
            maxLength={10}
            {...register('contactNo')}
            onChange={(e) => setValue('contactNo', sanitizeDigits(e.target.value, 10), { shouldValidate: true, shouldDirty: true })}
            placeholder="Enter contact number"
            error={errors.contactNo?.message}
          />

          <Select label="Status" {...register('status')} options={KHATEEB_STATUS_OPTIONS} />

          <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowModal(false);
                reset();
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            {editingKhateeb && (
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  setSelectedKhateeb(editingKhateeb);
                  setShowModal(false);
                  setShowDeleteModal(true);
                }}
                disabled={isSubmitting}
              >
                Delete
              </Button>
            )}
            <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
              {editingKhateeb ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteModal}
        title={`Delete ${selectedKhateeb ? toTitleCase(selectedKhateeb.name) : 'this khateeb'}?`}
        message="This permanently removes the khateeb and cannot be undone."
        confirmLabel="Delete khateeb"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </>
  );
}
