import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { memberPortalService } from '@/services/memberPortalService';
import { downloadNocPdf } from '@/utils/nocPdf';
import { ROUTES } from '@/constants/routes';
import Button from '@/components/ui/Button';
import TableCard from '@/components/ui/TableCard';
import TableToolbar from '@/components/ui/TableToolbar';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import { TableColumn } from '@/types';
import ActionsMenu from '@/components/ui/ActionsMenu';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import RequestDetailModal, { RequestType } from '../components/RequestDetailModal';
import { FiHeart, FiFileText, FiEdit2, FiEye, FiTrash2, FiPlus } from 'react-icons/fi';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import { toTitleCase } from '@/utils/format';
import StatusBadge from '@/components/ui/StatusBadge';
import PageHeader from '@/components/layout/PageHeader';

export default function MemberNOCList() {
  const navigate = useNavigate();
  const [nocs, setNocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [modalState, setModalState] = useState<{
    type: RequestType;
    request: any;
    mode: 'view' | 'edit';
    nocRef: any;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // A nikah-type NOC's real detail lives on its linked NikahRegistration record
  // (bride/groom, wali, witnesses, mahr…) — the NOC record itself only holds purpose/phone.
  const openModal = (noc: any, mode: 'view' | 'edit') => {
    if (noc.type === 'nikah' && noc.nikahRegistrationId && typeof noc.nikahRegistrationId === 'object') {
      setModalState({ type: 'nikah', request: noc.nikahRegistrationId, mode, nocRef: noc });
    } else {
      setModalState({ type: 'noc', request: noc, mode, nocRef: noc });
    }
  };

  const isEditable = (noc: any) => {
    const status =
      noc.type === 'nikah' && noc.nikahRegistrationId && typeof noc.nikahRegistrationId === 'object'
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
      setDeleteError(errorMessage(err, { action: 'delete noc request' }));
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
      setError(loadErrorMessage(err, 'noc records'));
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
      const mahalluName = noc.tenantId && typeof noc.tenantId === 'object' ? noc.tenantId.name : undefined;
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

  const purposeOf = (noc: any) =>
    noc.purposeTitle ||
    (noc.nikahRegistrationId?.brideName ? `Nikah with ${toTitleCase(noc.nikahRegistrationId.brideName)}` : '—');

  const columns: TableColumn<any>[] = [
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      width: '9rem',
      render: (_v, noc) =>
        noc.type === 'nikah' ? (
          <span className="inline-flex items-center gap-1.5">
            <FiHeart className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Nikah
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <FiFileText className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" /> Common
          </span>
        ),
    },
    {
      key: 'purposeTitle',
      label: 'Purpose / title',
      sortable: false,
      width: '18rem',
      render: (_v, noc) => <span className="font-medium text-foreground">{purposeOf(noc)}</span>,
    },
    {
      key: 'createdAt',
      label: 'Applied on',
      sortable: true,
      priority: 'secondary',
      width: '9rem',
      render: (v) => (v ? new Date(v).toLocaleDateString('en-IN') : '—'),
    },
    { key: 'status', label: 'Status', sortable: true, width: '9rem', render: (_v, noc) => <StatusBadge status={noc.status} /> },
    {
      key: 'certificate',
      label: 'Certificate',
      sortable: false,
      priority: 'secondary',
      width: '12rem',
      render: (_v, noc) =>
        noc.status === 'approved' ? (
          <button
            type="button"
            onClick={() => handleDownload(noc)}
            disabled={downloading === noc.id}
            className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
          >
            {downloading === noc.id ? 'Generating…' : 'Download certificate'}
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">
            {noc.status === 'rejected'
              ? 'Rejected'
              : noc.status === 'correction_required'
                ? 'Needs correction'
                : 'Awaiting approval'}
          </span>
        ),
    },
    {
      key: 'actions',
      label: '',
      width: '6.5rem',
      align: 'right',
      sortable: false,
      render: (_v, noc) => (
        <ActionsMenu
          label="Actions for NOC request"
          items={[
            ...(isEditable(noc)
              ? [
                  {
                    label: 'Edit & resubmit',
                    icon: <FiEdit2 className="h-4 w-4" />,
                    onClick: () => openModal(noc, 'edit'),
                  },
                ]
              : []),
            {
              label: 'View',
              icon: <FiEye className="h-4 w-4" />,
              onClick: () => openModal(noc, 'view'),
            },
            ...(isDeletable(noc)
              ? [
                  {
                    label: 'Delete',
                    icon: <FiTrash2 className="h-4 w-4" />,
                    variant: 'danger' as const,
                    onClick: () => {
                      setDeleteError(null);
                      setDeleteTarget(noc);
                    },
                  },
                ]
              : []),
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="My NOCs"
        description="No-objection certificates you have requested."
        actions={
          <Link to={ROUTES.MEMBER.NOC_REQUEST}>
            <Button icon={<FiPlus />} collapseLabel>
              Request an NOC
            </Button>
          </Link>
        }
      />

      <TableCard>
        <TableToolbar onRefresh={() => setRefreshKey((k) => k + 1)} />

        {error ? (
          <EmptyState variant="error" entity="NOCs" description={error} action={{ label: 'Try again', onClick: () => setRefreshKey((k) => k + 1) }} />
        ) : (
          <Table
            fixedLayout
            columns={columns}
            data={nocs}
            isLoading={loading}
            entity="NOC requests"
            emptyAction={{ label: 'Request an NOC', onClick: () => navigate(ROUTES.MEMBER.NOC_REQUEST) }}
            rowKey={(noc, index) => noc.id || String(index)}
            onRowClick={(noc) => openModal(noc, 'view')}
          />
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
            setRefreshKey((k) => k + 1);
          }}
          onEdit={
            modalState.mode === 'view' && modalState.nocRef && isEditable(modalState.nocRef)
              ? () => setModalState({ ...modalState, mode: 'edit' })
              : undefined
          }
          onDelete={
            modalState.mode === 'view' && modalState.nocRef && isDeletable(modalState.nocRef)
              ? () => {
                  setDeleteError(null);
                  setDeleteTarget(modalState.nocRef);
                  setModalState(null);
                }
              : undefined
          }
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete NOC request?"
        message="This will permanently delete this NOC request. This cannot be undone."
        consequence={deleteError || undefined}
        confirmLabel="Delete request"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
      />
    </>
  );
}
