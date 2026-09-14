import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FiEdit2, FiTrash2, FiPlus, FiEye, FiUpload } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import { PageSkeleton } from '@/components/ui/Skeleton';
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
import { errorMessage, loadErrorMessage, pluralise } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';
import ActionsMenu from '@/components/ui/ActionsMenu';

const MEMBER_COLUMNS: ColumnSpec[] = [
  { key: 'name', label: 'Name', required: true },
  { key: 'nameMl', label: 'Name (Malayalam)' },
  { key: 'gender', label: 'Gender' },
  { key: 'age', label: 'Age' },
  { key: 'maritalStatus', label: 'Marital Status' },
  { key: 'education', label: 'Education' },
  { key: 'occupation', label: 'Occupation' },
];

const MEMBER_TEMPLATE =
  'name,nameMl,gender,age,maritalStatus,education,occupation\nAhmed Ali,അഹമ്മദ് അലി,male,30,married,Bachelor,Engineer\nFatima Ahmed,ഫാറ്റിമ അഹമ്മദ്,female,28,married,Bachelor,Homemaker\n';

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
  const [selectedMemberToDelete, setSelectedMemberToDelete] = useState<{ id: string; name: string } | null>(
    null
  );
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
      setError(loadErrorMessage(err, 'family'));
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
      setError(errorMessage(err, { action: 'delete family' }));
      setDeleting(false);
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  if (error || !family) {
    return (
      <div className="text-center py-10">
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
      toast.error(errorMessage(err, { action: `remove ${selectedMemberToDelete.name}` }));
      setDeletingMember(false);
    }
  };

  const handleBulkImportMembers = async (rows: any[]) => {
    return memberService.bulkImportMembers(id!, rows);
  };

  const memberColumns: TableColumn<Member>[] = [
    { key: 'name', label: 'Name', width: '6.75rem', render: (v) => <span>{toTitleCase(v)}</span> },
    {
      key: 'age',
      label: 'Age / Gender',
      width: '12rem',
      align: 'center',
      render: (_, row) => {
        const age = row.age ? `${row.age}` : '-';
        const gender = row.gender || '-';
        return `${age} / ${gender}`;
      },
    },
    { key: 'bloodGroup', label: 'Blood Group', width: '9.75rem', render: (bg) => bg || '-' },
    { key: 'phone', label: 'Phone', width: '6.75rem', render: (phone) => phone || '-' },
    {
      key: 'actions',
      label: 'Actions',
      width: '8rem',
      align: 'center',
      render: (_, row) => (
        <ActionsMenu
          items={[
            {
              label: 'View',
              icon: <FiEye className="h-4 w-4" />,
              onClick: () => {
                navigate(ROUTES.MEMBERS.DETAIL(row.id));
              },
            },
            {
              label: 'Edit',
              icon: <FiEdit2 className="h-4 w-4" />,
              onClick: () => {
                navigate(ROUTES.MEMBERS.EDIT(row.id));
              },
            },
            {
              label: 'Delete',
              icon: <FiTrash2 className="h-4 w-4" />,
              onClick: () => {
                handleDeleteMember(row.id, toTitleCase(row.name));
              },
              variant: 'danger',
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center justify-between">
        <div className="flex items-center gap-4">
          <PageHeader
            description="Family Details"
            title={toTitleCase(family.houseName)}
            breadcrumbs={[{ label: 'Families', path: ROUTES.FAMILIES.LIST }]}
          />
          <div className="flex gap-2 items-center">
            <Link to={ROUTES.FAMILIES.EDIT(family.id)}>
              <Button variant="outline" icon={<FiEdit2 />} collapseLabel>Edit</Button>
            </Link>
            <Button variant="danger" onClick={() => setShowDeleteModal(true)} icon={<FiTrash2 />} collapseLabel>Delete</Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <h2 className="text-lg font-semibold mb-3 text-foreground">Basic Information</h2>
          <div className="space-y-3">
            {family.mahallId && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Mahall ID</span>
                <p className="text-gray-900 dark:text-gray-100">{family.mahallId}</p>
              </div>
            )}
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">House Name</span>
              <p className="text-gray-900 dark:text-gray-100">{toTitleCase(family.houseName)}</p>
            </div>
            {family.familyHead && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Family Head</span>
                <p className="text-gray-900 dark:text-gray-100">{toTitleCase(family.familyHead)}</p>
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
                <p className="text-gray-900 dark:text-gray-100">{toTitleCase(family.varisangyaGrade)}</p>
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
          <h2 className="text-lg font-semibold mb-3 text-foreground">Address Information</h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">House Name</span>
              <p className="text-gray-900 dark:text-gray-100">{toTitleCase(family.houseName)}</p>
            </div>
            {family.houseNo && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">House No.</span>
                <p className="text-gray-900 dark:text-gray-100">{family.houseNo}</p>
              </div>
            )}
            {family.wardNumber && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Ward Number</span>
                <p className="text-gray-900 dark:text-gray-100">{family.wardNumber}</p>
              </div>
            )}
            {family.area && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Area</span>
                <p className="text-gray-900 dark:text-gray-100">{toTitleCase(family.area)}</p>
              </div>
            )}
            {family.place && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Address</span>
                <p className="text-gray-900 dark:text-gray-100">{toTitleCase(family.place)}</p>
              </div>
            )}
          </div>
        </Card>

        <TableCard className="md:col-span-2">
          <div className="flex gap-2 items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              Family Members ({members.length})
            </h2>
            <div className="flex gap-2 items-center">
              <Button size="sm" variant="outline" onClick={() => setIsImportOpen(true)} icon={<FiUpload />} collapseLabel>Import Members</Button>
              <Link to={ROUTES.MEMBERS.CREATE}>
                <Button size="sm" icon={<FiPlus />} collapseLabel>Add Member</Button>
              </Link>
            </div>
          </div>
          {members.length > 0 ? (
            <Table fixedLayout striped columns={memberColumns} data={members} />
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No members found. Add a member to get started.
            </p>
          )}
        </TableCard>
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
          Are you sure you want to delete <strong>{toTitleCase(family.houseName)}</strong>? This permanently removes
          the family record.{' '}
          {members.length > 0
            ? `${pluralise(members.length, 'member')} will be left without a family. Move them first if you need them kept intact.`
            : ''}{' '}
          This action cannot be undone.
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
