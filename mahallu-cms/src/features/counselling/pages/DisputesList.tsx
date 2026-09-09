import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiEye, FiEdit2, FiTrash2, FiLock, FiAlertCircle } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import ExpandableSearch from '@/components/ui/ExpandableSearch';
import Card from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import { getDisputeCases, deleteDisputeCase, IDisputeCase } from '@/services/counsellingService';
import PageHeader from '@/components/layout/PageHeader';
import { errorMessage } from '@/utils/errors';

const TYPES = ['family', 'marriage', 'divorce', 'community', 'inheritance', 'other'];
const STATUSES = ['registered', 'mediation', 'resolved', 'referred', 'closed'];

export default function DisputesList() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<IDisputeCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteCaseName, setDeleteCaseName] = useState<string>('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const itemsPerPage = 10;

  const fetchCases = useCallback(
    async (page: number) => {
      try {
        setLoading(true);
        const response = await getDisputeCases(page, itemsPerPage, selectedType, selectedStatus, search);
        setCases(response.data);
        setTotalPages(response.pagination.totalPages);
        setTotalItems(response.pagination.total);
        setCurrentPage(response.pagination.page);
        setAccessDenied(false);
      } catch (error: any) {
        if (error.response?.status === 403) {
          setAccessDenied(true);
          setCases([]);
        } else {
          console.error("Couldn't load cases:", error);
        }
      } finally {
        setLoading(false);
      }
    },
    [selectedType, selectedStatus, search, itemsPerPage]
  );

  useEffect(() => {
    fetchCases(1);
  }, [selectedType, selectedStatus, search, fetchCases]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await deleteDisputeCase(deleteId);
      setConfirmDelete(false);
      setDeleteId(null);
      setDeleteCaseName('');
      toast.success('Dispute case deleted');
      fetchCases(currentPage);
    } catch (error) {
      console.error("Couldn't delete case:", error);
      toast.error(errorMessage(error, { action: 'delete dispute case' }));
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePageChange = (page: number) => {
    fetchCases(page);
  };

  if (loading) {
    return <div className="p-4 text-center">Loading...</div>;
  }

  if (accessDenied) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <FiLock className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <PageHeader title="Maslahat (Dispute Resolution)" />
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div className="flex gap-2">
              <FiAlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-amber-800 text-sm">
                Access to dispute cases requires special permission. Please contact your administrator to
                request access.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div>
        <PageHeader
          title="Maslahat (disputes)"
          description={`${totalItems} ${totalItems === 1 ? 'case' : 'cases'}`}
        />
        <div className="mb-4 flex gap-4 items-center">
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/maslahat/create')}
            className="flex items-center gap-2" icon={<FiPlus />} collapseLabel>New Case</Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <ExpandableSearch
            value={search}
            onChange={(value) => setSearch(value)}
            entity="cases"
          />
          <select
            aria-label="Filter"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Types</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Statuses</option>
            {STATUSES.map((sts) => (
              <option key={sts} value={sts}>
                {sts.charAt(0).toUpperCase() + sts.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Cases List */}
        {cases.length === 0 ? (
          <Card>
            <div className="text-center py-10">
              <p className="text-gray-500 mb-4">No dispute cases found</p>
              <Button variant="primary" onClick={() => navigate('/maslahat/create')}>
                Create First Case
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <div className="space-y-4 mb-4">
              {cases.map((caseRecord) => (
                <Card key={caseRecord.id}>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-base sm:text-lg font-semibold">{caseRecord.caseNo}</h3>
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                          {caseRecord.type}
                        </span>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            caseRecord.status === 'closed'
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {caseRecord.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">Parties: {(caseRecord.parties ?? []).join(', ')}</p>
                      {caseRecord.mediators && caseRecord.mediators.length > 0 && (
                        <p className="text-sm text-gray-600">Mediators: {caseRecord.mediators.join(', ')}</p>
                      )}
                    </div>
                    <div className="flex gap-2 items-center">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/maslahat/${caseRecord.id}`)}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <FiEye size={16} />
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/maslahat/${caseRecord.id}`)}
                        className="flex items-center gap-2"
                      >
                        <FiEdit2 size={16} />
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setDeleteId(caseRecord.id);
                          setDeleteCaseName(caseRecord.caseNo);
                          setConfirmDelete(true);
                        }}
                        className="flex items-center gap-2"
                      >
                        <FiTrash2 size={16} />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
              />
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete Dispute Case"
        message={`Delete dispute case ${deleteCaseName}?`}
        consequence="This action is irreversible. All mediation records and case details will be permanently deleted."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => {
          setConfirmDelete(false);
          setDeleteId(null);
          setDeleteCaseName('');
        }}
      />
    </div>
  );
}
