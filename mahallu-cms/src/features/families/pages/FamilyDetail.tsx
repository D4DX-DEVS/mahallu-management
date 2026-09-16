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
import StatusBadge from '@/components/ui/StatusBadge';

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
    <div className="space-y-5">
      <PageHeader
        title={toTitleCase(family.houseName)}
        description={`Family • ${family.mahallId || '—'} • ${toTitleCase(family.area || family.place || '')}`}
        actions={
          <>
            <Link to={ROUTES.FAMILIES.EDIT(family.id)}>
              <Button variant="outline" icon={<FiEdit2 />} collapseLabel>Edit</Button>
            </Link>
            <Button variant="ghost" onClick={() => setShowDeleteModal(true)} icon={<FiTrash2 />} collapseLabel>
              Delete
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card padding="lg">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Household</h2>
          <dl className="space-y-3">
            {family.mahallId && (
              <div className="flex justify-between gap-4 py-1 text-sm">
                <dt className="text-muted-foreground">Mahall ID</dt>
                <dd className="font-medium tabular-nums text-foreground">{family.mahallId}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4 py-1 text-sm">
              <dt className="text-muted-foreground">House name</dt>
              <dd className="font-medium text-foreground">{toTitleCase(family.houseName)}</dd>
            </div>
            {family.familyHead && (
              <div className="flex justify-between gap-4 py-1 text-sm">
                <dt className="text-muted-foreground">Family head</dt>
                <dd className="font-medium text-foreground">{toTitleCase(family.familyHead)}</dd>
              </div>
            )}
            {family.contactNo && (
              <div className="flex justify-between gap-4 py-1 text-sm">
                <dt className="text-muted-foreground">Contact</dt>
                <dd className="font-medium tabular-nums text-foreground">{family.contactNo}</dd>
              </div>
            )}
            {family.varisangyaGrade && (
              <div className="flex justify-between gap-4 py-1 text-sm">
                <dt className="text-muted-foreground">Varisangya</dt>
                <dd className="font-medium text-foreground">{toTitleCase(family.varisangyaGrade)}</dd>
              </div>
            )}
            {family.status && (
              <div className="flex justify-between gap-4 py-1 text-sm">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <StatusBadge status={family.status} />
                </dd>
              </div>
            )}
          </dl>
        </Card>

        <Card padding="lg">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Location</h2>
          <dl className="space-y-3">
            <div className="flex justify-between gap-4 py-1 text-sm">
              <dt className="text-muted-foreground">State</dt>
              <dd className="font-medium text-foreground">{toTitleCase(family.state)}</dd>
            </div>
            <div className="flex justify-between gap-4 py-1 text-sm">
              <dt className="text-muted-foreground">District</dt>
              <dd className="font-medium text-foreground">{toTitleCase(family.district)}</dd>
            </div>
            <div className="flex justify-between gap-4 py-1 text-sm">
              <dt className="text-muted-foreground">LSG</dt>
              <dd className="font-medium text-foreground">{toTitleCase(family.lsgName)}</dd>
            </div>
            <div className="flex justify-between gap-4 py-1 text-sm">
              <dt className="text-muted-foreground">Village</dt>
              <dd className="font-medium text-foreground">{toTitleCase(family.village)}</dd>
            </div>
            {family.pinCode && (
              <div className="flex justify-between gap-4 py-1 text-sm">
                <dt className="text-muted-foreground">Pin code</dt>
                <dd className="font-medium tabular-nums text-foreground">{family.pinCode}</dd>
              </div>
            )}
            {family.postOffice && (
              <div className="flex justify-between gap-4 py-1 text-sm">
                <dt className="text-muted-foreground">Post office</dt>
                <dd className="font-medium text-foreground">{toTitleCase(family.postOffice)}</dd>
              </div>
            )}
          </dl>
        </Card>

        <TableCard className="lg:col-span-2">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Members <span className="font-normal tabular-nums text-muted-foreground">· {members.length}</span>
            </h2>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setIsImportOpen(true)} icon={<FiUpload />} collapseLabel>
                Import
              </Button>
              <Link to={ROUTES.MEMBERS.CREATE}>
                <Button size="sm" icon={<FiPlus />} collapseLabel>Add member</Button>
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
