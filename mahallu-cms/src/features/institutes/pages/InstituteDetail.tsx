import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiEdit2, FiArrowLeft } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import Badge from '@/components/ui/Badge';
import Avatar, { PersonCell } from '@/components/ui/Avatar';
import StatusBadge from '@/components/ui/StatusBadge';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Institute } from '@/types';
import { ROUTES } from '@/constants/routes';
import { instituteService } from '@/services/instituteService';
import { formatDate } from '@/utils/format';
import { getFriendlyError } from '@/utils/apiMessages';

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
      setError(getFriendlyError(err, "Couldn't load institute. Refresh the page or try again."));
      console.error('Error fetching institute:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !institute) {
    return (
      <div className="text-center py-12">
        <p className="text-[#B3261E] dark:text-red-300">{error || 'Institute not found'}</p>
        <Link to={ROUTES.INSTITUTES.LIST} className="mt-4 inline-block">
          <Button variant="secondary">Back to Institutes</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        leading={<Avatar size={56} name={institute.name} />}
        title={institute.name}
        description="Institute Details"
        actions={
          <>
            <Link to={ROUTES.INSTITUTES.LIST}>
              <Button variant="secondary">
                <FiArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            </Link>
            <Link to={`/institutes/${institute.id}/edit`}>
              <Button>
                <FiEdit2 className="h-3.5 w-3.5" />
                Edit
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card padding="lg">
          <h2 className="mb-3.5 text-sm font-bold text-primary-700 dark:text-surface-text">Basic Information</h2>
          <div className="space-y-3">
            <div>
              <label className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">Name</label>
              <div className="mt-0.5"><PersonCell name={institute.name} size={24} /></div>
            </div>
            <div>
              <label className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">Place</label>
              <p className="mt-0.5 text-[13px] text-[#18231E] dark:text-surface-text">{institute.place}</p>
            </div>
            <div>
              <label className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">Type</label>
              <p className="mt-1">
                <Badge variant="info" className="capitalize">{institute.type}</Badge>
              </p>
            </div>
            <div>
              <label className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">Join Date</label>
              <p className="mt-0.5 text-[13px] text-[#18231E] dark:text-surface-text">{formatDate(institute.joinDate)}</p>
            </div>
            <div>
              <label className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">Status</label>
              <p className="mt-1">
                <StatusBadge status={institute.status || 'active'} />
              </p>
            </div>
          </div>
        </Card>

        <Card padding="lg">
          <h2 className="mb-3.5 text-sm font-bold text-primary-700 dark:text-surface-text">Contact Information</h2>
          <div className="space-y-3">
            {institute.contactNo && (
              <div>
                <label className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">Contact No.</label>
                <p className="mt-0.5 text-[13px] text-[#18231E] dark:text-surface-text">{institute.contactNo}</p>
              </div>
            )}
            {institute.email && (
              <div>
                <label className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">Email</label>
                <p className="mt-0.5 text-[13px] text-[#18231E] dark:text-surface-text">{institute.email}</p>
              </div>
            )}
            {!institute.contactNo && !institute.email && (
              <p className="text-[13px] text-[#7B8983] dark:text-surface-muted">No contact information available</p>
            )}
          </div>
        </Card>

        {institute.description && (
          <Card padding="lg" className="md:col-span-2">
            <h2 className="mb-3.5 text-sm font-bold text-primary-700 dark:text-surface-text">Description</h2>
            <p className="text-[13px] text-[#3A4741] dark:text-surface-text">{institute.description}</p>
          </Card>
        )}
      </div>
    </div>
  );
}

