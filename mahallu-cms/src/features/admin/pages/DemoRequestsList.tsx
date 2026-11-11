import { useCallback, useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCheckCircle, FiEye, FiPhone, FiPlus, FiXCircle } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import PageHeader from '@/components/layout/PageHeader';
import TableCard from '@/components/ui/TableCard';
import Table from '@/components/ui/Table';
import TableToolbar from '@/components/ui/TableToolbar';
import Pagination from '@/components/ui/Pagination';
import EmptyState from '@/components/ui/EmptyState';
import ActionsMenu from '@/components/ui/ActionsMenu';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import DetailSection from '@/components/ui/DetailSection';
import FilterPanel from '@/components/ui/FilterPanel';
import Select from '@/components/ui/Select';
import StatusBadge from '@/components/ui/StatusBadge';
import { controlClasses, controlErrorClasses, labelClasses } from '@/components/ui/controlStyles';
import { TableColumn, Pagination as PaginationType } from '@/types';
import {
  demoRequestService,
  requestStatus,
  ZAAD_REQUEST_LABELS as LABELS,
  DemoRequest,
  DemoRequestStatus,
} from '@/services/demoRequestService';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDateTime, formatPhoneNumber } from '@/utils/format';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import { toast } from '@/store/toastStore';

const REASON_MAX = 500;

/* The shared badge has no "accepted" wording; "approved" is the same state in its vocabulary. */
function RequestStatusBadge({ request }: { request: DemoRequest }) {
  const status = requestStatus(request);
  return (
    <StatusBadge
      status={status === 'accepted' ? 'approved' : status}
      label={status.charAt(0).toUpperCase() + status.slice(1)}
    />
  );
}

/* Numbers are stored as the 10 national digits; both links need the country code. */
const nationalDigits = (phone: string) => phone.replace(/\D/g, '').slice(-10);
const callHref = (phone: string) => `tel:+91${nationalDigits(phone)}`;
const whatsappHref = (phone: string, mahalluName: string) =>
  `https://wa.me/91${nationalDigits(phone)}?text=${encodeURIComponent(
    `Assalamu Alaikum! This is the ZAAD team about your ZAAD request for ${mahalluName}.`
  )}`;

/* Rows open the detail view, so a link inside one must not also do that. */
const stop = (event: MouseEvent) => event.stopPropagation();

function PhoneLink({ phone, kind, mahalluName }: { phone: string; kind: 'call' | 'whatsapp'; mahalluName: string }) {
  const isCall = kind === 'call';
  return (
    <a
      href={isCall ? callHref(phone) : whatsappHref(phone, mahalluName)}
      target={isCall ? undefined : '_blank'}
      rel={isCall ? undefined : 'noopener noreferrer'}
      onClick={stop}
      className="inline-flex items-center gap-2 font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
      aria-label={`${isCall ? 'Call' : 'WhatsApp'} ${formatPhoneNumber(phone)}`}
    >
      {isCall ? (
        <FiPhone className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      ) : (
        <FaWhatsapp className="h-4 w-4 text-success" aria-hidden="true" />
      )}
      {formatPhoneNumber(phone)}
    </a>
  );
}

const ACTION_LINK =
  'inline-flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const FIELD_GROUP = 'grid grid-cols-1 gap-x-6 gap-y-4 p-4 sm:grid-cols-2 sm:p-5';

/** One answer from the request: its label over the full value, nothing cut short. */
function RequestField({ label, wide, children }: { label: string; wide?: boolean; children?: ReactNode }) {
  const blank = children === undefined || children === null || children === '' || children === false;
  return (
    <div className={wide ? 'min-w-0 sm:col-span-2' : 'min-w-0'}>
      <dt className="text-xs leading-relaxed text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-foreground">{blank ? '—' : children}</dd>
    </div>
  );
}

