import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FiEdit2, FiTrash2, FiRepeat } from 'react-icons/fi';
import Avatar, { PersonCell } from '@/components/ui/Avatar';
import BloodGroupBadge from '@/components/ui/BloodGroupBadge';
import { TransferMemberDialog } from '@/features/families/components/FamilyLifecycleDialogs';
import { toast } from '@/store/toastStore';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import { ROUTES } from '@/constants/routes';
import { memberService } from '@/services/memberService';
import { Member } from '@/types';
import { formatDate } from '@/utils/format';
import StatusBadge from '@/components/ui/StatusBadge';
import GenderChip from '@/components/ui/GenderChip';
import RoleChip from '@/components/ui/RoleChip';
import { getFriendlyError } from '@/utils/apiMessages';

export default function MemberDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showMove, setShowMove] = useState(false);

  useEffect(() => {
    if (id) {
      fetchMember();
    }
  }, [id]);

  const fetchMember = async () => {
    try {
      setLoading(true);
      const data = await memberService.getById(id!);
      setMember(data);
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load member. Refresh the page or try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      setDeleting(true);
      await memberService.delete(id);
      navigate(ROUTES.MEMBERS.LIST);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't delete member. Try again in a moment."));
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

  if (error || !member) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">{error || 'Member not found'}</p>
        <Button onClick={() => navigate(ROUTES.MEMBERS.LIST)} className="mt-4" variant="secondary">
          Back to Members
        </Button>
      </div>
    );
  }

  // GET /members/:id populates familyId as an object ({ id, houseName }); list rows carry a plain id.
  const rawFamily = member.familyId as unknown as string | { id?: string; houseName?: string };
  const familyId = typeof rawFamily === 'object' && rawFamily ? String(rawFamily.id ?? '') : String(rawFamily || '');
  const familyName = member.familyName || (typeof rawFamily === 'object' && rawFamily ? rawFamily.houseName : '') || 'View family';

  return (
    <div className="space-y-4">
      <PageHeader
        leading={<Avatar name={member.name} src={member.photoUrl} size={56} badge={member.bloodGroup ? <BloodGroupBadge value={member.bloodGroup} size="xs" /> : undefined} />}
        title={member.name}
        description="Member Details"
        actions={
          <>
            {!member.isDead && (
              <Button variant="secondary" onClick={() => setShowMove(true)}>
                <FiRepeat className="h-3.5 w-3.5" />
                Move to another family
              </Button>
            )}
            <Link to={ROUTES.MEMBERS.EDIT(member.id)}>
              <Button variant="secondary">
                <FiEdit2 className="h-3.5 w-3.5" />
                Edit
              </Button>
            </Link>
            <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
              <FiTrash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <h2 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text mb-4">
            Basic Information
          </h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-[#7B8983] dark:text-surface-muted">Name</span>
              <div className="mt-0.5"><PersonCell name={member.name} src={member.photoUrl} size={24} /></div>
            </div>
            <div>
              <span className="text-sm text-[#7B8983] dark:text-surface-muted">Family</span>
              <div className="flex flex-wrap items-center gap-2">
                <PersonCell name={familyName} size={24} to={ROUTES.FAMILIES.DETAIL(familyId)} />
                {member.isFamilyHead && <RoleChip isHead />}
              </div>
            </div>
            {member.mahallId && (
              <div>
                <span className="text-sm text-[#7B8983] dark:text-surface-muted">Mahall ID</span>
                <p className="text-[#18231E] dark:text-surface-text">{member.mahallId}</p>
              </div>
            )}
            {member.age && (
              <div>
                <span className="text-sm text-[#7B8983] dark:text-surface-muted">Age</span>
                <p className="text-[#18231E] dark:text-surface-text">{member.age}</p>
              </div>
            )}
            {member.gender && (
              <div>
                <span className="text-sm text-[#7B8983] dark:text-surface-muted">Gender</span>
                <p className="mt-0.5"><GenderChip value={member.gender} /></p>
              </div>
            )}
            {member.bloodGroup && (
              <div>
                <span className="text-sm text-[#7B8983] dark:text-surface-muted">Blood Group</span>
                <p className="mt-0.5"><BloodGroupBadge value={member.bloodGroup} size="sm" /></p>
              </div>
            )}
            {member.maritalStatus && (
              <div>
                <span className="text-sm text-[#7B8983] dark:text-surface-muted">Marital Status</span>
                <p className="mt-0.5"><StatusBadge status={member.maritalStatus} tone="neutral" dot={false} /></p>
              </div>
            )}
            {typeof member.marriageCount === 'number' && (
              <div>
                <span className="text-sm text-[#7B8983] dark:text-surface-muted">Number of Marriages</span>
                <p className="text-[#18231E] dark:text-surface-text">{member.marriageCount}</p>
              </div>
            )}
            {member.isOrphan && (
              <div>
                <span className="text-sm text-[#7B8983] dark:text-surface-muted">Orphan</span>
                <p className="mt-0.5"><StatusBadge status="orphan" label="Yes" tone="warning" /></p>
              </div>
            )}
            {member.isDead && (
              <div>
                <span className="text-sm text-[#7B8983] dark:text-surface-muted">Deceased</span>
                <p className="mt-0.5"><StatusBadge status="deceased" label="Yes" /></p>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text mb-4">
            Additional Information
          </h2>
          <div className="space-y-3">
            {member.phone && (
              <div>
                <span className="text-sm text-[#7B8983] dark:text-surface-muted">Phone</span>
                <p className="text-[#18231E] dark:text-surface-text">{member.phone}</p>
              </div>
            )}
            {member.healthStatus && (
              <div>
                <span className="text-sm text-[#7B8983] dark:text-surface-muted">Health Status</span>
                <p className="mt-0.5"><StatusBadge status={member.healthStatus} tone="neutral" dot={false} /></p>
              </div>
            )}
            {member.education && (
              <div>
                <span className="text-sm text-[#7B8983] dark:text-surface-muted">Education</span>
                <p className="text-[#18231E] dark:text-surface-text">{member.education}</p>
              </div>
            )}
            <div>
              <span className="text-sm text-[#7B8983] dark:text-surface-muted">Created At</span>
              <p className="text-[#18231E] dark:text-surface-text">{formatDate(member.createdAt)}</p>
            </div>
          </div>
        </Card>
      </div>

      {showMove && (
        <TransferMemberDialog
          open
          member={{ id: member.id, name: member.name, isFamilyHead: member.isFamilyHead }}
          currentFamilyId={familyId}
          onClose={() => setShowMove(false)}
          onDone={(msg) => {
            toast.success(msg || `${member.name} moved to the new family.`);
            setShowMove(false);
            fetchMember();
          }}
        />
      )}

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete member?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={deleting}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-[#5B6963] dark:text-surface-muted">
          Delete <strong>{member.name}</strong>? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

