import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiLock, FiAlertCircle } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import ExpandableSearch from '@/components/ui/ExpandableSearch';
import Card from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';
import { toast } from '@/store/toastStore';
import { getInheritanceCases, IInheritanceCase } from '@/services/counsellingService';
import PageHeader from '@/components/layout/PageHeader';
import { loadErrorMessage } from '@/utils/errors';
import { toTitleCase } from '@/utils/format';

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

  const itemsPerPage = 10;

  const fetchCases = useCallback(
    async (page: number) => {
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
          console.error("Couldn't load cases:", error);
          toast.error(loadErrorMessage(error, 'inheritance cases'));
        }
      } finally {
        setLoading(false);
      }
    },
    [selectedStatus, search, itemsPerPage]
  );

  useEffect(() => {
    fetchCases(1);
  }, [selectedStatus, search, fetchCases]);

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
          <PageHeader title="Inheritance Cases" />
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div className="flex gap-2">
              <FiAlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-amber-800 text-sm">
                Access to inheritance records requires special permission. Please contact your administrator
                to request access.
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
          title="Inheritance cases"
          description={`${totalItems} ${totalItems === 1 ? 'case' : 'cases'}`}
        />
        <div className="mb-4 flex gap-4 items-center">
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/inheritance/create')}
            className="flex items-center gap-2" icon={<FiPlus />} collapseLabel>New Case</Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <ExpandableSearch
            value={search}
            onChange={(value) => setSearch(value)}
            entity="cases"
          />
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
              <p className="text-gray-500 mb-4">No inheritance cases found</p>
              <Button variant="primary" onClick={() => navigate('/inheritance/create')}>
                Create First Case
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <div className="space-y-4 mb-4">
              {cases.map((caseRecord) => (
                <Card
                  key={caseRecord.id}
                  className="cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() => navigate(`/inheritance/${caseRecord.id}`)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-base sm:text-lg font-semibold">{caseRecord.caseNo}</h3>
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
                    <p className="text-sm text-gray-600">
                      Deceased: {caseRecord.deceasedName ? toTitleCase(caseRecord.deceasedName) : 'Member Record'}
                    </p>
                    <p className="text-sm text-gray-600">Heirs: {(caseRecord.heirs ?? []).length}</p>
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
    </div>
  );
}
