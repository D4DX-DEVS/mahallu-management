import { useCallback, useEffect, useState, type MouseEvent } from 'react';
import { FiEye, FiMail, FiPhone } from 'react-icons/fi';
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
import { TableColumn, Pagination as PaginationType } from '@/types';
import { demoRequestService, DemoRequest } from '@/services/demoRequestService';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDateTime, formatPhoneNumber } from '@/utils/format';
import { loadErrorMessage } from '@/utils/errors';

/* Numbers are stored as the 10 national digits; both links need the country code. */
const nationalDigits = (phone: string) => phone.replace(/\D/g, '').slice(-10);
const callHref = (phone: string) => `tel:+91${nationalDigits(phone)}`;
const whatsappHref = (phone: string, mahalluName: string) =>
  `https://wa.me/91${nationalDigits(phone)}?text=${encodeURIComponent(
    `Assalamu Alaikum! This is the ZAAD team about your demo request for ${mahalluName}.`
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

/** Super admin inbox for the landing page's "Request a demo" form. */
export default function DemoRequestsList() {
  const [searchQuery, setSearchQuery] = useState('');
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
      });
      setRequests(result.data);
      setPagination(result.pagination);
    } catch (err) {
      setError(loadErrorMessage(err, 'demo requests'));
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, debouncedSearch]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const columns: TableColumn<DemoRequest>[] = [
    {
      key: 'mahalluName',
      label: 'Mahallu',
      width: '18rem',
      render: (value: string) => <span className="font-medium text-foreground">{value}</span>,
    },
    {
      key: 'contactNumber',
      label: 'Contact number',
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
            ]}
          />
        </div>
      ),
    },
  ];

  const isFiltered = Boolean(debouncedSearch);

  return (
    <>
      <PageHeader title="Demo requests" description="Mahallus that asked for a demo from the website." />

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={(value) => {
            setSearchQuery(value);
            setCurrentPage(1);
          }}
          searchEntity="demo requests"
          onRefresh={fetchRequests}
        />

        {error ? (
          <EmptyState
            variant="error"
            entity="demo requests"
            description={error}
            action={{ label: 'Try again', onClick: fetchRequests }}
          />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={requests}
              rowKey={(row) => row._id}
              onRowClick={(row) => setSelected(row)}
              isLoading={loading}
              entity="demo requests"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? {
                      label: 'Clear search',
                      onClick: () => {
                        setSearchQuery('');
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
                  entity="demo requests"
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
        title="Demo request"
        description={selected?.mahalluName}
        footer={
          <Button variant="outline" onClick={() => setSelected(null)}>
            Close
          </Button>
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

            <div className="rounded-lg border border-border">
              <DetailSection
                title="Request details"
                icon={FiMail}
                items={[
                  { label: 'Mahallu name', value: selected.mahalluName, wide: true },
                  {
                    label: 'Contact number',
                    value: <PhoneLink phone={selected.contactNumber} kind="call" mahalluName={selected.mahalluName} />,
                  },
                  {
                    label: 'WhatsApp number',
                    value: (
                      <PhoneLink phone={selected.whatsappNumber} kind="whatsapp" mahalluName={selected.mahalluName} />
                    ),
                  },
                  { label: 'Received', value: formatDateTime(selected.createdAt) },
                  { label: 'Reference', value: selected._id, wide: true },
                ]}
              />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
