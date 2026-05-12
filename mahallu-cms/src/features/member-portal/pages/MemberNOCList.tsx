import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { memberPortalService } from '@/services/memberPortalService';
import { downloadNocPdf } from '@/utils/nocPdf';
import { ROUTES } from '@/constants/routes';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

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
    setDownloading(noc._id);
    try {
      const mahalluName =
        noc.tenantId && typeof noc.tenantId === 'object'
          ? noc.tenantId.name
          : undefined;
      await downloadNocPdf(
        {
          id: noc._id,
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
        `noc-${noc.type}-${noc._id}`
      );
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-140px)]">
        <LoadingSpinner />
      </div>
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
    <div className="space-y-6">
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
                    key={noc._id || index}
                    className="border-b border-gray-100 dark:border-gray-900 text-gray-900 dark:text-gray-100"
                  >
                    <td className="py-3 pr-4">
                      {noc.type === 'nikah' ? '💍 Nikah' : '📄 Common'}
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
                      {noc.status === 'approved' ? (
                        <button
                          onClick={() => handleDownload(noc)}
                          disabled={downloading === noc._id}
                          className="text-xs text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50"
                        >
                          {downloading === noc._id ? 'Generating…' : 'Download Certificate'}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-600">
                          {noc.status === 'pending' ? 'Awaiting approval' : 'Rejected'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
