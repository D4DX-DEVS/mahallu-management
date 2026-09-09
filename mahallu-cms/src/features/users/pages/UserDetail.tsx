import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Modal from '@/components/ui/Modal';
import { ROUTES } from '@/constants/routes';
import { userService } from '@/services/userService';
import { User } from '@/types';
import { formatDate, formatDateTime } from '@/utils/format';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

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
      setError(loadErrorMessage(err, 'user'));
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
      setError(errorMessage(err, { action: 'delete user' }));
      setDeleting(false);
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  if (error || !user) {
    return (
      <div className="text-center py-10">
        <p className="text-red-600 dark:text-red-400">{error || 'User not found'}</p>
        <Button onClick={() => navigate(ROUTES.USERS.MAHALL)} className="mt-4" variant="outline">
          Back to Users
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center justify-between">
        <div className="flex items-center gap-4">
          <PageHeader
            description="User Details"
            title={user.name}
            breadcrumbs={[{ label: 'Mahall Users', path: ROUTES.USERS.MAHALL }]}
          />
          <div className="flex gap-2 items-center">
            <Link to={ROUTES.USERS.EDIT_MAHALL(user.id)}>
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
              <p className="text-gray-900 dark:text-gray-100 capitalize">{user.name}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Phone</span>
              <p className="text-gray-900 dark:text-gray-100">{user.phone}</p>
            </div>
            {user.email && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Email</span>
                <p className="text-gray-900 dark:text-gray-100">{user.email}</p>
              </div>
            )}
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Role</span>
              <p className="text-gray-900 dark:text-gray-100 capitalize">{user.role}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Status</span>
              <span
                className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                  user.status === 'active'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                }`}
              >
                {user.status}
              </span>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-3 text-foreground">
            Additional Information
          </h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Joining Date</span>
              <p className="text-gray-900 dark:text-gray-100">{formatDate(user.joiningDate)}</p>
            </div>
            {user.lastLogin && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Last Login</span>
                <p className="text-gray-900 dark:text-gray-100">{formatDateTime(user.lastLogin)}</p>
              </div>
            )}
            {user.tenant && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Tenant</span>
                <p className="text-gray-900 dark:text-gray-100 capitalize">{user.tenant.name}</p>
              </div>
            )}
          </div>
        </Card>

        {user.permissions && (
          <Card className="md:col-span-2">
            <h2 className="text-lg font-semibold mb-3 text-foreground">Permissions</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">View</span>
                <p className="text-gray-900 dark:text-gray-100">{user.permissions.view ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Add</span>
                <p className="text-gray-900 dark:text-gray-100">{user.permissions.add ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Edit</span>
                <p className="text-gray-900 dark:text-gray-100">{user.permissions.edit ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Delete</span>
                <p className="text-gray-900 dark:text-gray-100">{user.permissions.delete ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </Card>
        )}
      </div>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete User"
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
          Are you sure you want to delete <strong className="capitalize">{user.name}</strong>? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
