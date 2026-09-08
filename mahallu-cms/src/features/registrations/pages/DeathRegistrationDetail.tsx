import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiFilePlus } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { PageSkeleton } from '@/components/ui/Skeleton';
import DocumentsPanel from '@/components/ui/DocumentsPanel';
import { ROUTES } from '@/constants/routes';
import { registrationService, DeathRegistration } from '@/services/registrationService';
import { formatDate } from '@/utils/format';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import StatusBadge from '@/components/ui/StatusBadge';
import PageHeader from '@/components/layout/PageHeader';

export default function DeathRegistrationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [registration, setRegistration] = useState<DeathRegistration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issuingCert, setIssuingCert] = useState(false);
  const [showCertModal, setShowCertModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusRemark, setStatusRemark] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

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
      setError(loadErrorMessage(err, 'death registration'));
    } finally {
      setLoading(false);
    }
  };

  const handleIssueCertificate = async () => {
    if (!registration?.id) return;
    try {
      setIssuingCert(true);
      const cert = await registrationService.issueCertificate('death', registration.id);
      toast.success(`Certificate ${cert.certificateNo} issued`);
      setShowCertModal(false);
      await fetchRegistration();
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'issue certificate' }));
    } finally {
      setIssuingCert(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!registration?.id) return;
    if ((newStatus === 'correction_required' || newStatus === 'rejected') && !statusRemark.trim()) {
      toast.error('Please enter remarks for this action.');
      return;
    }

    try {
      setUpdatingStatus(true);
      await registrationService.updateDeath(registration.id, {
        status: newStatus as any,
        remarks: statusRemark || undefined,
      });
      toast.success('Status updated');
      setShowStatusModal(false);
      setStatusRemark('');
      await fetchRegistration();
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'update status' }));
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  if (error || !registration) {
    return (
      <div className="space-y-6">
        <PageHeader description="Death registration details" title="Death Registrations" />
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
    <div className="space-y-6">
      <PageHeader
        title={registration.deceasedName}
        breadcrumbs={[{ label: 'Death Registrations', path: ROUTES.REGISTRATIONS.DEATH }]}
      />

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {registration.status === 'approved' && (
            <Button onClick={() => setShowCertModal(true)} className="bg-green-600 hover:bg-green-700">
              <FiFilePlus className="h-4 w-4 mr-2" />
              Issue Certificate
            </Button>
          )}
          <Link to={ROUTES.REGISTRATIONS.DEATH}>
            <Button variant="outline">
              <FiArrowLeft className="h-4 w-4 mr-2" />
              Back to List
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Deceased Information
          </h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Deceased Name</span>
              <p className="text-gray-900 dark:text-gray-100 font-medium">{registration.deceasedName}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Death Date</span>
              <p className="text-gray-900 dark:text-gray-100">{formatDate(registration.deathDate)}</p>
            </div>
            {registration.placeOfDeath && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Place of Death</span>
                <p className="text-gray-900 dark:text-gray-100">{registration.placeOfDeath}</p>
              </div>
            )}
            {registration.causeOfDeath && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Cause of Death</span>
                <p className="text-gray-900 dark:text-gray-100">{registration.causeOfDeath}</p>
              </div>
            )}
            {registration.mahallId && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Mahall ID</span>
                <p className="text-gray-900 dark:text-gray-100">{registration.mahallId}</p>
              </div>
            )}
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Status</span>
              <div className="mt-1">
                <StatusBadge status={registration.status} />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Informant Information
          </h2>
          <div className="space-y-3">
            {registration.informantName ? (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Informant Name</span>
                <p className="text-gray-900 dark:text-gray-100">{registration.informantName}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">No informant information provided</p>
            )}
            {registration.informantRelation && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Relation to Deceased</span>
                <p className="text-gray-900 dark:text-gray-100">{registration.informantRelation}</p>
              </div>
            )}
            {registration.informantPhone && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Phone</span>
                <p className="text-gray-900 dark:text-gray-100">{registration.informantPhone}</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {registration.remarks && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Remarks</h2>
          <p className="text-gray-700 dark:text-gray-300">{registration.remarks}</p>
        </Card>
      )}

      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Registration Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Registration ID</span>
            <p className="text-gray-900 dark:text-gray-100 font-mono text-sm">{registration.id}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Created At</span>
            <p className="text-gray-900 dark:text-gray-100">{formatDate(registration.createdAt)}</p>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Attached Documents</h2>
        <DocumentsPanel ownerType="death" ownerId={registration.id} isAdmin={true} />
      </Card>

      {registration.status === 'pending' && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Review Status</h2>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => handleUpdateStatus('approved')}
              className="bg-green-600 hover:bg-green-700"
            >
              Approve
            </Button>
            <Button
              onClick={() => {
                setStatusRemark('');
                setShowStatusModal(true);
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Request Correction
            </Button>
            <Button
              onClick={() => {
                setStatusRemark('');
                setShowStatusModal(true);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Reject
            </Button>
          </div>
        </Card>
      )}

      {/* Certificate Modal */}
      <Modal isOpen={showCertModal} onClose={() => setShowCertModal(false)} title="Issue Certificate">
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Are you sure you want to issue a Death certificate for this registration?
          </p>
          <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-3">
            <Button variant="outline" onClick={() => setShowCertModal(false)} disabled={issuingCert}>
              Cancel
            </Button>
            <Button
              onClick={handleIssueCertificate}
              isLoading={issuingCert}
              className="bg-green-600 hover:bg-green-700"
            >
              Issue Certificate
            </Button>
          </div>
        </div>
      </Modal>

      {/* Status Modal */}
      <Modal isOpen={showStatusModal} onClose={() => setShowStatusModal(false)} title="Update Status">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Remarks</label>
            <textarea
              aria-label="Remarks"
              value={statusRemark}
              onChange={(e) => setStatusRemark(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
              rows={4}
              placeholder="Enter remarks..."
            />
          </div>
          <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-3">
            <Button variant="outline" onClick={() => setShowStatusModal(false)} disabled={updatingStatus}>
              Cancel
            </Button>
            <Button
              onClick={() => handleUpdateStatus('correction_required')}
              isLoading={updatingStatus}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Request Correction
            </Button>
            <Button
              onClick={() => handleUpdateStatus('rejected')}
              isLoading={updatingStatus}
              className="bg-red-600 hover:bg-red-700"
            >
              Reject
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
