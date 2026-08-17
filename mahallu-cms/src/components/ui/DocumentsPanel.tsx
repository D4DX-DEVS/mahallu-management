import { useState, useEffect } from 'react';
import { FiDownload, FiCheckCircle, FiXCircle, FiEye } from 'react-icons/fi';
import Button from './Button';
import LoadingSpinner from './LoadingSpinner';
import Modal from './Modal';
import { toast } from '@/store/toastStore';
import { registrationService, DocumentFile } from '@/services/registrationService';
import { formatDate } from '@/utils/format';

interface DocumentsPanelProps {
  ownerType: 'nikah' | 'death' | 'noc';
  ownerId: string;
  isAdmin?: boolean;
}

export default function DocumentsPanel({ ownerType, ownerId, isAdmin = false }: DocumentsPanelProps) {
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ open: boolean; docId?: string }>({ open: false });
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, [ownerType, ownerId]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await registrationService.getDocuments({
        ownerType,
        ownerId,
        limit: 100,
      });
      setDocuments(result.data);
    } catch (err: any) {
      setError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleView = async (id: string, fileName: string) => {
    try {
      const data = await registrationService.getDocumentUrl(id);
      const link = document.createElement('a');
      link.href = data.url;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      toast.error('Failed to load document');
    }
  };

  const handleDownload = async (id: string, fileName: string) => {
    try {
      const data = await registrationService.getDocumentUrl(id);
      const link = document.createElement('a');
      link.href = data.url;
      link.download = fileName || 'document.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Document downloaded successfully');
    } catch (err: any) {
      toast.error('Failed to download document');
    }
  };

  const handleVerify = async (id: string) => {
    try {
      await registrationService.updateDocumentStatus(id, 'verified');
      toast.success('Document verified successfully');
      await fetchDocuments();
    } catch (err: any) {
      toast.error('Failed to verify document');
    }
  };

  const handleRejectClick = (id: string) => {
    setRejectModal({ open: true, docId: id });
    setRejectionReason('');
  };

  const handleReject = async () => {
    if (!rejectModal.docId || !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      setRejecting(true);
      await registrationService.updateDocumentStatus(
        rejectModal.docId,
        'rejected',
        rejectionReason
      );
      toast.success('Document rejected successfully');
      setRejectModal({ open: false });
      await fetchDocuments();
    } catch (err: any) {
      toast.error('Failed to reject document');
    } finally {
      setRejecting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-8 text-red-600 dark:text-red-400">{error}</div>;
  }

  if (documents.length === 0) {
    return <div className="text-center py-8 text-gray-500 dark:text-gray-400">No documents attached</div>;
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <div
          key={doc._id || doc.id}
          className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                  {doc.fileName}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {doc.documentType}
                  </span>
                  <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getStatusColor(doc.status)}`}>
                    {doc.status?.charAt(0).toUpperCase() + doc.status?.slice(1)}
                  </span>
                </div>
                {doc.status === 'rejected' && doc.rejectionReason && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    Reason: {doc.rejectionReason}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleView(doc._id || doc.id || '', doc.fileName)}
              title="View"
            >
              <FiEye className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDownload(doc._id || doc.id || '', doc.fileName)}
              title="Download"
            >
              <FiDownload className="h-4 w-4" />
            </Button>
            {isAdmin && doc.status === 'pending' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleVerify(doc._id || doc.id || '')}
                  className="text-green-600 dark:text-green-400"
                  title="Verify"
                >
                  <FiCheckCircle className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRejectClick(doc._id || doc.id || '')}
                  className="text-red-600 dark:text-red-400"
                  title="Reject"
                >
                  <FiXCircle className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      ))}

      {/* Reject Modal */}
      <Modal
        isOpen={rejectModal.open}
        onClose={() => setRejectModal({ open: false })}
        title="Reject Document"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Rejection Reason
            </label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
              rows={4}
              placeholder="Explain why this document is being rejected..."
            />
          </div>
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => setRejectModal({ open: false })}
              disabled={rejecting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              isLoading={rejecting}
              className="bg-red-600 hover:bg-red-700"
            >
              Reject Document
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
