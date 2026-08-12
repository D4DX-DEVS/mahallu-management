import { useState, useEffect } from 'react';
import { FiEdit2, FiTrash2, FiPlus, FiX } from 'react-icons/fi';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { Khateeb, religiousService, KHATEEB_STATUS_OPTIONS } from '@/services/religiousService';
import { memberService } from '@/services/memberService';
import { useDebounce } from '@/hooks/useDebounce';
import { ROUTES } from '@/constants/routes';
import { Member } from '@/types';

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
      setError(err.response?.data?.message || 'Failed to fetch khateebs');
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
        memberId: typeof khateeb.memberId === 'object' ? khateeb.memberId._id : khateeb.memberId,
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
        await religiousService.updateKhateeb(editingKhateeb._id, data);
      } else {
        await religiousService.createKhateeb(data);
      }
      setShowModal(false);
      reset();
      fetchKhateebs();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save khateeb');
    }
  };

  const handleDelete = async () => {
    if (!selectedKhateeb) return;
    try {
      setDeleting(true);
      await religiousService.deleteKhateeb(selectedKhateeb._id);
      setShowDeleteModal(false);
      setSelectedKhateeb(null);
      fetchKhateebs();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete khateeb');
    } finally {
      setDeleting(false);
    }
  };

  const memberOptions = members.map((m) => ({
    value: m.id,
    label: m.name,
  }));

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (khateeb: Khateeb) => (
        <div>
          <p className="font-medium">{khateeb.name}</p>
          {khateeb.nameMl && <p className="text-sm text-gray-600">{khateeb.nameMl}</p>}
        </div>
      ),
    },
    {
      key: 'qualifications',
      label: 'Qualifications',
      render: (khateeb: Khateeb) => khateeb.qualifications || '—',
    },
    {
      key: 'contactNo',
      label: 'Contact',
      render: (khateeb: Khateeb) => khateeb.contactNo || '—',
    },
    {
      key: 'status',
      label: 'Status',
      render: (khateeb: Khateeb) => (
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${
            khateeb.status === 'active'
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {khateeb.status === 'active' ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (khateeb: Khateeb) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenModal(khateeb)}
          >
            <FiEdit2 className="inline mr-1" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSelectedKhateeb(khateeb);
              setShowDeleteModal(true);
            }}
          >
            <FiTrash2 className="inline mr-1" />
            Delete
          </Button>
        </div>
      ),
    },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: ROUTES.DASHBOARD },
          { label: 'Khateebs', path: ROUTES.RELIGIOUS.KHATEEBS },
        ]}
      />

      {error && <div className="p-4 bg-red-100 text-red-800 rounded">{error}</div>}

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <input
          type="text"
          placeholder="Search khateebs by name..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="flex-1 px-4 py-2 border rounded"
        />
        <Button onClick={() => handleOpenModal()}>
          <FiPlus className="inline mr-2" />
          New Khateeb
        </Button>
      </div>

      <Card>
        <Table columns={columns} data={khateebs} />
      </Card>

      {pagination && <Pagination {...pagination} onPageChange={setCurrentPage} />}

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

          <Input
            label="Name (Malayalam)"
            {...register('nameMl')}
            placeholder="Enter name in Malayalam"
          />

          <Select
            label="Member (Optional)"
            {...register('memberId')}
            options={memberOptions}
            placeholder="Link to a member record"
          />

          <div>
            <label className="block text-sm font-medium mb-2">Qualifications</label>
            <textarea
              {...register('qualifications')}
              placeholder="Enter educational qualifications and Islamic background"
              className="w-full px-3 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
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
            options={KHATEEB_STATUS_OPTIONS}
          />

          <div className="flex gap-3 justify-end pt-4">
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
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={deleting}
              isLoading={deleting}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
