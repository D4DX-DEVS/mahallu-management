import { useState, useEffect } from 'react';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import FilterPanel from '@/components/ui/FilterPanel';
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
import StatusBadge from '@/components/ui/StatusBadge';

export default function CertificatesList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [revokeModal, setRevokeModal] = useState<{ open: boolean; id?: string }>({ open: false });
  const [revokeReason, setRevokeReason] = useState('');
  const [revoking, setRevoking] = useState(false);
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchCertificates();
  }, [debouncedSearch, typeFilter, statusFilter, currentPage, itemsPerPage]);

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
    { key: 'certificateNo', label: 'Certificate no.', sortable: true, width: '14rem' },
    { key: 'type', label: 'Type', sortable: true, width: '10rem' },
    { key: 'issueDate', label: 'Issue date', sortable: false, width: '9rem' },
    { key: 'status', label: 'Status', sortable: false, width: '9rem' },
    { key: 'issuedBy', label: 'Issued by', priority: 'secondary', width: '12rem' },
  ];

  const rows = certificates.map((cert) => ({
    certificateNo: cert.certificateNo,
    type: typeLabels[cert.type] || cert.type,
    issueDate: formatDate(cert.issueDate),
    status: <StatusBadge status={cert.status === 'valid' ? 'valid' : 'revoked'} />,
    issuedBy: cert.issuedBy ? toTitleCase(cert.issuedBy) : '-',
  }));

  const activeFilterCount = (typeFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0);
  const isFiltered = Boolean(debouncedSearch) || activeFilterCount > 0;

  return (
    <>
      <PageHeader title="Certificates" description="Manage issued certificates." />

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchEntity="certificates"
          onFilterClick={() => setIsFilterVisible((open) => !open)}
          isFilterVisible={isFilterVisible}
          hasFilters
          activeFilterCount={activeFilterCount}
          onRefresh={fetchCertificates}
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-52">
              <Select
                label="Type"
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                options={[
                  { value: 'all', label: 'All types' },
                  { value: 'nikah', label: 'Nikah' },
                  { value: 'death', label: 'Death' },
                  { value: 'noc', label: 'NOC' },
                ]}
              />
            </div>
            <div className="w-full sm:w-52">
              <Select
                label="Status"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                options={[
                  { value: 'all', label: 'All statuses' },
                  { value: 'valid', label: 'Valid' },
                  { value: 'revoked', label: 'Revoked' },
                ]}
              />
            </div>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                onClick={() => {
                  setTypeFilter('all');
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
            entity="certificates"
            description={error}
            action={{ label: 'Try again', onClick: fetchCertificates }}
          />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={rows}
              isLoading={loading}
              entity="certificates"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? {
                      label: 'Clear filters',
                      onClick: () => {
                        setSearchQuery('');
                        setTypeFilter('all');
                        setStatusFilter('all');
                        setCurrentPage(1);
                      },
                    }
                  : undefined
              }
              onRowClick={(row) => {
                const cert = certificates.find((c) => c.certificateNo === row.certificateNo);
                if (cert) {
                  setSelectedCert(cert);
                  setShowViewModal(true);
                }
              }}
            />

            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="certificates"
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

      {/* View Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedCert(null);
        }}
        title="Certificate Details"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowViewModal(false);
                setSelectedCert(null);
              }}
            >
              Close
            </Button>
            {selectedCert && (
              <Button
                variant="outline"
                onClick={() => handleDownload(selectedCert.id || selectedCert._id || '', selectedCert.certificateNo)}
              >
                Download
              </Button>
            )}
            {selectedCert?.status === 'valid' && (
              <Button
                variant="danger"
                onClick={() => {
                  setShowViewModal(false);
                  handleRevokeClick(selectedCert.id || selectedCert._id || '');
                }}
              >
                Revoke
              </Button>
            )}
          </>
        }
      >
        {selectedCert && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Certificate No.</p>
              <p className="text-gray-900 dark:text-gray-100 font-medium">{selectedCert.certificateNo}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Type</p>
              <p className="text-gray-900 dark:text-gray-100">{typeLabels[selectedCert.type] || selectedCert.type}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Issue Date</p>
              <p className="text-gray-900 dark:text-gray-100">{formatDate(selectedCert.issueDate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
              <p className="text-gray-900 dark:text-gray-100 capitalize">{selectedCert.status}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Issued By</p>
              <p className="text-gray-900 dark:text-gray-100">
                {selectedCert.issuedBy ? toTitleCase(selectedCert.issuedBy) : '—'}
              </p>
            </div>
            {selectedCert.revokedReason && (
              <div className="sm:col-span-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">Revoked Reason</p>
                <p className="text-gray-900 dark:text-gray-100">{selectedCert.revokedReason}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
