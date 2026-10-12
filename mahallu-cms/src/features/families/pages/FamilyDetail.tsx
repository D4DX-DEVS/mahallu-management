import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FiUsers, FiAward, FiCheckCircle, FiEdit2, FiTrash2, FiPlus, FiEye, FiUpload, FiGitMerge, FiScissors, FiArchive, FiRotateCcw, FiRepeat, FiMoreHorizontal } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import Tabs from '@/components/ui/Tabs';
import EmptyState from '@/components/ui/EmptyState';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Badge from '@/components/ui/Badge';
import RowActions from '@/components/ui/RowActions';
import Avatar, { PersonCell } from '@/components/ui/Avatar';
import BloodGroupBadge from '@/components/ui/BloodGroupBadge';
import GenderChip from '@/components/ui/GenderChip';
import RoleChip from '@/components/ui/RoleChip';
import GradeChip from '@/components/ui/GradeChip';
import Dropdown from '@/components/ui/Dropdown';
import Alert from '@/components/ui/Alert';
import Table from '@/components/ui/Table';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import NeedsNewHeadBanner from '../components/NeedsNewHeadBanner';
import { ArchiveFamilyDialog, MergeFamilyDialog, SplitFamilyDialog, TransferMemberDialog } from '../components/FamilyLifecycleDialogs';
import BulkImportCsv, { ColumnSpec } from '@/components/BulkImportCsv';
import { TableColumn } from '@/types';
import { ROUTES } from '@/constants/routes';
import { familyService } from '@/services/familyService';
import { memberService } from '@/services/memberService';
import { Family, Member } from '@/types';
import { formatDate } from '@/utils/format';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { gradeLevel } from '@/utils/statSeries';

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
  const [dialog, setDialog] = useState<null | 'archive' | 'merge' | 'split'>(null);
  const [transferMember, setTransferMember] = useState<Member | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [tab, setTab] = useState('overview');
  const [showDeleteMemberDialog, setShowDeleteMemberDialog] = useState(false);
  const [selectedMemberToDelete, setSelectedMemberToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deletingMember, setDeletingMember] = useState(false);

  useEffect(() => {
    if (id) {
      fetchFamily();
      fetchMembers();
    }
  }, [id]);

  const fetchFamily = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await familyService.getById(id!);
      setFamily(data);
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load family. Refresh the page or try again."));
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

  const refresh = () => {
    fetchFamily(true);
    fetchMembers();
  };

  const handleRestore = async () => {
    if (!id) return;
    try {
      setRestoring(true);
      const r = await familyService.restore(id);
      toast.success(`Family restored${r.restoredMembers ? ` with ${r.restoredMembers} member${r.restoredMembers === 1 ? '' : 's'}` : ''}. It now appears in lists again.`);
      refresh();
    } catch (err: any) {
      toast.error(getFriendlyError(err, "We couldn't restore this family. Please try again."));
    } finally {
      setRestoring(false);
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
        <Button onClick={() => navigate(ROUTES.FAMILIES.LIST)} className="mt-4" variant="secondary">
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
      toast.error(getFriendlyError(err, `Couldn't remove ${selectedMemberToDelete.name}. Try again in a moment.`));
      setDeletingMember(false);
    }
  };

  const handleBulkImportMembers = async (rows: any[], opts?: { confirmDuplicate?: boolean }) => {
    return memberService.bulkImportMembers(id!, rows, opts);
  };

  const memberColumns: TableColumn<Member>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    {
      key: 'name',
      label: 'Name',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <PersonCell name={row.name} src={row.photoUrl} />
          {row.isFamilyHead && <RoleChip isHead />}
        </div>
      ),
    },
    {
      key: 'age',
      label: 'Age / Gender',
      render: (_, row) => (
        <span className="inline-flex items-center gap-2">
          <span>{row.age ? `${row.age}` : '-'}</span>
          <GenderChip value={row.gender} />
        </span>
      ),
    },
    { key: 'bloodGroup', label: 'Blood Group', render: (bg) => <BloodGroupBadge value={bg} /> },
    { key: 'phone', label: 'Phone', render: (phone) => phone || '-' },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <RowActions
          onView={() => navigate(ROUTES.MEMBERS.DETAIL(row.id))}
          viewLabel="View"
          onEdit={() => navigate(ROUTES.MEMBERS.EDIT(row.id))}
          onDelete={() => handleDeleteMember(row.id, row.name)}
          extra={[{ label: 'Move to another family', icon: <FiRepeat />, onClick: () => setTransferMember(row), show: !family.isArchived }]}
        />
      ),
    },
  ];

  const maleCount = members.filter((m) => m.gender === 'male').length;
  const femaleCount = members.filter((m) => m.gender === 'female').length;
  const grade = gradeLevel(family.varisangyaGrade);

  return (
    <div className="space-y-4">
      <PageHeader
        leading={<Avatar name={family.houseName} size={56} />}
        title={family.houseName}
        description="Family Details"
        actions={
          <>
            {family.isArchived ? (
              <Button variant="secondary" onClick={handleRestore} isLoading={restoring}>
                <FiRotateCcw className="h-3.5 w-3.5" />
                Restore family
              </Button>
            ) : (
              <Link to={ROUTES.FAMILIES.EDIT(family.id)}>
                <Button variant="secondary">
                  <FiEdit2 className="h-3.5 w-3.5" />
                  Edit
                </Button>
              </Link>
            )}
            <Dropdown
              trigger={
                <Button variant="secondary" aria-label="Actions">
                  <FiMoreHorizontal className="h-3.5 w-3.5" />
                  Actions
                </Button>
              }
              items={[
                { label: 'Edit', icon: <FiEdit2 />, onClick: () => navigate(ROUTES.FAMILIES.EDIT(family.id)), disabled: !!family.isArchived },
                { label: 'Merge into another family', icon: <FiGitMerge />, onClick: () => setDialog('merge'), disabled: !!family.isArchived },
                { label: 'Split family', icon: <FiScissors />, onClick: () => setDialog('split'), disabled: !!family.isArchived },
                { label: 'Archive family', icon: <FiArchive />, onClick: () => setDialog('archive'), disabled: !!family.isArchived },
              ]}
            />
          </>
        }
      />

      {family.isArchived && (
        <Alert tone="info" title="This family is archived">
          It is hidden from lists and reports. Choose Restore family to bring it back{family.archivedReason ? ` (reason: ${family.archivedReason})` : ''}.
        </Alert>
      )}
      <NeedsNewHeadBanner
        familyId={family.id}
        needsHeadReassignment={family.needsHeadReassignment && !family.isArchived}
        reason={family.needsHeadReason}
        onResolved={() => {
          toast.success('Family head updated');
          refresh();
        }}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          title="Members"
          value={members.length}
          icon={<FiUsers />}
          tone="lime"
          pills={[`${maleCount} male`, `${femaleCount} female`]}
          viz={maleCount + femaleCount > 0 ? { type: 'segments', segments: [{ value: maleCount }, { value: femaleCount, color: '#8EC13E' }] } : undefined}
          summary={`${members.length} members: ${maleCount} male, ${femaleCount} female`}
        />
        {family.varisangyaGrade && (
          <StatCard
            title="Varisangya grade"
            value={family.varisangyaGrade}
            icon={<FiAward />}
            tone="gold"
            viz={grade ? { type: 'meter', level: grade } : undefined}
            summary={`Varisangya grade ${family.varisangyaGrade}${grade ? `, level ${grade} of 5` : ''}`}
          />
        )}
        {family.status && (
          <StatCard
            title="Status"
            value={family.status.charAt(0).toUpperCase() + family.status.slice(1)}
            icon={<FiCheckCircle />}
            tone={family.status === 'approved' ? 'green' : 'gold'}
          />
        )}
      </div>

            <Tabs
        aria-label="Family sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'members', label: 'Members', count: members.length },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tab === 'overview' && (
        <>
        <Card>
          <h2 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text mb-4">
            Basic Information
          </h2>
          <div className="space-y-3">
            {family.mahallId && (
              <div>
                <span className="text-sm text-[#7B8983] dark:text-surface-muted">Mahall ID</span>
                <p className="text-[#18231E] dark:text-surface-text">{family.mahallId}</p>
              </div>
            )}
            <div>
              <span className="text-sm text-[#7B8983] dark:text-surface-muted">House Name</span>
              <div className="mt-0.5"><PersonCell name={family.houseName} size={24} /></div>
            </div>
            {family.familyHead && (
              <div>
                <span className="text-sm text-[#7B8983] dark:text-surface-muted">Family Head</span>
                <p className="text-[#18231E] dark:text-surface-text">{family.familyHead}</p>
              </div>
            )}
            {family.contactNo && (
              <div>
                <span className="text-sm text-[#7B8983] dark:text-surface-muted">Contact No.</span>
                <p className="text-[#18231E] dark:text-surface-text">{family.contactNo}</p>
              </div>
            )}
            {family.varisangyaGrade && (
              <div>
                <span className="text-sm text-[#7B8983] dark:text-surface-muted">Varisangya Grade</span>
                <p className="mt-0.5"><GradeChip value={family.varisangyaGrade} /></p>
              </div>
            )}
            {family.status && (
              <div>
                <span className="text-sm text-[#7B8983] dark:text-surface-muted">Status</span>
                <div className="mt-0.5"><StatusBadge status={family.status} /></div>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text mb-4">
            Address Information
          </h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-[#7B8983] dark:text-surface-muted">State</span>
              <p className="text-[#18231E] dark:text-surface-text">{family.state}</p>
            </div>
            <div>
              <span className="text-sm text-[#7B8983] dark:text-surface-muted">District</span>
              <p className="text-[#18231E] dark:text-surface-text">{family.district}</p>
            </div>
            <div>
              <span className="text-sm text-[#7B8983] dark:text-surface-muted">LSG Name</span>
              <p className="text-[#18231E] dark:text-surface-text">{family.lsgName}</p>
            </div>
            <div>
              <span className="text-sm text-[#7B8983] dark:text-surface-muted">Village</span>
              <p className="text-[#18231E] dark:text-surface-text">{family.village}</p>
            </div>
            {family.pinCode && (
              <div>
                <span className="text-sm text-[#7B8983] dark:text-surface-muted">Pin Code</span>
                <p className="text-[#18231E] dark:text-surface-text">{family.pinCode}</p>
              </div>
            )}
            {family.postOffice && (
              <div>
                <span className="text-sm text-[#7B8983] dark:text-surface-muted">Post Office</span>
                <p className="text-[#18231E] dark:text-surface-text">{family.postOffice}</p>
              </div>
            )}
          </div>
        </Card>
        </>
        )}

        {tab === 'members' && (
        <Card className="md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text">
              Family Members ({members.length})
            </h2>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setIsImportOpen(true)}>
                <FiUpload className="h-3.5 w-3.5" />
                Import Members
              </Button>
              <Link to={ROUTES.MEMBERS.CREATE}>
                <Button size="sm">
                  <FiPlus className="h-3.5 w-3.5" />
                  Add Member
                </Button>
              </Link>
            </div>
          </div>
          {members.length > 0 ? (
            <Table columns={memberColumns} data={members} />
          ) : (
            <EmptyState title="No members found" description="Add a member to get started." />
          )}
        </Card>
        )}
      </div>

      <ArchiveFamilyDialog
        open={dialog === 'archive'}
        familyId={family.id}
        houseName={family.houseName}
        onClose={() => setDialog(null)}
        onDone={(msg) => {
          toast.success(msg || 'Family archived.');
          navigate(ROUTES.FAMILIES.LIST);
        }}
      />
      <MergeFamilyDialog
        open={dialog === 'merge'}
        familyId={family.id}
        houseName={family.houseName}
        onClose={() => setDialog(null)}
        onDone={(msg) => {
          toast.success(msg || 'Families merged.');
          navigate(ROUTES.FAMILIES.LIST);
        }}
      />
      <SplitFamilyDialog
        open={dialog === 'split'}
        familyId={family.id}
        houseName={family.houseName}
        onClose={() => setDialog(null)}
        onDone={(msg) => {
          toast.success(msg || 'Family split.');
          setDialog(null);
          refresh();
        }}
      />
      {transferMember && (
        <TransferMemberDialog
          open
          member={transferMember}
          currentFamilyId={family.id}
          onClose={() => setTransferMember(null)}
          onDone={(msg) => {
            toast.success(msg || `${transferMember.name} moved to the new family.`);
            setTransferMember(null);
            refresh();
          }}
        />
      )}

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
        title="Remove member?"
        message={`Remove ${selectedMemberToDelete?.name} from this family?`}
        consequence="The member will be removed from the family roll. This cannot be undone."
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

