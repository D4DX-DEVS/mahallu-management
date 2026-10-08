import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FiEdit2, FiTrash2, FiPlus, FiEye, FiUpload } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import DetailSection from '@/components/ui/DetailSection';
import { RiBarChartBoxLine, RiGroupLine, RiHome5Line, RiMapPin2Line } from 'react-icons/ri';
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

  const socio = family as Family & {
    economicStatus?: string;
    welfareStatus?: string;
    housingType?: string;
    specialRequirements?: string;
  };
  const humanise = (value?: string) => (value ? toTitleCase(String(value).replace(/_/g, ' ')) : undefined);

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

      {/* One compact record panel: label-over-value fields flowing across the
          width, empty fields left out, so the members list sits in the first
          screenful instead of below three half-empty cards. */}
      <Card padding="none" className="divide-y divide-border">
        <DetailSection
          title="Household"
          icon={RiHome5Line}
          items={[
            { label: 'Mahall ID', value: family.mahallId },
            { label: 'House name', value: toTitleCase(family.houseName) },
            { label: 'House name (Malayalam)', value: family.houseNameMl, malayalam: true },
            { label: 'Family head', value: family.familyHead && toTitleCase(family.familyHead) },
            { label: 'Family head (Malayalam)', value: family.familyHeadMl, malayalam: true },
            { label: 'Contact', value: family.contactNo },
            { label: 'Varisangya', value: family.varisangyaGrade && toTitleCase(family.varisangyaGrade) },
            { label: 'Status', value: family.status && <StatusBadge status={family.status} /> },
          ]}
        />
        <DetailSection
          title="Location"
          icon={RiMapPin2Line}
          items={[
            { label: 'House no.', value: family.houseNo },
            { label: 'Ward number', value: family.wardNumber },
            { label: 'Area', value: family.area && toTitleCase(family.area) },
            { label: 'Area (Malayalam)', value: family.areaMl, malayalam: true },
            { label: 'Village', value: family.village && toTitleCase(family.village) },
            { label: 'LSG', value: family.lsgName && toTitleCase(family.lsgName) },
            { label: 'District', value: family.district && toTitleCase(family.district) },
            { label: 'State', value: family.state && toTitleCase(family.state) },
            { label: 'Post office', value: family.postOffice && toTitleCase(family.postOffice) },
            { label: 'PIN code', value: family.pinCode },
            { label: 'Address', value: family.place && toTitleCase(family.place), wide: true },
            { label: 'Address (Malayalam)', value: family.placeMl, malayalam: true, wide: true },
          ]}
        />
        <DetailSection
          title="Socio-economic"
          icon={RiBarChartBoxLine}
          emptyText="No socio-economic details recorded."
          items={[
            { label: 'Economic status', value: humanise(socio.economicStatus) },
            { label: 'Welfare status', value: humanise(socio.welfareStatus) },
            { label: 'Housing type', value: humanise(socio.housingType) },
            { label: 'Special requirements', value: socio.specialRequirements, wide: true },
          ]}
        />
      </Card>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <RiGroupLine className="h-4 w-4 text-primary" aria-hidden="true" />
            Members <span className="font-normal tabular-nums text-muted-foreground">· {members.length}</span>
          </h2>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setIsImportOpen(true)} icon={<FiUpload />} collapseLabel>
              Import
            </Button>
            {/* The new member belongs to this family: the form opens with it filled in and locked. */}
            <Link to={`${ROUTES.MEMBERS.CREATE}?familyId=${family.id}`}>
              <Button size="sm" icon={<FiPlus />} collapseLabel>Add member</Button>
            </Link>
          </div>
        </div>
        {members.length > 0 ? (
          <Table
            fixedLayout
            columns={memberColumns}
            data={members}
            onRowClick={(row) => navigate(ROUTES.MEMBERS.DETAIL(row.id))}
          />
        ) : (
          <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
            No members yet. Add the first member of this household.
          </p>
        )}
      </section>

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
