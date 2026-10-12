import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PageHeader from '@/components/ui/PageHeader';
import Avatar, { AvatarStack } from '@/components/ui/Avatar';
import StatusBadge from '@/components/ui/StatusBadge';
import { ROUTES } from '@/constants/routes';
import { registrationService, NikahRegistration } from '@/services/registrationService';
import { formatDate } from '@/utils/format';
import { PersonCell } from '@/components/ui/Avatar';
import { getFriendlyError } from '@/utils/apiMessages';

export default function NikahRegistrationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [registration, setRegistration] = useState<NikahRegistration | null>(null);
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
      const data = await registrationService.getNikahById(id!);
      setRegistration(data);
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load nikah registration. Refresh the page or try again."));
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
            <p className="text-red-600 dark:text-red-400">{error || 'Nikah registration not found'}</p>
            <Button onClick={() => navigate(ROUTES.REGISTRATIONS.NIKAH)} className="mt-4" variant="outline">
              Back to Nikah Registrations
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        leading={<AvatarStack items={[{ name: registration.groomName }, { name: registration.brideName }]} />}
        title={<>Nikah Registration - {registration.groomName} & {registration.brideName}</>}
        description="Nikah registration details"
        actions={
          <>
            <Link to={ROUTES.REGISTRATIONS.NIKAH}>
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
          <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text mb-3.5">Groom Information</h2>
          <div className="space-y-3">
            <div>
              <span className="text-xs text-[#7B8983] dark:text-surface-muted">Groom Name</span>
              <p className="mt-1 flex items-center gap-2 text-[#18231E] dark:text-surface-text font-medium"><Avatar size={24} name={registration.groomName} />{registration.groomName}</p>
            </div>
            {registration.groomAge && (
              <div>
                <span className="text-xs text-[#7B8983] dark:text-surface-muted">Age</span>
                <p className="text-[#18231E] dark:text-surface-text">{registration.groomAge}</p>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text mb-3.5">Bride Information</h2>
          <div className="space-y-3">
            <div>
              <span className="text-xs text-[#7B8983] dark:text-surface-muted">Bride Name</span>
              <p className="mt-1 flex items-center gap-2 text-[#18231E] dark:text-surface-text font-medium"><Avatar size={24} name={registration.brideName} />{registration.brideName}</p>
            </div>
            {registration.brideAge && (
              <div>
                <span className="text-xs text-[#7B8983] dark:text-surface-muted">Age</span>
                <p className="text-[#18231E] dark:text-surface-text">{registration.brideAge}</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text mb-3.5">Nikah Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="text-xs text-[#7B8983] dark:text-surface-muted">Nikah Date</span>
            <p className="text-[#18231E] dark:text-surface-text">{formatDate(registration.nikahDate)}</p>
          </div>
          {registration.mahallId && (
            <div>
              <span className="text-xs text-[#7B8983] dark:text-surface-muted">Mahall ID</span>
              <p className="text-[#18231E] dark:text-surface-text">{registration.mahallId}</p>
            </div>
          )}
          {registration.waliName && (
            <div>
              <span className="text-xs text-[#7B8983] dark:text-surface-muted">Wali Name</span>
              <div className="mt-0.5"><PersonCell name={registration.waliName} size={24} /></div>
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

      {(registration.witness1 || registration.witness2) && (
        <Card>
          <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text mb-3.5">Witnesses</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {registration.witness1 && (
              <div>
                <span className="text-xs text-[#7B8983] dark:text-surface-muted">Witness 1</span>
                <p className="text-[#18231E] dark:text-surface-text">{registration.witness1}</p>
              </div>
            )}
            {registration.witness2 && (
              <div>
                <span className="text-xs text-[#7B8983] dark:text-surface-muted">Witness 2</span>
                <p className="text-[#18231E] dark:text-surface-text">{registration.witness2}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {(registration.mahrAmount || registration.mahrDescription) && (
        <Card>
          <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text mb-3.5">Mahr Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {registration.mahrAmount && (
              <div>
                <span className="text-xs text-[#7B8983] dark:text-surface-muted">Mahr Amount</span>
                <p className="text-[#18231E] dark:text-surface-text">₹{registration.mahrAmount.toLocaleString()}</p>
              </div>
            )}
            {registration.mahrDescription && (
              <div>
                <span className="text-xs text-[#7B8983] dark:text-surface-muted">Mahr Description</span>
                <p className="text-[#18231E] dark:text-surface-text">{registration.mahrDescription}</p>
              </div>
            )}
          </div>
        </Card>
      )}

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

