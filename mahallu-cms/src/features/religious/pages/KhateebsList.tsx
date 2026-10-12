import { useState, useEffect } from 'react';
import { FiPlus } from 'react-icons/fi';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import RowActions from '@/components/ui/RowActions';
import { PersonCell } from '@/components/ui/Avatar';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import StatusBadge from '@/components/ui/StatusBadge';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Input, { controlClasses, labelClasses } from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { Khateeb, religiousService, KHATEEB_STATUS_OPTIONS } from '@/services/religiousService';
import { memberService } from '@/services/memberService';
import { useDebounce } from '@/hooks/useDebounce';
import { Member, TableColumn } from '@/types';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const khateebSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  nameMl: z.string().optional(),
  memberId: z.string().optional(),
  qualifications: z.string().optional(),
  contactNo: z.string().optional(),
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
      setError(getFriendlyError(err, "Couldn't load khateebs. Refresh the page or try again."));
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
      toast.error(getFriendlyError(err, "Couldn't save khateeb. Check the details and try again."));
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
      toast.error(getFriendlyError(err, "Couldn't delete khateeb. Try again in a moment."));
    } finally {
      setDeleting(false);
    }
  };

  const memberOptions = members.map((m) => ({
    value: m.id,
    label: m.name,
  }));

  const columns: TableColumn<Khateeb>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (_, khateeb) => (
        <PersonCell name={khateeb.name} size={32} subtitle={khateeb.nameMl} />
      ),
    },
    {
      key: 'qualifications',
      label: 'Qualifications',
      render: (_, khateeb) => khateeb.qualifications || '—',
    },
    {
      key: 'contactNo',
      label: 'Contact',
      render: (_, khateeb) => khateeb.contactNo || '—',
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, khateeb) => (
        <StatusBadge status={khateeb.status} label={khateeb.status === 'active' ? 'Active' : 'Inactive'} />
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, khateeb) => (
        <RowActions
          onEdit={() => handleOpenModal(khateeb)}
          onDelete={() => {
            setSelectedKhateeb(khateeb);
            setShowDeleteModal(true);
          }}
          ariaLabels={{ edit: 'Edit khateeb', delete: 'Delete khateeb' }}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Khateebs"
        description="Friday khutbah speakers of the mahall"
        actions={
          <Button onClick={() => handleOpenModal()}>
            <FiPlus className="h-3.5 w-3.5" />
            New khateeb
          </Button>
        }
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{
            value: searchQuery,
            onChange: (value) => {
              setSearchQuery(value);
              setCurrentPage(1);
            },
            placeholder: 'Search khateebs by name',
          }}
        />

        <div className="p-3.5">
          {loading ? (
            <LoadingSpinner />
          ) : khateebs.length === 0 ? (
            <EmptyState title="No khateebs found" description="Add a khateeb to schedule khutbahs." />
          ) : (
            <Table columns={columns} data={khateebs} showExport={false} />
          )}

          {pagination && (
            <div className="mt-3.5">
              <Pagination {...pagination} onPageChange={setCurrentPage} />
            </div>
          )}
        </div>
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          reset();
        }}
        title={editingKhateeb ? 'Edit Khateeb' : 'New Khateeb'}
        description="Khateeb profile and contact details"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Name *"
            {...register('name')}
            error={errors.name?.message}
            placeholder="Enter khateeb name"
          />

          <Input
            label="Name (Malayalam)"
            {...register('nameMl')}
            placeholder="Enter name in Malayalam"
          />

          <Select
            label="Member (Optional)"
            {...register('memberId')}
            value={watch('memberId') || ''}
            options={memberOptions}
            placeholder="Link to a member record"
          />

          <div>
            <label htmlFor="khateeb-qualifications" className={labelClasses}>Qualifications</label>
            <textarea
              id="khateeb-qualifications"
              {...register('qualifications')}
              placeholder="Enter educational qualifications and Islamic background"
              className={`${controlClasses} resize-none py-2`}
              rows={3}
            />
          </div>

          <Input
            label="Contact No"
            {...register('contactNo')}
            placeholder="Enter contact number"
          />

          <Select
            label="Status"
            {...register('status')}
            value={watch('status') || ''}
            options={KHATEEB_STATUS_OPTIONS}
          />

          <div className="flex justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="secondary"
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
      <ConfirmDialog
        isOpen={showDeleteModal}
        title="Confirm Delete"
        message="This khateeb will be deleted. This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
}
