import { useState, useEffect } from 'react';
import ActionsMenu from '@/components/ui/ActionsMenu';
import { FiEdit2, FiTrash2, FiPlus } from 'react-icons/fi';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import TableCard from '@/components/ui/TableCard';
import ExpandableSearch from '@/components/ui/ExpandableSearch';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import { PageSkeleton } from '@/components/ui/Skeleton';
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

const khateebSchema = z.object({
  name: z.string().max(200, 'Please keep the name to 200 characters or less.').min(1, 'Name is required'),
  nameMl: z.string().max(200, 'Please keep the name to 200 characters or less.').optional(),
  memberId: z.string().max(200, 'Please keep the member to 200 characters or less.').optional(),
  qualifications: z.string().max(200, 'Please keep the qualifications to 200 characters or less.').optional(),
  contactNo: z.string().max(200, 'Please keep the contact no to 200 characters or less.').optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

type KhateebFormData = z.infer<typeof khateebSchema>;

export default function KhateebsList() {
  const [khateebs, setKhateebs] = useState<Khateeb[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
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
  }, [debouncedSearch, currentPage]);

  const fetchMembers = async () => {
    try {
      setLoadingMembers(true);
      const result = await memberService.getAll({ limit: 1000 });
      setMembers(result.data || []);
    } catch (err) {
      console.error('Error fetching members:', err);
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
      console.error('Error fetching khateebs:', err);
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
      setError(null);
      if (editingKhateeb) {
        await religiousService.updateKhateeb(editingKhateeb.id, data);
      } else {
        await religiousService.createKhateeb(data);
      }
      setShowModal(false);
      reset();
      fetchKhateebs();
    } catch (err: any) {
      setError(errorMessage(err, { action: 'save khateeb' }));
    }
  };

  const handleDelete = async () => {
    if (!selectedKhateeb) return;
    try {
      setDeleting(true);
      await religiousService.deleteKhateeb(selectedKhateeb.id);
      setShowDeleteModal(false);
      setSelectedKhateeb(null);
      fetchKhateebs();
    } catch (err: any) {
      setError(errorMessage(err, { action: 'delete khateeb' }));
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
      label: 'Name',
      render: (_: any, khateeb: Khateeb) => (
        <div>
          <p className="font-medium">{toTitleCase(khateeb.name)}</p>
          {khateeb.nameMl && <p className="text-sm text-gray-600">{khateeb.nameMl}</p>}
        </div>
      ),
    },
    {
      key: 'qualifications',
      label: 'Qualifications',
      render: (_: any, khateeb: Khateeb) => khateeb.qualifications || '—',
    },
    {
      key: 'contactNo',
      label: 'Contact',
      render: (_: any, khateeb: Khateeb) => khateeb.contactNo || '—',
    },
    {
      key: 'status',
      label: 'Status',
      render: (_: any, khateeb: Khateeb) => (
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${
            khateeb.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {khateeb.status === 'active' ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'center' as const,
      render: (_: any, khateeb: Khateeb) => (
        <ActionsMenu
          label={'Actions for ' + toTitleCase(khateeb.name)}
          items={[
            {
              label: 'Edit',
              icon: <FiEdit2 className="h-4 w-4" />,
              onClick: () => handleOpenModal(khateeb),
            },
            {
              label: 'Delete',
              icon: <FiTrash2 className="h-4 w-4" />,
              onClick: () => {
                setSelectedKhateeb(khateeb);
                setShowDeleteModal(true);
              },
              variant: 'danger' as const,
            },
          ]}
        />
      ),
    },
  ];

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-4">
      <PageHeader title="Khateebs" />

      {error && <div className="p-4 bg-red-100 text-red-800 rounded">{error}</div>}

      <div className="flex gap-4 justify-between items-center">
        <ExpandableSearch
          value={searchQuery}
          onChange={(value) => {
            setSearchQuery(value);
            setCurrentPage(1);
          }}
          entity="khateebs"
          placeholder="Search khateebs by name"
        />
        <Button onClick={() => handleOpenModal()} icon={<FiPlus />} collapseLabel>New Khateeb</Button>
      </div>

      <TableCard>
        <Table fixedLayout striped columns={columns} data={khateebs} />
      </TableCard>

      {pagination && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          itemsPerPage={pagination.limit}
          entity="khateebs"
          onPageChange={setCurrentPage}
        />
      )}

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

          <Input label="Contact No" {...register('contactNo')} placeholder="Enter contact number" />

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
            <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
              {editingKhateeb ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Confirm Delete">
        <div className="space-y-4">
          <p>Are you sure you want to delete this khateeb?</p>
          <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-3">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting} isLoading={deleting}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
