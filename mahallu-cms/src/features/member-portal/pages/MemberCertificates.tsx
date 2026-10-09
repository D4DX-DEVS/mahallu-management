import { useCallback, useEffect, useState } from 'react';
import { memberPortalService, Certificate } from '@/services/memberPortalService';
import TableCard from '@/components/ui/TableCard';
import TableToolbar from '@/components/ui/TableToolbar';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import StatusBadge from '@/components/ui/StatusBadge';
import PageHeader from '@/components/layout/PageHeader';
import { TableColumn } from '@/types';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import { toTitleCase } from '@/utils/format';

export default function MemberCertificates() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await memberPortalService.getCertificates(page, limit);
      setCertificates(result.data || []);
      const total = result.pagination?.total || 0;
      setTotalItems(total);
      setTotalPages(Math.max(1, Math.ceil(total / limit)));
    } catch (err) {
      setError(loadErrorMessage(err, 'certificates'));
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDownload = async (cert: Certificate) => {
    setDownloading(cert.id);
    try {
      const urlData = await memberPortalService.getCertificateUrl(cert.id);
      window.open(urlData.url, '_blank');
    } catch (err) {
      toast.error(errorMessage(err, { action: 'download this certificate' }));
    } finally {
      setDownloading(null);
    }
  };

  const columns: TableColumn<Certificate>[] = [
    {
      key: 'certificateNo',
      label: 'Certificate no.',
      sortable: true,
      width: '16rem',
      render: (v) => <span className="font-medium text-foreground">{v}</span>,
    },
    { key: 'type', label: 'Type', sortable: true, width: '10rem', render: (v) => (v ? toTitleCase(String(v)) : '—') },
    {
      key: 'issueDate',
      label: 'Issue date',
      sortable: true,
      priority: 'secondary',
      width: '10rem',
      render: (v) => new Date(v).toLocaleDateString('en-IN'),
    },
    { key: 'status', label: 'Status', sortable: true, width: '8rem', render: (v) => <StatusBadge status={v} /> },
    {
      key: 'download',
      label: 'Download',
      sortable: false,
      width: '9rem',
      render: (_v, cert) => (
        <button
          type="button"
          onClick={() => handleDownload(cert)}
          disabled={downloading === cert.id}
          className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
        >
          {downloading === cert.id ? 'Downloading…' : 'Download'}
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="My certificates" description="Certificates issued once your requests are approved." />

      <TableCard>
        <TableToolbar onRefresh={load} />

        {error ? (
          <EmptyState variant="error" entity="certificates" description={error} action={{ label: 'Try again', onClick: load }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={certificates}
              isLoading={loading}
              entity="certificates"
              rowKey={(cert, index) => cert.id || String(index)}
            />

            <div className="mt-4">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={limit}
                entity="certificates"
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
    </>
  );
}
