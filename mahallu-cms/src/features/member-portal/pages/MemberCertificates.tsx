import { useEffect, useState } from 'react';
import { memberPortalService, Certificate } from '@/services/memberPortalService';
import Card from '@/components/ui/Card';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Pagination from '@/components/ui/Pagination';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import SortableTh from '@/components/ui/SortableTh';
import { useSortableRows } from '@/hooks/useSortableRows';

export default function MemberCertificates() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const limit = 10;

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await memberPortalService.getCertificates(page, limit);
        setCertificates(result.data || []);
        const total = result.pagination?.total || 0;
        setTotalItems(total);
        setTotalPages(Math.ceil(total / limit));
      } catch (err: any) {
        setError(loadErrorMessage(err, 'certificates'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [page]);

  const handleDownload = async (cert: Certificate) => {
    setDownloading(cert.id);
    try {
      const urlData = await memberPortalService.getCertificateUrl(cert.id);
      window.open(urlData.url, '_blank');
    } catch (err: any) {
      setError(errorMessage(err, { action: 'download certificate' }));
    } finally {
      setDownloading(null);
    }
  };

  const {
    rows: sortedCertificates,
    sort,
    toggleSort,
  } = useSortableRows(certificates);

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6 max-w-4xl w-full mx-auto">
      <PageHeader title="My Certificates" />
      {error && (
        <Card>
          <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        </Card>
      )}

      {certificates.length === 0 ? (
        <Card>
          <div className="text-center py-12 space-y-3">
            <p className="text-gray-500 dark:text-gray-400">No certificates found.</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Certificates will appear here once your requests are approved.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                    <SortableTh sortKey="certificateNo" sort={sort} onSort={toggleSort} className="py-2 pr-4">
                      Certificate Number
                    </SortableTh>
                    <SortableTh sortKey="type" sort={sort} onSort={toggleSort} className="py-2 pr-4">
                      Type
                    </SortableTh>
                    <SortableTh sortKey="issueDate" sort={sort} onSort={toggleSort} className="py-2 pr-4">
                      Issue Date
                    </SortableTh>
                    <SortableTh sortKey="status" sort={sort} onSort={toggleSort} className="py-2 pr-4">
                      Status
                    </SortableTh>
                    <th className="py-2 text-label font-semibold text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCertificates.map((cert, index) => (
                    <tr
                      key={cert.id || index}
                      className="border-b border-gray-100 dark:border-gray-900 text-gray-900 dark:text-gray-100"
                    >
                      <td className="py-3 pr-4 font-medium">{cert.certificateNo}</td>
                      <td className="py-3 pr-4 text-gray-500 dark:text-gray-400">{cert.type}</td>
                      <td className="py-3 pr-4 text-xs text-gray-500 dark:text-gray-400">
                        {new Date(cert.issueDate).toLocaleDateString('en-IN')}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          {cert.status}
                        </span>
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() => handleDownload(cert)}
                          disabled={downloading === cert.id}
                          className="text-xs text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50"
                        >
                          {downloading === cert.id ? 'Downloading…' : 'Download'}
                        </button>
                      </td>
                    </tr>
                  ))}
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
