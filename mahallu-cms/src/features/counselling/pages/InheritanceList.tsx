import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiEye, FiEdit2, FiTrash2, FiLock, FiAlertCircle } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import { getInheritanceCases, deleteInheritanceCase, IInheritanceCase } from '@/services/counsellingService';

const STATUSES = ['reported', 'documentation', 'referred', 'distributed', 'closed'];

export default function InheritanceList() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<IInheritanceCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteCaseName, setDeleteCaseName] = useState<string>('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const itemsPerPage = 10;

  const fetchCases = useCallback(async (page: number) => {
    try {
      setLoading(true);
      const response = await getInheritanceCases(page, itemsPerPage, selectedStatus, search);
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
        console.error('Failed to fetch cases:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, search, itemsPerPage]);

  useEffect(() => {
    fetchCases(1);
  }, [selectedStatus, search, fetchCases]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await deleteInheritanceCase(deleteId);
      setConfirmDelete(false);
      setDeleteId(null);
      setDeleteCaseName('');
      toast.success('Inheritance case deleted');
      fetchCases(currentPage);
    } catch (error) {
      console.error('Failed to delete case:', error);
      toast.error((error as any).response?.data?.message || 'Failed to delete inheritance case');
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
          <h1 className="text-2xl font-bold mb-2">Inheritance Cases</h1>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div className="flex gap-2">
              <FiAlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-amber-800 text-sm">
                Access to inheritance records requires special permission. Please contact your administrator to request access.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Inheritance Cases</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">{totalItems} cases found</p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/inheritance/create')}
            className="flex items-center gap-2"
          >
            <FiPlus size={18} />
            New Case
          </Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <input
            type="text"
            placeholder="Search cases..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <select
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
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No inheritance cases found</p>
              <Button variant="primary" onClick={() => navigate('/inheritance/create')}>
                Create First Case
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <div className="space-y-4 mb-6">
              {cases.map((caseRecord) => (
                <Card key={caseRecord._id} className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-base sm:text-lg font-semibold">{caseRecord.caseNo}</h3>
                        <span className={`text-xs px-2 py-1 rounded ${
                          caseRecord.status === 'closed'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {caseRecord.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Deceased: {caseRecord.deceasedName || 'Member Record'}
                      </p>
                      <p className="text-sm text-gray-600">
                        Heirs: {caseRecord.heirs.length}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/inheritance/${caseRecord._id}`)}
                        className="flex items-center gap-2"
                      >
                        <FiEye size={16} />
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/inheritance/${caseRecord._id}/edit`)}
                        className="flex items-center gap-2"
                      >
                        <FiEdit2 size={16} />
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setDeleteId(caseRecord._id);
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
        title="Delete Inheritance Case"
        message={`Delete inheritance case ${deleteCaseName}?`}
        consequence="This action is irreversible. All heir information and distribution records will be permanently deleted."
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
