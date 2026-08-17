import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { memberPortalService, NikahRegistration, DeathRegistration } from '@/services/memberPortalService';
import { ROUTES } from '@/constants/routes';
import Card from '@/components/ui/Card';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Pagination from '@/components/ui/Pagination';
import { FiEdit2, FiEye, FiHeart, FiAlertCircle, FiFileText } from 'react-icons/fi';

type TabType = 'nikah' | 'death' | 'noc';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  correction_required: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export default function MemberRequests() {
  const [activeTab, setActiveTab] = useState<TabType>('nikah');
  const [requests, setRequests] = useState<(NikahRegistration | DeathRegistration)[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const limit = 10;

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await memberPortalService.getRegistrations(activeTab, page, limit);
        const rows = result.data as unknown;
        // Defensive: older backend shape keyed rows by type instead of returning an array
        setRequests(Array.isArray(rows) ? rows : ((rows as Record<string, never[]>)?.[activeTab] ?? []));
        const total = result.pagination?.total || 0;
        setTotalItems(total);
        setTotalPages(Math.ceil(total / limit));
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load requests');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [activeTab, page]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setPage(1);
  };

  const getDisplayName = (req: NikahRegistration | DeathRegistration): string => {
    if ('brideName' in req) {
      return `${req.groomName} & ${req.brideName}`;
    }
    return 'Death Registration';
  };

  if (loading) {
    return (
      <PageSkeleton />
    );
  }

  return (
    <div className="space-y-6 max-w-4xl w-full mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Requests</h1>
        <div className="flex gap-2">
          {activeTab === 'nikah' && (
            <Link
              to={ROUTES.MEMBER.NIKAH_REQUEST}
              className="py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg text-sm transition-colors"
            >
              + New Nikah Registration
            </Link>
          )}
          {activeTab === 'death' && (
            <Link
              to={ROUTES.MEMBER.DEATH_REQUEST}
              className="py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg text-sm transition-colors"
            >
              + Report Death
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {(['nikah', 'death', 'noc'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
              activeTab === tab
                ? 'text-primary-600 dark:text-primary-400 border-primary-600 dark:border-primary-400'
                : 'text-gray-600 dark:text-gray-400 border-transparent hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              {tab === 'nikah' ? <FiHeart className="h-4 w-4" /> : tab === 'death' ? <FiAlertCircle className="h-4 w-4" /> : <FiFileText className="h-4 w-4" />}
              {tab === 'nikah' ? 'Nikah' : tab === 'death' ? 'Death' : 'NOC'}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <Card>
          <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        </Card>
      )}

      {requests.length === 0 ? (
        <Card>
          <div className="text-center py-12 space-y-3">
            <p className="text-gray-500 dark:text-gray-400">No {activeTab} registrations found.</p>
            {activeTab === 'nikah' && (
              <Link
                to={ROUTES.MEMBER.NIKAH_REQUEST}
                className="text-primary-600 dark:text-primary-400 text-sm font-medium hover:underline inline-block"
              >
                Submit your first nikah registration →
              </Link>
            )}
            {activeTab === 'death' && (
              <Link
                to={ROUTES.MEMBER.DEATH_REQUEST}
                className="text-primary-600 dark:text-primary-400 text-sm font-medium hover:underline inline-block"
              >
                Report a death →
              </Link>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                    <th className="py-2 pr-4">
                      {activeTab === 'nikah' ? 'Names' : activeTab === 'death' ? 'Type' : 'Purpose'}
                    </th>
                    <th className="py-2 pr-4">
                      {activeTab === 'nikah' ? 'Date' : activeTab === 'death' ? 'Date' : 'Submitted'}
                    </th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Remarks</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req, index) => {
                    const record = req as unknown as Record<string, string | undefined>;
                    const label =
                      activeTab === 'nikah'
                        ? `${record.groomName} & ${record.brideName}`
                        : activeTab === 'death'
                          ? record.deceasedName || 'Death Registration'
                          : record.purposeTitle || record.purpose || 'NOC Request';
                    const dateValue =
                      activeTab === 'nikah'
                        ? record.nikahDate
                        : activeTab === 'death'
                          ? record.deathDate
                          : record.createdAt;
                    return (
                      <tr
                        key={req._id || index}
                        className="border-b border-gray-100 dark:border-gray-900 text-gray-900 dark:text-gray-100"
                      >
                        <td className="py-3 pr-4">{label}</td>
                        <td className="py-3 pr-4 text-gray-500 dark:text-gray-400 text-xs">
                          {dateValue ? new Date(dateValue).toLocaleDateString('en-IN') : '—'}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              statusColors[req.status] || statusColors.pending
                            }`}
                          >
                            {req.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-xs text-gray-500 dark:text-gray-400">
                          {req.remarks || '—'}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1">
                            {(req.status === 'pending' || req.status === 'correction_required') && (
                              <button
                                onClick={() => setEditingId(req._id)}
                                title="Edit & resubmit"
                                aria-label="Edit and resubmit"
                                className="p-2 rounded-lg text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                              >
                                <FiEdit2 size={15} />
                              </button>
                            )}
                            <button
                              onClick={() => setEditingId(req._id)}
                              title="View"
                              aria-label="View details"
                              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                              <FiEye size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {totalPages > 1 && (
            <div className="flex justify-center pt-4">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={limit}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
