import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PageHeader from '@/components/ui/PageHeader';
import Avatar, { PersonCell } from '@/components/ui/Avatar';
import StatusBadge from '@/components/ui/StatusBadge';
import { ROUTES } from '@/constants/routes';
import { registrationService, DeathRegistration } from '@/services/registrationService';
import { formatDate } from '@/utils/format';
import { getFriendlyError } from '@/utils/apiMessages';

export default function DeathRegistrationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [registration, setRegistration] = useState<DeathRegistration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchRegistration();
    }
  }, [id]);

  const fetchRegistration = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await registrationService.getDeathById(id!);
      setRegistration(data);
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load death registration. Refresh the page or try again."));
      console.error('Error fetching registration:', err);
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

  if (error || !registration) {
    return (
      <div className="space-y-4">
        <Card>
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error || 'Death registration not found'}</p>
            <Button onClick={() => navigate(ROUTES.REGISTRATIONS.DEATH)} className="mt-4" variant="outline">
              Back to Death Registrations
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        leading={<Avatar size={56} name={registration.deceasedName} />}
        title={<>Death Registration - {registration.deceasedName}</>}
        description="Death registration details"
        actions={
          <>
            <Link to={ROUTES.REGISTRATIONS.DEATH}>
              <Button variant="secondary">
                <FiArrowLeft className="h-3.5 w-3.5" />
                Back to List
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text mb-3.5">
            Deceased Information
          </h2>
          <div className="space-y-3">
            <div>
              <span className="text-xs text-[#7B8983] dark:text-surface-muted">Deceased Name</span>
              <p className="mt-1 flex items-center gap-2 text-[#18231E] dark:text-surface-text font-medium"><Avatar size={24} name={registration.deceasedName} />{registration.deceasedName}</p>
            </div>
            <div>
              <span className="text-xs text-[#7B8983] dark:text-surface-muted">Death Date</span>
              <p className="text-[#18231E] dark:text-surface-text">{formatDate(registration.deathDate)}</p>
            </div>
            {registration.placeOfDeath && (
              <div>
                <span className="text-xs text-[#7B8983] dark:text-surface-muted">Place of Death</span>
                <p className="text-[#18231E] dark:text-surface-text">{registration.placeOfDeath}</p>
              </div>
            )}
            {registration.causeOfDeath && (
              <div>
                <span className="text-xs text-[#7B8983] dark:text-surface-muted">Cause of Death</span>
                <p className="text-[#18231E] dark:text-surface-text">{registration.causeOfDeath}</p>
              </div>
            )}
            {registration.mahallId && (
              <div>
                <span className="text-xs text-[#7B8983] dark:text-surface-muted">Mahall ID</span>
                <p className="text-[#18231E] dark:text-surface-text">{registration.mahallId}</p>
              </div>
            )}
            <div>
              <span className="text-xs text-[#7B8983] dark:text-surface-muted">Status</span>
              <div className="mt-1">
                <StatusBadge status={registration.status || 'pending'} />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text mb-3.5">
            Informant Information
          </h2>
          <div className="space-y-3">
            {registration.informantName ? (
              <div>
                <span className="text-xs text-[#7B8983] dark:text-surface-muted">Informant Name</span>
                <div className="mt-0.5"><PersonCell name={registration.informantName} size={24} /></div>
              </div>
            ) : (
              <p className="text-xs text-[#98A59F] italic">No informant information provided</p>
            )}
            {registration.informantRelation && (
              <div>
                <span className="text-xs text-[#7B8983] dark:text-surface-muted">Relation to Deceased</span>
                <p className="mt-0.5"><StatusBadge status={registration.informantRelation} tone="neutral" dot={false} /></p>
              </div>
            )}
            {registration.informantPhone && (
              <div>
                <span className="text-xs text-[#7B8983] dark:text-surface-muted">Phone</span>
                <p className="text-[#18231E] dark:text-surface-text">{registration.informantPhone}</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {registration.remarks && (
        <Card>
          <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text mb-3.5">Remarks</h2>
          <p className="text-[#3A4741] dark:text-surface-text">{registration.remarks}</p>
        </Card>
      )}

      <Card>
        <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text mb-3.5">Registration Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="text-xs text-[#7B8983] dark:text-surface-muted">Registration ID</span>
            <p className="text-[#18231E] dark:text-surface-text font-mono text-sm">{registration.id}</p>
          </div>
          <div>
            <span className="text-xs text-[#7B8983] dark:text-surface-muted">Created At</span>
            <p className="text-[#18231E] dark:text-surface-text">{formatDate(registration.createdAt)}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

