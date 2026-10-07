import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FiEdit2, FiArrowLeft, FiTrash2 } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { PageSkeleton } from '@/components/ui/Skeleton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Institute } from '@/types';
import { ROUTES } from '@/constants/routes';
import { instituteService } from '@/services/instituteService';
import { formatDate, toTitleCase } from '@/utils/format';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import { toast } from '@/store/toastStore';
import PageHeader from '@/components/layout/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';

export default function InstituteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchInstitute();
    }
  }, [id]);

  const fetchInstitute = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await instituteService.getById(id);
      setInstitute(data);
    } catch (err: any) {
      setError(loadErrorMessage(err, 'institute'));
      console.error('Error fetching institute:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      setDeleting(true);
      await instituteService.delete(id);
      toast.success('Institute deleted');
      navigate(ROUTES.INSTITUTES.LIST);
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'delete this institute' }));
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  if (error || !institute) {
    return (
      <div className="text-center py-10">
        <p className="text-red-600 dark:text-red-400">{error || 'Institute not found'}</p>
        <Link to={ROUTES.INSTITUTES.LIST} className="mt-4 inline-block">
          <Button variant="outline">Back to Institutes</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        description="Institute Details"
        title={institute.name}
        breadcrumbs={[{ label: 'Institutes', path: ROUTES.INSTITUTES.LIST }]}
        actions={
          <>
            <Link to={ROUTES.INSTITUTES.LIST}>
              <Button variant="outline" icon={<FiArrowLeft />} collapseLabel>Back</Button>
            </Link>
            <Link to={`/institutes/${institute.id}/edit`}>
              <Button icon={<FiEdit2 />} collapseLabel>Edit</Button>
            </Link>
            <Button variant="danger" onClick={() => setShowDeleteModal(true)} icon={<FiTrash2 />} collapseLabel>Delete</Button>
          </>
        }
      />

      {/* One field list rather than two headed halves — identity and contact
          fields are all the same institute record, not distinct categories. */}
      <Card>
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</label>
            <p className="mt-1 text-gray-900 dark:text-gray-100">{toTitleCase(institute.name)}</p>
          </div>
          {institute.nameMl && (
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Name (Malayalam)</label>
              <p className="mt-1 text-gray-900 dark:text-gray-100 font-malayalam">{institute.nameMl}</p>
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Place</label>
            <p className="mt-1 text-gray-900 dark:text-gray-100">{toTitleCase(institute.place)}</p>
          </div>
          {institute.placeMl && (
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Place (Malayalam)</label>
              <p className="mt-1 text-gray-900 dark:text-gray-100 font-malayalam">{institute.placeMl}</p>
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Type</label>
            <p className="mt-1">
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 capitalize">
                {institute.type}
              </span>
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Join Date</label>
            <p className="mt-1 text-gray-900 dark:text-gray-100">{formatDate(institute.joinDate)}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
            <p className="mt-1">
              <StatusBadge status={institute.status || 'active'} />
            </p>
          </div>
          {institute.contactNo && (
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Contact No.</label>
              <p className="mt-1 text-gray-900 dark:text-gray-100">{institute.contactNo}</p>
            </div>
          )}
          {institute.email && (
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</label>
              <p className="mt-1 text-gray-900 dark:text-gray-100">{institute.email}</p>
            </div>
          )}
          {!institute.contactNo && !institute.email && (
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Contact</label>
              <p className="mt-1 text-gray-500 dark:text-gray-400">No contact information available</p>
            </div>
          )}
        </div>
      </Card>

      {institute.description && (
        <Card>
          <h2 className="text-lg font-semibold mb-3 text-foreground">Description</h2>
          <p className="text-gray-700 dark:text-gray-300">{institute.description}</p>
        </Card>
      )}

      <ConfirmDialog
        isOpen={showDeleteModal}
        title="Delete institute"
        message={`Are you sure you want to delete ${toTitleCase(institute.name) || 'this institute'}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
}
