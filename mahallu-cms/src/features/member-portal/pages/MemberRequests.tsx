import { useCallback, useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import { Link, useNavigate } from 'react-router-dom';
import {
  memberPortalService,
  NikahRegistration,
  DeathRegistration,
  NOCRecord,
} from '@/services/memberPortalService';
import { ROUTES } from '@/constants/routes';
import TableCard from '@/components/ui/TableCard';
import TableToolbar from '@/components/ui/TableToolbar';
import Tabs from '@/components/ui/Tabs';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import ActionsMenu from '@/components/ui/ActionsMenu';
import { TableColumn } from '@/types';
import Pagination from '@/components/ui/Pagination';
import RequestDetailModal, { RequestType } from '../components/RequestDetailModal';
import { FiAlertCircle, FiEdit2, FiEye, FiFileText, FiHeart, FiPlus } from 'react-icons/fi';
import { loadErrorMessage } from '@/utils/errors';
import { toTitleCase } from '@/utils/format';
import StatusBadge from '@/components/ui/StatusBadge';
import PageHeader from '@/components/layout/PageHeader';

type TabType = 'nikah' | 'death' | 'noc';
type RequestRecord = NikahRegistration | DeathRegistration | NOCRecord;

export default function MemberRequests() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('nikah');
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
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

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await memberPortalService.getRegistrations(activeTab, page, limit);
      const rows = result.data as unknown;
      // Defensive: older backend shape keyed rows by type instead of returning an array
      setRequests(Array.isArray(rows) ? rows : ((rows as Record<string, never[]>)?.[activeTab] ?? []));
      const total = result.pagination?.total || 0;
      setTotalItems(total);
      setTotalPages(Math.max(1, Math.ceil(total / limit)));
    } catch (err) {
      setError(loadErrorMessage(err, 'requests'));
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, limit]);

  useEffect(() => {
    load();
  }, [load]);

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

  const labelOf = (req: RequestRecord) => {
    const record = req as unknown as Record<string, string | undefined>;
    const nikahDetail = (req as any).nikahRegistrationId;
    if (activeTab === 'nikah') return `${record.groomName} & ${record.brideName}`;
    if (activeTab === 'death') return record.deceasedName || 'Death Registration';
    return (
      record.purposeTitle ||
      record.purpose ||
      (nikahDetail && typeof nikahDetail === 'object' ? `Nikah with ${nikahDetail.brideName}` : 'NOC Request')
    );
  };

  const dateOf = (req: RequestRecord) => {
    const record = req as unknown as Record<string, string | undefined>;
    if (activeTab === 'nikah') return record.nikahDate;
    if (activeTab === 'death') return record.deathDate;
    return record.createdAt;
  };

  /* The columns mean something different per tab, so the table is rebuilt on a
     tab change (the `key` below) and its sort starts fresh. The title and date
     are computed per row, so they sort on the text the cell shows. */
  const columns: TableColumn<RequestRecord>[] = [
    {
      key: 'label',
      label: activeTab === 'nikah' ? 'Names' : activeTab === 'death' ? 'Deceased' : 'Purpose',
      sortable: false,
      width: '18rem',
      render: (_v, req) => <span className="font-medium text-foreground">{toTitleCase(labelOf(req))}</span>,
    },
    {
      key: 'date',
      label: activeTab === 'noc' ? 'Submitted' : 'Date',
      sortable: false,
      priority: 'secondary',
      width: '9rem',
      render: (_v, req) => {
        const value = dateOf(req);
        return value ? new Date(value).toLocaleDateString('en-IN') : '—';
      },
    },
    { key: 'status', label: 'Status', sortable: true, width: '9rem', render: (_v, req) => <StatusBadge status={req.status} /> },
    { key: 'remarks', label: 'Remarks', sortable: false, priority: 'secondary', width: '16rem', render: (v) => v || '—' },
    {
      key: 'actions',
      label: '',
      width: '6.5rem',
      align: 'right',
      sortable: false,
      render: (_v, req) => (
        <ActionsMenu
          label="Actions for this request"
          items={[
            ...(isEditable(req)
              ? [{ label: 'Edit & resubmit', icon: <FiEdit2 className="h-4 w-4" />, onClick: () => openModal(req, 'edit') }]
              : []),
            { label: 'View', icon: <FiEye className="h-4 w-4" />, onClick: () => openModal(req, 'view') },
          ]}
        />
      ),
    },
  ];

  const createPath =
    activeTab === 'nikah' ? ROUTES.MEMBER.NIKAH_REQUEST : activeTab === 'death' ? ROUTES.MEMBER.DEATH_REQUEST : null;

  return (
    <>
      <PageHeader
        title="My requests"
        description="Registrations and NOCs you have submitted, and where they stand."
        actions={
          <>
            {activeTab === 'nikah' && (
              <Link to={ROUTES.MEMBER.NIKAH_REQUEST}>
                <Button icon={<FiPlus />} collapseLabel>
                  New nikah registration
                </Button>
              </Link>
            )}
            {activeTab === 'death' && (
              <Link to={ROUTES.MEMBER.DEATH_REQUEST}>
                <Button icon={<FiPlus />} collapseLabel>
                  Report a death
                </Button>
              </Link>
            )}
          </>
        }
      />

      <TableCard>
        <TableToolbar
          tabs={
            <Tabs
              variant="segmented"
              ariaLabel="Request type"
              value={activeTab}
              onChange={(value) => handleTabChange(value as TabType)}
              items={[
                { value: 'nikah', label: 'Nikah', icon: <FiHeart className="h-4 w-4" /> },
                { value: 'death', label: 'Death', icon: <FiAlertCircle className="h-4 w-4" /> },
                { value: 'noc', label: 'NOC', icon: <FiFileText className="h-4 w-4" /> },
              ]}
            />
          }
          onRefresh={load}
        />

        {error ? (
          <EmptyState variant="error" entity="requests" description={error} action={{ label: 'Try again', onClick: load }} />
        ) : (
          <>
            <Table
              key={activeTab}
              fixedLayout
              columns={columns}
              data={requests}
              isLoading={loading}
              entity={`${activeTab} requests`}
              emptyAction={createPath ? { label: activeTab === 'death' ? 'Report a death' : 'Add registration', onClick: () => navigate(createPath) } : undefined}
              rowKey={(req, index) => req.id || String(index)}
              onRowClick={(req) => openModal(req, 'view')}
            />

            <div className="mt-4">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={limit}
                entity="requests"
                onPageChange={setPage}
                onItemsPerPageChange={(size) => {
                  setLimit(size);
                  setPage(1);
                }}
              />
            </div>
          </>
        )}
      </TableCard>

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
    </>
  );
}
