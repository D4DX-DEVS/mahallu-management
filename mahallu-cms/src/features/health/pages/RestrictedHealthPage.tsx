import React, { useState, useEffect } from 'react';
import { FiLock, FiAlertCircle } from 'react-icons/fi';
import { getSensitiveHealthResources, deleteSensitiveHealthResource, IHealthResource } from '@/services/healthService';
import Pagination from '@/components/ui/Pagination';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

interface RestrictedHealthPageProps {
  title: string;
  type: 'palliative_case' | 'patient_support';
  subtitle: string;
}

export default function RestrictedHealthPage({ title, type, subtitle }: RestrictedHealthPageProps) {
  const [resources, setResources] = useState<IHealthResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [accessDenied, setAccessDenied] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const itemsPerPage = 10;

  const fetchResources = async (page: number) => {
    try {
      setLoading(true);
      const response = await getSensitiveHealthResources(page, itemsPerPage, type);
      setResources(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
      setCurrentPage(response.pagination.page);
      setAccessDenied(false);
    } catch (error: any) {
      if (error.response?.status === 403) {
        setAccessDenied(true);
        setResources([]);
      } else {
        console.error('Failed to fetch resources:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResources(1);
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteSensitiveHealthResource(deleteId);
      setConfirmDelete(false);
      setDeleteId(null);
      fetchResources(currentPage);
    } catch (error) {
      console.error('Failed to delete resource:', error);
    }
  };

  const handlePageChange = (page: number) => {
    fetchResources(page);
  };

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  if (accessDenied) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <FiLock className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h1 className="text-2xl font-bold mb-2">{title}</h1>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div className="flex gap-2">
              <FiAlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-amber-800 text-sm">
                Access to sensitive health records requires special permission. Please contact your administrator to request access to {subtitle}.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 sm:p-6 max-w-full">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">{resources.length} records found</p>
        </div>

        <div className="mt-6">
          {resources.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No records found</p>
            </div>
          ) : (
            <>
              <div className="space-y-3 mb-6">
                {resources.map((resource) => (
                  <div key={resource._id} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1">
                        <h3 className="text-base sm:text-lg font-semibold">{resource.name}</h3>
                        <p className="text-xs sm:text-sm text-gray-600 mt-1">
                          Contact: {resource.contactNo}
                        </p>
                        {resource.notes && (
                          <p className="text-xs sm:text-sm text-gray-600 mt-2">{resource.notes}</p>
                        )}
                      </div>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setDeleteId(resource._id);
                          setConfirmDelete(true);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
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
      </div>

      <Modal
        isOpen={confirmDelete}
        title="Delete Record"
        onClose={() => setConfirmDelete(false)}
      >
        <p className="text-gray-700 mb-6">Are you sure you want to delete this record?</p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