/** Super admin inbox for the landing page's "Request ZAAD" form. */
export default function DemoRequestsList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | DemoRequestStatus>('all');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  /* The request an action is running for, so its buttons can't be pressed twice. */
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<DemoRequest | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [requests, setRequests] = useState<DemoRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [selected, setSelected] = useState<DemoRequest | null>(null);

  const debouncedSearch = useDebounce(searchQuery, 500);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await demoRequestService.getAll({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setRequests(result.data);
      setPagination(result.pagination);
    } catch (err) {
      setError(loadErrorMessage(err, 'ZAAD requests'));
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  /* Records the decision, then opens the tenant form prefilled. The Mahall itself is only created
     when that form is submitted. */
  const accept = async (request: DemoRequest) => {
    if (busyId) return;
    setBusyId(request.id);
    try {
      await demoRequestService.accept(request.id);
      setSelected(null);
      toast.success(`Request accepted. Review the details and create ${request.mahalluName}.`);
      navigate(`/admin/tenants/create?demoRequest=${request.id}`);
    } catch (err) {
      toast.error(errorMessage(err, { action: 'accept this request' }));
      // Someone else may have decided it already; show what is stored now.
      fetchRequests();
    } finally {
      setBusyId(null);
    }
  };

  const openReject = (request: DemoRequest) => {
    setSelected(null);
    setRejecting(request);
    setReason('');
    setReasonError('');
  };

  const closeReject = () => {
    if (busyId) return;
    setRejecting(null);
  };

  const confirmReject = async () => {
    if (!rejecting || busyId) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      setReasonError('Please enter the reason for rejection.');
      return;
    }
    setBusyId(rejecting.id);
    try {
      const result = await demoRequestService.reject(rejecting.id, trimmed);
      setRejecting(null);
      if (result.notification === 'sent') toast.success(result.message);
      else toast.warning(result.message);
      await fetchRequests();
    } catch (err) {
      setReasonError(errorMessage(err, { action: 'reject this request' }));
      fetchRequests();
    } finally {
      setBusyId(null);
    }
  };

  const columns: TableColumn<DemoRequest>[] = [
    {
      key: 'mahalluName',
      label: 'Mahallu',
      width: '18rem',
      render: (value: string) => <span className="font-medium text-foreground">{value}</span>,
    },
    {
      key: 'officeBearerName',
      label: 'President / Secretary',
      width: '12rem',
      render: (value?: string) => value || '—',
    },
    {
      key: 'contactNumber',
      label: 'Phone',
      width: '11rem',
      render: (value: string, row) => <PhoneLink phone={value} kind="call" mahalluName={row.mahalluName} />,
    },
    {
      key: 'whatsappNumber',
      label: 'WhatsApp number',
      width: '11rem',
      render: (value: string, row) => <PhoneLink phone={value} kind="whatsapp" mahalluName={row.mahalluName} />,
    },
    {
      key: 'status',
      label: 'Status',
      width: '8rem',
      sortable: false,
      render: (_: unknown, row) => <RequestStatusBadge request={row} />,
    },
    {
      key: 'createdAt',
      label: 'Received',
      priority: 'secondary',
      width: '12rem',
      render: (value: string) => formatDateTime(value),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '6rem',
      render: (_, row) => (
        <div onClick={stop}>
          <ActionsMenu
            label={`Actions for ${row.mahalluName}`}
            items={[
              {
                label: 'View details',
                icon: <FiEye className="h-4 w-4" />,
                onClick: () => setSelected(row),
              },
              ...(requestStatus(row) === 'pending'
                ? [
                    {
                      label: 'Accept Request',
                      icon: <FiCheckCircle className="h-4 w-4" />,
                      disabled: busyId !== null,
                      onClick: () => accept(row),
                    },
                    {
                      label: 'Reject Request',
                      icon: <FiXCircle className="h-4 w-4" />,
                      variant: 'danger' as const,
                      disabled: busyId !== null,
                      onClick: () => openReject(row),
                    },
                  ]
                : []),
              ...(requestStatus(row) === 'accepted'
                ? [
                    row.tenantId
                      ? {
                          label: 'View Mahall',
                          icon: <FiEye className="h-4 w-4" />,
                          onClick: () => navigate(`/admin/tenants/${row.tenantId}`),
                        }
                      : {
                          label: 'Create Mahall',
                          icon: <FiPlus className="h-4 w-4" />,
                          onClick: () => navigate(`/admin/tenants/create?demoRequest=${row.id}`),
                        },
                  ]
                : []),
            ]}
          />
        </div>
      ),
    },
  ];

  const isFiltered = Boolean(debouncedSearch) || statusFilter !== 'all';

  return (
    <>
      <PageHeader title="ZAAD requests" description="Masjids and Mahallus that requested ZAAD from the website." />

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={(value) => {
            setSearchQuery(value);
            setCurrentPage(1);
          }}
          searchEntity="ZAAD requests"
          onFilterClick={() => setIsFilterVisible((open) => !open)}
          isFilterVisible={isFilterVisible}
          hasFilters
          activeFilterCount={statusFilter !== 'all' ? 1 : 0}
          onRefresh={fetchRequests}
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-52">
              <Select
                label="Status"
                options={[
                  { value: 'all', label: 'All statuses' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'accepted', label: 'Accepted' },
                  { value: 'rejected', label: 'Rejected' },
                ]}
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as 'all' | DemoRequestStatus);
                  setCurrentPage(1);
                }}
              />
            </div>
            {statusFilter !== 'all' && (
              <Button
                variant="ghost"
                onClick={() => {
                  setStatusFilter('all');
                  setCurrentPage(1);
                }}
              >
                Clear filters
              </Button>
            )}
          </FilterPanel>
        )}

        {error ? (
          <EmptyState
            variant="error"
            entity="ZAAD requests"
            description={error}
            action={{ label: 'Try again', onClick: fetchRequests }}
          />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={requests}
              rowKey={(row) => row.id}
              onRowClick={(row) => setSelected(row)}
              isLoading={loading}
              entity="ZAAD requests"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? {
                      label: 'Clear filters',
                      onClick: () => {
                        setSearchQuery('');
                        setStatusFilter('all');
                        setCurrentPage(1);
                      },
                    }
                  : undefined
              }
            />

            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="ZAAD requests"
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={(size) => {
                    setItemsPerPage(size);
                    setCurrentPage(1);
                  }}
                />
              </div>
            )}
          </>
        )}
      </TableCard>

      {/* Detail view: the whole record plus one-tap call and WhatsApp. */}
      <Modal
        isOpen={selected !== null}
        onClose={() => setSelected(null)}
        title="ZAAD request"
        description={selected?.mahalluName}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Close
            </Button>
            {selected && requestStatus(selected) === 'pending' && (
              <>
                <Button variant="danger" icon={<FiXCircle />} disabled={busyId !== null} onClick={() => openReject(selected)}>
                  Reject Request
                </Button>
                <Button
                  icon={<FiCheckCircle />}
                  isLoading={busyId === selected.id}
                  disabled={busyId !== null}
                  onClick={() => accept(selected)}
                >
                  Accept Request
                </Button>
              </>
            )}
          </>
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <a
                href={callHref(selected.contactNumber)}
                className={`${ACTION_LINK} bg-primary text-primary-foreground hover:bg-primary/90`}
              >
                <FiPhone className="h-4 w-4" aria-hidden="true" />
                Call {formatPhoneNumber(selected.contactNumber)}
              </a>
              <a
                href={whatsappHref(selected.whatsappNumber, selected.mahalluName)}
                target="_blank"
                rel="noopener noreferrer"
                className={`${ACTION_LINK} border border-border bg-card text-foreground hover:bg-subtle`}
              >
                <FaWhatsapp className="h-4 w-4 text-success" aria-hidden="true" />
                WhatsApp {formatPhoneNumber(selected.whatsappNumber)}
              </a>
            </div>

            {/* The answers laid out like the form itself, with its Malayalam labels. */}
            <div className="divide-y divide-border rounded-lg border border-border">
              <dl className={FIELD_GROUP}>
                <RequestField wide label={LABELS.mahalluName}>{selected.mahalluName}</RequestField>
                <RequestField wide label={LABELS.affiliationNumber}>{selected.affiliationNumber}</RequestField>
                <RequestField wide label={LABELS.location}>{selected.location}</RequestField>
                <RequestField wide label={LABELS.localUnit}>{selected.localUnit}</RequestField>
                <RequestField label={LABELS.area}>{selected.area}</RequestField>
                <RequestField label={LABELS.district}>{selected.district}</RequestField>
              </dl>
              <dl className={FIELD_GROUP}>
                <RequestField wide label={LABELS.officeBearerName}>{selected.officeBearerName}</RequestField>
                <RequestField label={LABELS.contactNumber}>
                  <PhoneLink phone={selected.contactNumber} kind="call" mahalluName={selected.mahalluName} />
                </RequestField>
                <RequestField label={LABELS.whatsappNumber}>
                  <PhoneLink phone={selected.whatsappNumber} kind="whatsapp" mahalluName={selected.mahalluName} />
                </RequestField>
              </dl>
              <dl className={FIELD_GROUP}>
                <RequestField wide label={LABELS.contactPersonName}>{selected.contactPersonName}</RequestField>
                <RequestField label={LABELS.contactPersonPhone}>
                  {selected.contactPersonPhone && (
                    <PhoneLink phone={selected.contactPersonPhone} kind="call" mahalluName={selected.mahalluName} />
                  )}
                </RequestField>
                <RequestField label={LABELS.contactPersonWhatsapp}>
                  {selected.contactPersonWhatsapp && (
                    <PhoneLink phone={selected.contactPersonWhatsapp} kind="whatsapp" mahalluName={selected.mahalluName} />
                  )}
                </RequestField>
              </dl>
            </div>

            <dl className={`${FIELD_GROUP} rounded-lg bg-subtle`}>
              <RequestField label="Status">
                <RequestStatusBadge request={selected} />
              </RequestField>
              <RequestField label="Received">{formatDateTime(selected.createdAt)}</RequestField>
              {selected.reviewedAt && <RequestField label="Reviewed">{formatDateTime(selected.reviewedAt)}</RequestField>}
              <RequestField wide label="Reference">
                <span className="break-all font-mono text-xs">{selected.id}</span>
              </RequestField>
            </dl>

            {requestStatus(selected) === 'rejected' && (
              <div className="rounded-lg border border-border">
                <DetailSection
                  title="Rejection"
                  icon={FiXCircle}
                  items={[
                    { label: 'Reason', value: selected.rejectionReason || '—', wide: true },
                    {
                      label: 'Requester notified on WhatsApp',
                      value:
                        selected.rejectionNotification?.status === 'sent'
                          ? `Yes, ${formatDateTime(selected.rejectionNotification.attemptedAt)}`
                          : selected.rejectionNotification?.status === 'failed'
                            ? 'No, the message could not be sent. Please contact them directly.'
                            : 'No',
                      wide: true,
                    },
                  ]}
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Rejecting needs a reason: the requester is sent it. */}
      <Modal
        isOpen={rejecting !== null}
        onClose={closeReject}
        title="Reject request"
        description={rejecting?.mahalluName}
        disableBackdropClose
        footer={
          <>
            <Button variant="outline" onClick={closeReject} disabled={busyId !== null}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmReject} isLoading={busyId !== null}>
              Confirm Rejection
            </Button>
          </>
        }
      >
        <div>
          <label htmlFor="rejection-reason" className={labelClasses}>
            Reason for rejection <span aria-hidden="true">*</span>
          </label>
          <textarea
            id="rejection-reason"
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              if (reasonError) setReasonError('');
            }}
            rows={4}
            maxLength={REASON_MAX}
            required
            aria-invalid={reasonError ? true : undefined}
            aria-describedby={reasonError ? 'rejection-reason-error' : 'rejection-reason-help'}
            placeholder="e.g. Outside our current service area"
            className={`${controlClasses} py-2 ${reasonError ? controlErrorClasses : ''}`}
          />
          {reasonError ? (
            <p id="rejection-reason-error" role="alert" className="mt-1.5 text-xs text-destructive">
              {reasonError}
            </p>
          ) : (
            <p id="rejection-reason-help" className="mt-1.5 text-xs text-muted-foreground">
              This reason is sent to the requester on WhatsApp.
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
