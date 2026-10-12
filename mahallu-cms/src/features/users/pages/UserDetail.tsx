import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import { ROUTES } from '@/constants/routes';
import { userService } from '@/services/userService';
import { User } from '@/types';
import { formatDate, formatDateTime } from '@/utils/format';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import Avatar, { PersonCell } from '@/components/ui/Avatar';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

export default function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchUser();
    }
  }, [id]);

  const fetchUser = async () => {
    try {
      setLoading(true);
      const data = await userService.getById(id!);
      setUser(data);
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load user. Refresh the page or try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      setDeleting(true);
      await userService.delete(id);
      navigate(ROUTES.USERS.MAHALL);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't delete user. Try again in a moment."));
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

  if (error || !user) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">{error || 'User not found'}</p>
        <Button onClick={() => navigate(ROUTES.USERS.MAHALL)} className="mt-4" variant="secondary">
          Back to Users
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={user.name}
        leading={<Avatar size={56} name={user.name} src={user.photoUrl} />}
        description="User Details"
        actions={
          <>
            <Link to={ROUTES.USERS.EDIT_MAHALL(user.id)}>
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
              <div className="mt-0.5"><PersonCell name={user.name} size={24} /></div>
            </div>
            <div>
              <span className="text-sm text-[#7B8983] dark:text-surface-muted">Phone</span>
              <p className="text-[#18231E] dark:text-surface-text">{user.phone}</p>
            </div>
            {user.email && (
              <div>
                <span className="text-sm text-[#7B8983] dark:text-surface-muted">Email</span>
                <p className="text-[#18231E] dark:text-surface-text">{user.email}</p>
              </div>
            )}
            <div>
              <span className="text-sm text-[#7B8983] dark:text-surface-muted">Role</span>
              <div className="mt-0.5"><StatusBadge status={user.role} tone="info" dot={false} /></div>
            </div>
            <div>
              <span className="text-sm text-[#7B8983] dark:text-surface-muted">Status</span>
              <div className="mt-0.5"><StatusBadge status={user.status} /></div>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text mb-4">
            Additional Information
          </h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-[#7B8983] dark:text-surface-muted">Joining Date</span>
              <p className="text-[#18231E] dark:text-surface-text">{formatDate(user.joiningDate)}</p>
            </div>
            {user.lastLogin && (
              <div>
                <span className="text-sm text-[#7B8983] dark:text-surface-muted">Last Login</span>
                <p className="text-[#18231E] dark:text-surface-text">{formatDateTime(user.lastLogin)}</p>
              </div>
            )}
            {user.tenant && (
              <div>
                <span className="text-sm text-[#7B8983] dark:text-surface-muted">Tenant</span>
                <div className="mt-0.5"><PersonCell name={user.tenant.name} size={24} /></div>
              </div>
            )}
          </div>
        </Card>

        {user.permissions && (
          <Card className="md:col-span-2">
            <h2 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text mb-4">
              Permissions
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-sm text-[#7B8983] dark:text-surface-muted">View</span>
                <p className="text-[#18231E] dark:text-surface-text">
                  {user.permissions.view ? 'Yes' : 'No'}
                </p>
              </div>
              <div>
                <span className="text-sm text-[#7B8983] dark:text-surface-muted">Add</span>
                <p className="text-[#18231E] dark:text-surface-text">
                  {user.permissions.add ? 'Yes' : 'No'}
                </p>
              </div>
              <div>
                <span className="text-sm text-[#7B8983] dark:text-surface-muted">Edit</span>
                <p className="text-[#18231E] dark:text-surface-text">
                  {user.permissions.edit ? 'Yes' : 'No'}
                </p>
              </div>
              <div>
                <span className="text-sm text-[#7B8983] dark:text-surface-muted">Delete</span>
                <p className="text-[#18231E] dark:text-surface-text">
                  {user.permissions.delete ? 'Yes' : 'No'}
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete user?"
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
          Delete <strong>{user.name}</strong>? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

