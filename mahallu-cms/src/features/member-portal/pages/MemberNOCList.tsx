import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { memberPortalService } from '@/services/memberPortalService';
import { downloadNocPdf } from '@/utils/nocPdf';
import { ROUTES } from '@/constants/routes';
import Card from '@/components/ui/Card';
import { PageSkeleton } from '@/components/ui/Skeleton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import RequestDetailModal, { RequestType } from '../components/RequestDetailModal';
import { FiHeart, FiFileText, FiEdit2, FiEye, FiTrash2 } from 'react-icons/fi';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export default function MemberNOCList() {
  const [nocs, setNocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [modalState, setModalState] = useState<{ type: RequestType; request: any; mode: 'view' | 'edit' } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // A nikah-type NOC's real detail lives on its linked NikahRegistration record
  // (bride/groom, wali, witnesses, mahr…) — the NOC record itself only holds purpose/phone.
  const openModal = (noc: any, mode: 'view' | 'edit') => {
    if (noc.type === 'nikah' && noc.nikahRegistrationId && typeof noc.nikahRegistrationId === 'object') {
      setModalState({ type: 'nikah', request: noc.nikahRegistrationId, mode });
    } else {
      setModalState({ type: 'noc', request: noc, mode });
    }
  };

  const isEditable = (noc: any) => {
    const status = noc.type === 'nikah' && noc.nikahRegistrationId && typeof noc.nikahRegistrationId === 'object'
      ? noc.nikahRegistrationId.status
      : noc.status;
    return status === 'pending' || status === 'correction_required';
  };

  const isDeletable = (noc: any) => noc.status !== 'approved';

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      setDeleteError(null);
      await memberPortalService.deleteRegistration('noc', deleteTarget.id);
      setDeleteTarget(null);
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      setDeleteError(err.response?.data?.message || 'Failed to delete NOC request');
    } finally {
      setDeleting(false);
    }
  };

  const load = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const result = await memberPortalService.getOwnRegistrations('noc');
      setNocs(result.noc || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load NOC records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [refreshKey]);

  // Silently refresh when the tab regains focus so newly created NOCs appear
  useEffect(() => {
    const onFocus = () => load(true);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const handleDownload = async (noc: any) => {
    setDownloading(noc.id);
    try {
      const mahalluName =
        noc.tenantId && typeof noc.tenantId === 'object'
          ? noc.tenantId.name
          : undefined;
      await downloadNocPdf(
        {
          id: noc.id,
          applicantName: noc.applicantName,
          applicantPhone: noc.applicantPhone,
          type: noc.type,
          purposeTitle: noc.purposeTitle,
          purposeDescription: noc.purposeDescription,
          purpose: noc.purpose,
          status: noc.status,
          issuedDate: noc.issuedDate,
          createdAt: noc.createdAt,
          nikahRegistrationId: noc.nikahRegistrationId,
          remarks: noc.remarks,
          mahalluName,
          approvedBy: noc.approvedBy,
        } as any,
        `noc-${noc.type}-${noc.id}`
      );
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <PageSkeleton />
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-140px)] gap-4">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl w-full mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My NOCs</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            title="Refresh list"
          >
            ↻ Refresh
          </button>
        <Link
          to={ROUTES.MEMBER.NOC_REQUEST}
          className="py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg text-sm transition-colors"
        >
          + Request NOC
        </Link>
        </div>
      </div>

      {nocs.length === 0 ? (
        <Card>
          <div className="text-center py-12 space-y-3">
            <p className="text-gray-500 dark:text-gray-400">No NOC requests found.</p>
            <Link
              to={ROUTES.MEMBER.NOC_REQUEST}
              className="text-primary-600 dark:text-primary-400 text-sm font-medium hover:underline"
            >
              Submit your first NOC request →
            </Link>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Purpose / Title</th>
                  <th className="py-2 pr-4">Applied On</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {nocs.map((noc: any, index: number) => (
                  <tr
                    key={noc.id || index}
                    className="border-b border-gray-100 dark:border-gray-900 text-gray-900 dark:text-gray-100"
                  >
                    <td className="py-3 pr-4">
                      {noc.type === 'nikah' ? (
                        <span className="inline-flex items-center gap-1.5"><FiHeart className="h-3.5 w-3.5 text-primary-500" /> Nikah</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5"><FiFileText className="h-3.5 w-3.5 text-gray-400" /> Common</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 max-w-xs truncate">
                      {noc.purposeTitle ||
                        (noc.nikahRegistrationId?.brideName
                          ? `Nikah with ${noc.nikahRegistrationId.brideName}`
                          : '—')}
                    </td>
                    <td className="py-3 pr-4 text-gray-500 dark:text-gray-400">
                      {noc.createdAt
                        ? new Date(noc.createdAt).toLocaleDateString('en-IN')
                        : '—'}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          statusColors[noc.status] || statusColors.pending
                        }`}
                      >
                        {noc.status || 'pending'}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        {noc.status === 'approved' ? (
                          <button
                            onClick={() => handleDownload(noc)}
                            disabled={downloading === noc.id}
                            className="text-xs text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50"
                          >
                            {downloading === noc.id ? 'Generating…' : 'Download Certificate'}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-600">
                            {noc.status === 'rejected' ? 'Rejected' : noc.status === 'correction_required' ? 'Needs correction' : 'Awaiting approval'}
                          </span>
                        )}
                        <div className="flex items-center gap-1 ml-auto">
                          {isEditable(noc) && (
                            <button
                              onClick={() => openModal(noc, 'edit')}
                              title="Edit & resubmit"
                              aria-label="Edit and resubmit"
                              className="p-1.5 rounded-lg text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                            >
                              <FiEdit2 size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => openModal(noc, 'view')}
                            title="View"
                            aria-label="View details"
                            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          >
                            <FiEye size={14} />
                          </button>
                          {isDeletable(noc) && (
                            <button
                              onClick={() => { setDeleteError(null); setDeleteTarget(noc); }}
                              title="Delete"
                              aria-label="Delete NOC request"
                              className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                              <FiTrash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {modalState && (
        <RequestDetailModal
          type={modalState.type}
          request={modalState.request}
          mode={modalState.mode}
          onClose={() => setModalState(null)}
          onSaved={() => {
            setModalState(null);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete NOC request?"
        message="This will permanently delete this NOC request. This cannot be undone."
        consequence={deleteError || undefined}
        confirmLabel="Delete"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => { setDeleteTarget(null); setDeleteError(null); }}
      />
    </div>
  );
}
