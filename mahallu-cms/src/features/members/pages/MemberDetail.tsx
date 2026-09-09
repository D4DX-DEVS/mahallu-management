import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Modal from '@/components/ui/Modal';
import { ROUTES } from '@/constants/routes';
import { memberService } from '@/services/memberService';
import { Member } from '@/types';
import { formatDate } from '@/utils/format';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

export default function MemberDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
      setError(loadErrorMessage(err, 'member'));
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
      setError(errorMessage(err, { action: 'delete member' }));
      setDeleting(false);
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  if (error || !member) {
    return (
      <div className="text-center py-10">
        <p className="text-red-600 dark:text-red-400">{error || 'Member not found'}</p>
        <Button onClick={() => navigate(ROUTES.MEMBERS.LIST)} className="mt-4" variant="outline">
          Back to Members
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center justify-between">
        <div className="flex items-center gap-4">
          <PageHeader
            description="Member Details"
            title={member.name}
            breadcrumbs={[{ label: 'Members', path: ROUTES.MEMBERS.LIST }]}
          />
          <div className="flex gap-2 items-center">
            <Link to={ROUTES.MEMBERS.EDIT(member.id)}>
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
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Name</span>
              <p className="text-gray-900 dark:text-gray-100 capitalize">{member.name}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Family</span>
              <Link
                to={ROUTES.FAMILIES.DETAIL(member.familyId)}
                className="text-primary-600 hover:text-primary-700 dark:text-primary-400 capitalize"
              >
                {member.familyName}
              </Link>
            </div>
            {member.mahallId && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Mahall ID</span>
                <p className="text-gray-900 dark:text-gray-100">{member.mahallId}</p>
              </div>
            )}
            {member.age && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Age</span>
                <p className="text-gray-900 dark:text-gray-100">{member.age}</p>
              </div>
            )}
            {member.gender && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Gender</span>
                <p className="text-gray-900 dark:text-gray-100 capitalize">{member.gender}</p>
              </div>
            )}
            {member.bloodGroup && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Blood Group</span>
                <p className="text-gray-900 dark:text-gray-100">{member.bloodGroup}</p>
              </div>
            )}
            {member.maritalStatus && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Marital Status</span>
                <p className="text-gray-900 dark:text-gray-100 capitalize">{member.maritalStatus}</p>
              </div>
            )}
            {typeof member.marriageCount === 'number' && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Number of Marriages</span>
                <p className="text-gray-900 dark:text-gray-100">{member.marriageCount}</p>
              </div>
            )}
            {member.isOrphan && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Orphan</span>
                <p className="text-gray-900 dark:text-gray-100">Yes</p>
              </div>
            )}
            {member.isDead && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Deceased</span>
                <p className="text-gray-900 dark:text-gray-100">Yes</p>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-3 text-foreground">
            Additional Information
          </h2>
          <div className="space-y-3">
            {member.phone && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Phone</span>
                <p className="text-gray-900 dark:text-gray-100">{member.phone}</p>
              </div>
            )}
            {member.healthStatus && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Health Status</span>
                <p className="text-gray-900 dark:text-gray-100">{member.healthStatus}</p>
              </div>
            )}
            {member.education && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Education</span>
                <p className="text-gray-900 dark:text-gray-100">{member.education}</p>
              </div>
            )}
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Created At</span>
              <p className="text-gray-900 dark:text-gray-100">{formatDate(member.createdAt)}</p>
            </div>
          </div>
        </Card>
      </div>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Member"
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
          Are you sure you want to delete <strong className="capitalize">{member.name}</strong>? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
