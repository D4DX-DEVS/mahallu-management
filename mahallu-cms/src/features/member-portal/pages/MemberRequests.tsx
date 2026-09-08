import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  memberPortalService,
  NikahRegistration,
  DeathRegistration,
  NOCRecord,
} from '@/services/memberPortalService';
import { ROUTES } from '@/constants/routes';
import Card from '@/components/ui/Card';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Pagination from '@/components/ui/Pagination';
import RequestDetailModal, { RequestType } from '../components/RequestDetailModal';
import { FiEdit2, FiEye, FiHeart, FiAlertCircle, FiFileText } from 'react-icons/fi';
import { loadErrorMessage } from '@/utils/errors';
import StatusBadge from '@/components/ui/StatusBadge';
import PageHeader from '@/components/layout/PageHeader';
import SortableTh from '@/components/ui/SortableTh';
import { useSortableRows } from '@/hooks/useSortableRows';

type TabType = 'nikah' | 'death' | 'noc';
type RequestRecord = NikahRegistration | DeathRegistration | NOCRecord;

export default function MemberRequests() {
  const [activeTab, setActiveTab] = useState<TabType>('nikah');
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalState, setModalState] = useState<{
    type: RequestType;
    request: any;
    mode: 'view' | 'edit';
  } | null>(null);

  // A nikah-type NOC's real detail lives on its linked NikahRegistration record
  // (bride/groom, wali, witnesses, mahr…) — the NOC record itself only holds purpose/phone.
  const openModal = (req: RequestRecord, mode: 'view' | 'edit') => {
    const record = req as any;
    if (
      activeTab === 'noc' &&
      record.type === 'nikah' &&
      record.nikahRegistrationId &&
      typeof record.nikahRegistrationId === 'object'
    ) {
      setModalState({ type: 'nikah', request: record.nikahRegistrationId, mode });
    } else {
      setModalState({ type: activeTab, request: req, mode });
    }
  };

  const isEditable = (req: RequestRecord) => {
    const record = req as any;
    const status =
      activeTab === 'noc' &&
      record.type === 'nikah' &&
      record.nikahRegistrationId &&
      typeof record.nikahRegistrationId === 'object'
        ? record.nikahRegistrationId.status
        : record.status;
    return status === 'pending' || status === 'correction_required';
  };

  const limit = 10;

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
      setError(loadErrorMessage(err, 'requests'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, page]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setPage(1);
    // The columns mean something different per tab, so the sort does not carry.
    setSort(null);
  };

  const getDisplayName = (req: NikahRegistration | DeathRegistration): string => {
    if ('brideName' in req) {
      return `${req.groomName} & ${req.brideName}`;
    }
    return 'Death Registration';
  };

  /* The first two columns are built per tab — a nikah row's title is the two
     names, a death row's is the deceased, an NOC row's is its purpose — so
     both sort on the same expression the cell renders. */
  const {
    rows: sortedRequests,
    sort,
    toggleSort,
    setSort,
  } = useSortableRows(requests, null, {
    label: (req) => {
      const record = req as unknown as Record<string, string | undefined>;
      const nikahDetail = (req as any).nikahRegistrationId;
      if (activeTab === 'nikah') return `${record.groomName} & ${record.brideName}`;
      if (activeTab === 'death') return record.deceasedName || 'Death Registration';
      return (
        record.purposeTitle ||
        record.purpose ||
        (nikahDetail && typeof nikahDetail === 'object' ? `Nikah with ${nikahDetail.brideName}` : '')
      );
    },
    date: (req) => {
      const record = req as unknown as Record<string, string | undefined>;
      if (activeTab === 'nikah') return record.nikahDate;
      if (activeTab === 'death') return record.deathDate;
      return record.createdAt;
    },
  });

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6 max-w-4xl w-full mx-auto">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <PageHeader title="My Requests" />
        <div className="flex flex-wrap gap-2">
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
              {tab === 'nikah' ? (
                <FiHeart className="h-4 w-4" />
              ) : tab === 'death' ? (
                <FiAlertCircle className="h-4 w-4" />
              ) : (
                <FiFileText className="h-4 w-4" />
              )}
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
                    <SortableTh sortKey="label" sort={sort} onSort={toggleSort} className="py-2 pr-4">
                      {activeTab === 'nikah' ? 'Names' : activeTab === 'death' ? 'Type' : 'Purpose'}
                    </SortableTh>
                    <SortableTh sortKey="date" sort={sort} onSort={toggleSort} className="py-2 pr-4">
                      {activeTab === 'nikah' ? 'Date' : activeTab === 'death' ? 'Date' : 'Submitted'}
                    </SortableTh>
                    <SortableTh sortKey="status" sort={sort} onSort={toggleSort} className="py-2 pr-4">
                      Status
                    </SortableTh>
                    <SortableTh sortKey="remarks" sort={sort} onSort={toggleSort} className="py-2 pr-4">
                      Remarks
                    </SortableTh>
                    <th className="py-2 text-label font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRequests.map((req, index) => {
                    const record = req as unknown as Record<string, string | undefined>;
                    const nikahDetail = (req as any).nikahRegistrationId;
                    const label =
                      activeTab === 'nikah'
                        ? `${record.groomName} & ${record.brideName}`
                        : activeTab === 'death'
                          ? record.deceasedName || 'Death Registration'
                          : record.purposeTitle ||
                            record.purpose ||
                            (nikahDetail && typeof nikahDetail === 'object'
                              ? `Nikah with ${nikahDetail.brideName}`
                              : 'NOC Request');
                    const dateValue =
                      activeTab === 'nikah'
                        ? record.nikahDate
                        : activeTab === 'death'
                          ? record.deathDate
                          : record.createdAt;
                    return (
                      <tr
                        key={req.id || index}
                        className="border-b border-gray-100 dark:border-gray-900 text-gray-900 dark:text-gray-100"
                      >
                        <td className="py-3 pr-4">{label}</td>
                        <td className="py-3 pr-4 text-gray-500 dark:text-gray-400 text-xs">
                          {dateValue ? new Date(dateValue).toLocaleDateString('en-IN') : '—'}
                        </td>
                        <td className="py-3 pr-4">
                          <StatusBadge status={req.status} />
                        </td>
                        <td className="py-3 pr-4 text-xs text-gray-500 dark:text-gray-400">
                          {req.remarks || '—'}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1">
                            {isEditable(req) && (
                              <button
                                onClick={() => openModal(req, 'edit')}
                                title="Edit & resubmit"
                                aria-label="Edit and resubmit"
                                className="p-2 rounded-lg text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                              >
                                <FiEdit2 size={15} />
                              </button>
                            )}
                            <button
                              onClick={() => openModal(req, 'view')}
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

      {modalState && (
        <RequestDetailModal
          type={modalState.type}
          request={modalState.request}
          mode={modalState.mode}
          onClose={() => setModalState(null)}
          onSaved={() => {
            setModalState(null);
            load();
          }}
        />
      )}
    </div>
  );
}
