import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FiEdit2, FiArrowLeft, FiTrash2, FiPlus, FiEye, FiUpload } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import Table from '@/components/ui/Table';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import BulkImportCsv, { ColumnSpec } from '@/components/BulkImportCsv';
import { TableColumn } from '@/types';
import { ROUTES } from '@/constants/routes';
import { familyService } from '@/services/familyService';
import { memberService } from '@/services/memberService';
import { Family, Member } from '@/types';
import { formatDate } from '@/utils/format';
import { toast } from '@/store/toastStore';

const MEMBER_COLUMNS: ColumnSpec[] = [
  { key: 'name', label: 'Name', required: true },
  { key: 'nameMl', label: 'Name (Malayalam)' },
  { key: 'gender', label: 'Gender' },
  { key: 'age', label: 'Age' },
  { key: 'maritalStatus', label: 'Marital Status' },
  { key: 'education', label: 'Education' },
  { key: 'occupation', label: 'Occupation' },
];

const MEMBER_TEMPLATE = 'name,nameMl,gender,age,maritalStatus,education,occupation\nAhmed Ali,അഹമ്മദ് അലി,male,30,married,Bachelor,Engineer\nFatima Ahmed,ഫാറ്റിമ അഹമ്മദ്,female,28,married,Bachelor,Homemaker\n';

export default function FamilyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [family, setFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [showDeleteMemberDialog, setShowDeleteMemberDialog] = useState(false);
  const [selectedMemberToDelete, setSelectedMemberToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deletingMember, setDeletingMember] = useState(false);

  useEffect(() => {
    if (id) {
      fetchFamily();
      fetchMembers();
    }
  }, [id]);

  const fetchFamily = async () => {
    try {
      setLoading(true);
      const data = await familyService.getById(id!);
      setFamily(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load family');
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const data = await memberService.getByFamily(id!);
      setMembers(data);
    } catch (err) {
      console.error('Error fetching members:', err);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      setDeleting(true);
      await familyService.delete(id);
      navigate(ROUTES.FAMILIES.LIST);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete family');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !family) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">{error || 'Family not found'}</p>
        <Button onClick={() => navigate(ROUTES.FAMILIES.LIST)} className="mt-4" variant="outline">
          Back to Families
        </Button>
      </div>
    );
  }

  const handleDeleteMember = (memberId: string, memberName: string) => {
    setSelectedMemberToDelete({ id: memberId, name: memberName });
    setShowDeleteMemberDialog(true);
  };

  const confirmDeleteMember = async () => {
    if (!selectedMemberToDelete) return;
    try {
      setDeletingMember(true);
      await memberService.delete(selectedMemberToDelete.id);
      await fetchMembers();
      toast.success(`${selectedMemberToDelete.name} removed from family`);
      setShowDeleteMemberDialog(false);
      setSelectedMemberToDelete(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || `Failed to remove ${selectedMemberToDelete.name}`);
      setDeletingMember(false);
    }
  };

  const handleBulkImportMembers = async (rows: any[]) => {
    return memberService.bulkImportMembers(id!, rows);
  };

  const memberColumns: TableColumn<Member>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    { key: 'name', label: 'Name' },
    {
      key: 'age',
      label: 'Age / Gender',
      render: (_, row) => {
        const age = row.age ? `${row.age}` : '-';
        const gender = row.gender || '-';
        return `${age} / ${gender}`;
      },
    },
    { key: 'bloodGroup', label: 'Blood Group', render: (bg) => bg || '-' },
    { key: 'phone', label: 'Phone', render: (phone) => phone || '-' },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(ROUTES.MEMBERS.DETAIL(row.id));
            }}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
            title="View"
          >
            <FiEye className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(ROUTES.MEMBERS.EDIT(row.id));
            }}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
            title="Edit"
          >
            <FiEdit2 className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteMember(row.id, row.name);
            }}
            className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors"
            title="Delete"
          >
            <FiTrash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {family.houseName}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Family Details
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Breadcrumb
            items={[
              { label: 'Dashboard', path: '/dashboard' },
              { label: 'Families', path: ROUTES.FAMILIES.LIST },
              { label: family.houseName },
            ]}
          />
          <div className="flex gap-2">
            <Link to={ROUTES.FAMILIES.EDIT(family.id)}>
              <Button variant="outline">
                <FiEdit2 className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </Link>
            <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
              <FiTrash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Basic Information
          </h2>
          <div className="space-y-3">
            {family.mahallId && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Mahall ID</span>
                <p className="text-gray-900 dark:text-gray-100">{family.mahallId}</p>
              </div>
            )}
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">House Name</span>
              <p className="text-gray-900 dark:text-gray-100">{family.houseName}</p>
            </div>
            {family.familyHead && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Family Head</span>
                <p className="text-gray-900 dark:text-gray-100">{family.familyHead}</p>
              </div>
            )}
            {family.contactNo && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Contact No.</span>
                <p className="text-gray-900 dark:text-gray-100">{family.contactNo}</p>
              </div>
            )}
            {family.varisangyaGrade && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Varisangya Grade</span>
                <p className="text-gray-900 dark:text-gray-100">{family.varisangyaGrade}</p>
              </div>
            )}
            {family.status && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Status</span>
                <span
                  className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                    family.status === 'approved'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : family.status === 'unapproved'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                  }`}
                >
                  {family.status}
                </span>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Address Information
          </h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">State</span>
              <p className="text-gray-900 dark:text-gray-100">{family.state}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">District</span>
              <p className="text-gray-900 dark:text-gray-100">{family.district}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">LSG Name</span>
              <p className="text-gray-900 dark:text-gray-100">{family.lsgName}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Village</span>
              <p className="text-gray-900 dark:text-gray-100">{family.village}</p>
            </div>
            {family.pinCode && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Pin Code</span>
                <p className="text-gray-900 dark:text-gray-100">{family.pinCode}</p>
              </div>
            )}
            {family.postOffice && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Post Office</span>
                <p className="text-gray-900 dark:text-gray-100">{family.postOffice}</p>
              </div>
            )}
          </div>
        </Card>

        <Card className="md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Family Members ({members.length})
            </h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setIsImportOpen(true)}>
                <FiUpload className="h-4 w-4 mr-2" />
                Import Members
              </Button>
              <Link to={ROUTES.MEMBERS.CREATE}>
                <Button size="sm">
                  <FiPlus className="h-4 w-4 mr-2" />
                  Add Member
                </Button>
              </Link>
            </div>
          </div>
          {members.length > 0 ? (
            <Table columns={memberColumns} data={members} />
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No members found. Add a member to get started.
            </p>
          )}
        </Card>
      </div>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Family"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={deleting}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-gray-600 dark:text-gray-400">
          Are you sure you want to delete <strong>{family.houseName}</strong>? This will also delete all associated members. This action cannot be undone.
        </p>
      </Modal>

      <BulkImportCsv
        title="Import Members to Family"
        columnSpec={MEMBER_COLUMNS}
        templateCsv={MEMBER_TEMPLATE}
        onImport={handleBulkImportMembers}
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImported={fetchMembers}
      />

      <ConfirmDialog
        isOpen={showDeleteMemberDialog}
        title="Remove Member"
        message={`Remove ${selectedMemberToDelete?.name} from this family?`}
        consequence="The member will be removed from the family roll. This action cannot be undone."
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={deletingMember}
        onConfirm={confirmDeleteMember}
        onCancel={() => {
          setShowDeleteMemberDialog(false);
          setSelectedMemberToDelete(null);
        }}
      />
    </div>
  );
}

