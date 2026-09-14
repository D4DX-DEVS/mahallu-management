import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import cemeteryService, { Cemetery } from '../../../services/cemeteryService';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import Pagination from '../../../components/ui/Pagination';
import { PageSkeleton } from '@/components/ui/Skeleton';
import ExpandableSearch from '@/components/ui/ExpandableSearch';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';

export function CemeteriesList() {
  const navigate = useNavigate();
  const [cemeteries, setCemeteries] = useState<Cemetery[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const itemsPerPage = 10;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch cemeteries
  useEffect(() => {
    const fetchCemeteries = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await cemeteryService.getAllCemeteries(currentPage, itemsPerPage, debouncedSearch);
        setCemeteries(response.data || []);
        setTotalPages(response.pagination?.totalPages || 1);
        setTotalItems(response.pagination?.total || 0);
      } catch (err: any) {
        setError(loadErrorMessage(err, 'cemeteries'));
        setCemeteries([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCemeteries();
  }, [currentPage, debouncedSearch]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await cemeteryService.deleteCemetery(deleteId);
      setCemeteries(cemeteries.filter((c) => c.id !== deleteId));
      toast.success('Cemetery deleted');
      setConfirmDelete(false);
      setDeleteId(null);
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'delete cemetery' }));
      setConfirmDelete(false);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <PageHeader title="Cemeteries" description="Manage cemetery records and grave allocations" />
        </div>
        <Button
          onClick={() => navigate('/cemetery/create')}
          className="flex items-center gap-2 w-full sm:w-auto justify-center"
        >
          <FiPlus /> Create Cemetery
        </Button>
      </div>

      <div className="w-full">
        <ExpandableSearch
          value={search}
          onChange={(value) => setSearch(value)}
          entity="cemeteries"
        />
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {loading ? (
        <PageSkeleton variant="section" />
      ) : cemeteries.length === 0 ? (
        <div className="text-center py-10">
          <div className="text-gray-500">No cemeteries found</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {cemeteries.map((cemetery) => (
            <Card
              key={cemetery.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/cemetery/${cemetery.id}`)}
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base sm:text-lg font-semibold truncate">{toTitleCase(cemetery.name)}</h3>
                    {cemetery.location && (
                      <p className="text-xs sm:text-sm text-gray-600 truncate mt-1">{toTitleCase(cemetery.location)}</p>
                    )}
                  </div>
                  <span
                    className={`ml-2 px-2 py-1 text-xs font-medium rounded whitespace-nowrap ${
                      cemetery.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {cemetery.status}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-gray-600">Capacity</span>
                    <span className="font-semibold">{cemetery.capacity}</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-gray-600">Used</span>
                    <span className="font-semibold">{cemetery.usedCount || 0}</span>
                  </div>
                  {cemetery.capacity > 0 && (
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-gray-600">Occupancy</span>
                      <span className="font-semibold">
                        {Math.round(((cemetery.usedCount || 0) / cemetery.capacity) * 100)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Occupancy bar */}
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, ((cemetery.usedCount || 0) / cemetery.capacity) * 100)}%`,
                    }}
                  />
                </div>

                <div className="flex gap-2 pt-2 border-t items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 flex items-center justify-center gap-1 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/cemetery/${cemetery.id}/edit`);
                    }}
                  >
                    <FiEdit2 className="w-3 h-3" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 flex items-center justify-center gap-1 text-xs text-red-600 hover:text-red-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(cemetery.id!);
                      setConfirmDelete(true);
                    }} icon={<FiTrash2 />} collapseLabel>Delete</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      )}

      <ConfirmDialog
        isLoading={loading}
        isOpen={confirmDelete}
        title="Delete Cemetery"
        message="Delete this cemetery? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => {
          setConfirmDelete(false);
          setDeleteId(null);
        }}
      />
    </div>
  );
}
