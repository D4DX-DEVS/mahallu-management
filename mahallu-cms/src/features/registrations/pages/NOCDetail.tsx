import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiEdit2 } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PageHeader from '@/components/ui/PageHeader';
import Avatar from '@/components/ui/Avatar';
import StatusBadge from '@/components/ui/StatusBadge';
import Badge from '@/components/ui/Badge';
import { ROUTES } from '@/constants/routes';
import { registrationService, NOC } from '@/services/registrationService';
import { formatDate } from '@/utils/format';
import { getFriendlyError } from '@/utils/apiMessages';

export default function NOCDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [noc, setNOC] = useState<NOC | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchNOC();
    }
  }, [id]);

  const fetchNOC = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await registrationService.getNOCById(id!);
      setNOC(data);
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load NOC. Refresh the page or try again."));
      console.error('Error fetching NOC:', err);
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

  if (error || !noc) {
    return (
      <div className="space-y-4">
        <Card>
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error || 'NOC not found'}</p>
            <Button
              onClick={() => navigate(noc?.type === 'nikah' ? ROUTES.REGISTRATIONS.NOC.NIKAH : ROUTES.REGISTRATIONS.NOC.COMMON)}
              className="mt-4"
              variant="outline"
            >
              Back to NOC List
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        leading={<Avatar size={56} name={noc.applicantName} />}
        title={<>NOC - {noc.applicantName}</>}
        description="NOC details"
        actions={
          <>
            <div className="flex gap-2">
              <Link to={`/registrations/noc/${noc.id}/edit`}>
                <Button variant="secondary">
                  <FiEdit2 className="h-3.5 w-3.5" />
                  Edit
                </Button>
              </Link>
              <Link
                to={noc.type === 'nikah' ? ROUTES.REGISTRATIONS.NOC.NIKAH : ROUTES.REGISTRATIONS.NOC.COMMON}
              >
                <Button variant="secondary">
                  <FiArrowLeft className="h-3.5 w-3.5" />
                  Back to List
                </Button>
              </Link>
            </div>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text mb-3.5">
            Applicant Information
          </h2>
          <div className="space-y-3">
            <div>
              <span className="text-xs text-[#7B8983] dark:text-surface-muted">Applicant Name</span>
              <p className="mt-1 flex items-center gap-2 text-[#18231E] dark:text-surface-text font-medium"><Avatar size={24} name={noc.applicantName} />{noc.applicantName}</p>
            </div>
            {noc.applicantPhone && (
              <div>
                <span className="text-xs text-[#7B8983] dark:text-surface-muted">Phone</span>
                <p className="text-[#18231E] dark:text-surface-text">{noc.applicantPhone}</p>
              </div>
            )}
            <div>
              <span className="text-xs text-[#7B8983] dark:text-surface-muted">Type</span>
              <div className="mt-1">
                <Badge variant="info">{noc.type === 'nikah' ? 'Nikah NOC' : 'Common NOC'}</Badge>
              </div>
            </div>
            <div>
              <span className="text-xs text-[#7B8983] dark:text-surface-muted">Status</span>
              <div className="mt-1">
                <StatusBadge status={noc.status || 'pending'} />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text mb-3.5">NOC Details</h2>
          <div className="space-y-3">
            <div>
              <span className="text-xs text-[#7B8983] dark:text-surface-muted">Purpose Title</span>
              <p className="text-[#18231E] dark:text-surface-text">{noc.purposeTitle || noc.purpose}</p>
            </div>
            {(noc.purposeDescription || noc.purpose) && (
              <div>
                <span className="text-xs text-[#7B8983] dark:text-surface-muted">Purpose Description</span>
                <div
                  className="prose prose-sm max-w-none text-[#18231E] dark:text-surface-text"
                  dangerouslySetInnerHTML={{ __html: noc.purposeDescription || noc.purpose || '' }}
                />
              </div>
            )}
            {noc.issuedDate && (
              <div>
                <span className="text-xs text-[#7B8983] dark:text-surface-muted">Issued Date</span>
                <p className="text-[#18231E] dark:text-surface-text">{formatDate(noc.issuedDate)}</p>
              </div>
            )}
            {noc.expiryDate && (
              <div>
                <span className="text-xs text-[#7B8983] dark:text-surface-muted">Expiry Date</span>
                <p className="text-[#18231E] dark:text-surface-text">{formatDate(noc.expiryDate)}</p>
              </div>
            )}
            {noc.nikahRegistrationId && (
              <div>
                <span className="text-xs text-[#7B8983] dark:text-surface-muted">Related Nikah Registration</span>
                <Link
                  to={`/registrations/nikah/${noc.nikahRegistrationId}`}
                  className="text-primary-600 hover:text-primary-700 dark:text-primary-400"
                >
                  View Registration
                </Link>
              </div>
            )}
          </div>
        </Card>
      </div>

      {noc.remarks && (
        <Card>
          <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text mb-3.5">Remarks</h2>
          <p className="text-[#3A4741] dark:text-surface-text">{noc.remarks}</p>
        </Card>
      )}

      <Card>
        <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text mb-3.5">Registration Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="text-xs text-[#7B8983] dark:text-surface-muted">NOC ID</span>
            <p className="text-[#18231E] dark:text-surface-text font-mono text-sm">{noc.id}</p>
          </div>
          <div>
            <span className="text-xs text-[#7B8983] dark:text-surface-muted">Created At</span>
            <p className="text-[#18231E] dark:text-surface-text">{formatDate(noc.createdAt)}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

