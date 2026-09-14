import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiEdit2, FiArrowLeft } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { Institute } from '@/types';
import { ROUTES } from '@/constants/routes';
import { instituteService } from '@/services/instituteService';
import { formatDate, toTitleCase } from '@/utils/format';
import { loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

export default function InstituteDetail() {
  const { id } = useParams<{ id: string }>();
  const [institute, setInstitute] = useState<Institute | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <div className="flex gap-2 items-center justify-between">
        <div className="flex items-center gap-4">
          <PageHeader
            description="Institute Details"
            title={institute.name}
            breadcrumbs={[{ label: 'Institutes', path: ROUTES.INSTITUTES.LIST }]}
          />
          <div className="flex gap-2 items-center">
            <Link to={ROUTES.INSTITUTES.LIST}>
              <Button variant="outline" icon={<FiArrowLeft />} collapseLabel>Back</Button>
            </Link>
            <Link to={`/institutes/${institute.id}/edit`}>
              <Button icon={<FiEdit2 />} collapseLabel>Edit</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <h2 className="text-lg font-semibold mb-3 text-foreground">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</label>
              <p className="mt-1 text-gray-900 dark:text-gray-100">{toTitleCase(institute.name)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Place</label>
              <p className="mt-1 text-gray-900 dark:text-gray-100">{toTitleCase(institute.place)}</p>
            </div>
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
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    institute.status === 'active'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                  }`}
                >
                  {institute.status || 'active'}
                </span>
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-3 text-foreground">Contact Information</h2>
          <div className="space-y-4">
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
              <p className="text-sm text-gray-500 dark:text-gray-400">No contact information available</p>
            )}
          </div>
        </Card>

        {institute.description && (
          <Card className="md:col-span-2">
            <h2 className="text-lg font-semibold mb-3 text-foreground">Description</h2>
            <p className="text-gray-700 dark:text-gray-300">{institute.description}</p>
          </Card>
        )}
      </div>
    </div>
  );
}
