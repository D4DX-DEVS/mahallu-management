import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiDownload, FiTrash2 } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Table from '@/components/ui/Table';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import Modal from '@/components/ui/Modal';
import { toast } from '@/store/toastStore';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { registrationService, Certificate } from '@/services/registrationService';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate, toTitleCase } from '@/utils/format';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

export default function CertificatesList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [revokeModal, setRevokeModal] = useState<{ open: boolean; id?: string }>({ open: false });
  const [revokeReason, setRevokeReason] = useState('');
  const [revoking, setRevoking] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchCertificates();
  }, [debouncedSearch, typeFilter, statusFilter, currentPage]);

  const fetchCertificates = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {
        page: currentPage,
        limit: itemsPerPage,
      };
      if (debouncedSearch) {
        params.search = debouncedSearch;
      }
      if (typeFilter !== 'all') {
        params.type = typeFilter;
      }
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const result = await registrationService.getCertificates(params);
      setCertificates(result.data);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err: any) {
      setError(loadErrorMessage(err, 'certificates'));
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (id: string, certificateNo: string) => {
    try {
      const data = await registrationService.getCertificateUrl(id);
      const link = document.createElement('a');
      link.href = data.url;
      link.download = data.fileName || `certificate-${certificateNo}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Certificate downloaded');
    } catch (err: any) {
      toast.error("Couldn't download certificate. Please try again.");
    }
  };

  const handleRevokeClick = (id: string) => {
    setRevokeModal({ open: true, id });
    setRevokeReason('');
  };

  const handleRevoke = async () => {
    if (!revokeModal.id || !revokeReason.trim()) {
      toast.error('Please enter a reason for revoking this.');
      return;
    }

    try {
      setRevoking(true);
      await registrationService.revokeCertificate(revokeModal.id, revokeReason);
      toast.success('Certificate revoked');
      setRevokeModal({ open: false });
      await fetchCertificates();
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'revoke certificate' }));
    } finally {
      setRevoking(false);
    }
  };

  const typeLabels: Record<string, string> = {
    nikah: 'Nikah',
    death: 'Death',
    noc: 'NOC',
  };

  const columns: TableColumn[] = [
    { key: 'certificateNo', label: 'Certificate No.' },
    { key: 'type', label: 'Type' },
    { key: 'issueDate', label: 'Issue Date' },
    { key: 'status', label: 'Status' },
    { key: 'issuedBy', label: 'Issued By' },
    { key: 'actions', label: 'Actions' },
  ];

  const rows = certificates.map((cert) => ({
    certificateNo: cert.certificateNo,
    type: typeLabels[cert.type] || cert.type,
    issueDate: formatDate(cert.issueDate),
    status: (
      <span
        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
          cert.status === 'valid'
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
        }`}
      >
        {cert.status === 'valid' ? 'Valid' : 'Revoked'}
      </span>
    ),
    issuedBy: cert.issuedBy ? toTitleCase(cert.issuedBy) : '-',
    actions: (
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleDownload(cert.id || cert._id || '', cert.certificateNo)}
          title="Download"
        >
          <FiDownload className="h-4 w-4" />
        </Button>
        {cert.status === 'valid' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleRevokeClick(cert.id || cert._id || '')}
            title="Revoke"
          >
            <FiTrash2 className="h-4 w-4 text-red-600" />
          </Button>
        )}
      </div>
    ),
  }));

  return (
    <div className="space-y-4">
      <PageHeader description="Manage issued certificates" title="Certificates" />

      <div className="flex items-center justify-between"></div>

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onFilterClick={() => setIsFilterVisible(!isFilterVisible)}
        />

        {isFilterVisible && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Type"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              options={[
                { value: 'all', label: 'All Types' },
                { value: 'nikah', label: 'Nikah' },
                { value: 'death', label: 'Death' },
                { value: 'noc', label: 'NOC' },
              ]}
            />
            <Select
              label="Status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'valid', label: 'Valid' },
                { value: 'revoked', label: 'Revoked' },
              ]}
            />
          </div>
        )}

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        ) : certificates.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">No certificates found</p>
          </div>
        ) : (
          <>
            <Table fixedLayout striped columns={columns} data={rows} />
            {pagination && (
              <Pagination
                currentPage={currentPage}
                totalPages={pagination.totalPages || Math.ceil(pagination.total / itemsPerPage)}
                totalItems={pagination.total}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
              />
            )}
          </>
        )}
      </TableCard>

      {/* Revoke Modal */}
      <Modal
        isOpen={revokeModal.open}
        onClose={() => setRevokeModal({ open: false })}
        title="Revoke Certificate"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Revocation Reason
            </label>
            <textarea
              aria-label="Revocation Reason"
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
              rows={4}
              placeholder="Enter the reason for revocation..."
            />
          </div>
          <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-3">
            <Button variant="outline" onClick={() => setRevokeModal({ open: false })} disabled={revoking}>
              Cancel
            </Button>
            <Button onClick={handleRevoke} isLoading={revoking} className="bg-red-600 hover:bg-red-700">
              Revoke Certificate
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
