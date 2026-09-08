import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiEdit2, FiFilePlus } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { PageSkeleton } from '@/components/ui/Skeleton';
import DocumentsPanel from '@/components/ui/DocumentsPanel';
import { ROUTES } from '@/constants/routes';
import { registrationService, NOC } from '@/services/registrationService';
import { formatDate } from '@/utils/format';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import StatusBadge from '@/components/ui/StatusBadge';
import PageHeader from '@/components/layout/PageHeader';

export default function NOCDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [noc, setNOC] = useState<NOC | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issuingCert, setIssuingCert] = useState(false);
  const [showCertModal, setShowCertModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusRemark, setStatusRemark] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

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
      setError(loadErrorMessage(err, 'noc'));
    } finally {
      setLoading(false);
    }
  };

  const handleIssueCertificate = async () => {
    if (!noc?.id) return;
    try {
      setIssuingCert(true);
      const cert = await registrationService.issueCertificate('noc', noc.id);
      toast.success(`Certificate ${cert.certificateNo} issued`);
      setShowCertModal(false);
      await fetchNOC();
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'issue certificate' }));
    } finally {
      setIssuingCert(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!noc?.id) return;
    if ((newStatus === 'correction_required' || newStatus === 'rejected') && !statusRemark.trim()) {
      toast.error('Please enter remarks for this action.');
      return;
    }

    try {
      setUpdatingStatus(true);
      await registrationService.updateNOC(noc.id, {
        status: newStatus as any,
        remarks: statusRemark || undefined,
      });
      toast.success('Status updated');
      setShowStatusModal(false);
      setStatusRemark('');
      await fetchNOC();
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'update status' }));
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  if (error || !noc) {
    return (
      <div className="space-y-6">
        <PageHeader description="NOC details" title="NOC" />
        <Card>
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error || 'NOC not found'}</p>
            <Button
              onClick={() =>
                navigate(
                  noc?.type === 'nikah' ? ROUTES.REGISTRATIONS.NOC.NIKAH : ROUTES.REGISTRATIONS.NOC.COMMON
                )
              }
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

  const typeColors: Record<string, string> = {
    common: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    nikah: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={noc.applicantName}
        breadcrumbs={[
          {
            label: 'NOC',
            path: noc.type === 'nikah' ? ROUTES.REGISTRATIONS.NOC.NIKAH : ROUTES.REGISTRATIONS.NOC.COMMON,
          },
        ]}
      />

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {noc.status === 'approved' && (
            <Button onClick={() => setShowCertModal(true)} className="bg-green-600 hover:bg-green-700">
              <FiFilePlus className="h-4 w-4 mr-2" />
              Issue Certificate
            </Button>
          )}
          <Link to={`/registrations/noc/${noc.id}/edit`}>
            <Button variant="outline">
              <FiEdit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </Link>
          <Link to={noc.type === 'nikah' ? ROUTES.REGISTRATIONS.NOC.NIKAH : ROUTES.REGISTRATIONS.NOC.COMMON}>
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
            Applicant Information
          </h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Applicant Name</span>
              <p className="text-gray-900 dark:text-gray-100 font-medium">{noc.applicantName}</p>
            </div>
            {noc.applicantPhone && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Phone</span>
                <p className="text-gray-900 dark:text-gray-100">{noc.applicantPhone}</p>
              </div>
            )}
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Type</span>
              <div className="mt-1">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    typeColors[noc.type || 'common']
                  }`}
                >
                  {noc.type === 'nikah' ? 'Nikah NOC' : 'Common NOC'}
                </span>
              </div>
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Status</span>
              <div className="mt-1">
                <StatusBadge status={noc.status} />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">NOC Details</h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Purpose Title</span>
              <p className="text-gray-900 dark:text-gray-100">{noc.purposeTitle || noc.purpose}</p>
            </div>
            {(noc.purposeDescription || noc.purpose) && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Purpose Description</span>
                <div
                  className="prose prose-sm max-w-none text-gray-900 dark:text-gray-100"
                  dangerouslySetInnerHTML={{ __html: noc.purposeDescription || noc.purpose || '' }}
                />
              </div>
            )}
            {noc.issuedDate && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Issued Date</span>
                <p className="text-gray-900 dark:text-gray-100">{formatDate(noc.issuedDate)}</p>
              </div>
            )}
            {noc.expiryDate && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Expiry Date</span>
                <p className="text-gray-900 dark:text-gray-100">{formatDate(noc.expiryDate)}</p>
              </div>
            )}
            {noc.nikahRegistrationId && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Related Nikah Registration</span>
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Remarks</h2>
          <p className="text-gray-700 dark:text-gray-300">{noc.remarks}</p>
        </Card>
      )}

      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Registration Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">NOC ID</span>
            <p className="text-gray-900 dark:text-gray-100 font-mono text-sm">{noc.id}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Created At</span>
            <p className="text-gray-900 dark:text-gray-100">{formatDate(noc.createdAt)}</p>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Attached Documents</h2>
        <DocumentsPanel ownerType="noc" ownerId={noc.id} isAdmin={true} />
      </Card>

      {noc.status === 'pending' && (
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
            Are you sure you want to issue a NOC certificate for this request?
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
