import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus, FiLock, FiAlertCircle } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import ExpandableSearch from '@/components/ui/ExpandableSearch';
import Card from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { toast } from '@/store/toastStore';
import { getCounsellingCases, ICounsellingCase } from '@/services/counsellingService';
import PageHeader from '@/components/layout/PageHeader';
import { loadErrorMessage } from '@/utils/errors';
import { toTitleCase } from '@/utils/format';

const CATEGORIES = ['marriage', 'family', 'adolescent', 'education', 'parenting', 'behaviour', 'career'];
const STATUSES = ['open', 'in_progress', 'follow_up', 'closed'];

export default function CounsellingList() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<ICounsellingCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  const itemsPerPage = 10;

  const fetchCases = useCallback(
    async (page: number) => {
      try {
        setLoading(true);
        const response = await getCounsellingCases(
          page,
          itemsPerPage,
          selectedCategory,
          selectedStatus,
          search
        );
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
          toast.error(loadErrorMessage(error, 'counselling cases'));
        }
      } finally {
        setLoading(false);
      }
    },
    [selectedCategory, selectedStatus, search, itemsPerPage]
  );

  useEffect(() => {
    fetchCases(1);
  }, [selectedCategory, selectedStatus, search, fetchCases]);

  const handlePageChange = (page: number) => {
    fetchCases(page);
  };

  if (loading) {
    return <PageSkeleton />;
  }

  if (accessDenied) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <FiLock className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <PageHeader title="Counselling Cases" />
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div className="flex gap-2">
              <FiAlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-amber-800 text-sm">
                Access to counselling records requires special permission. Please contact your administrator
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
          title="Counselling cases"
          description={`${totalItems} ${totalItems === 1 ? 'case' : 'cases'}`}
        />
        <div className="mb-4 flex gap-4 items-center">
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/counselling/create')}
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
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
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
                {sts.replace(/_/g, ' ').charAt(0).toUpperCase() + sts.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Cases List */}
        {cases.length === 0 ? (
          <Card>
            <div className="text-center py-10">
              <p className="text-gray-500 mb-4">No counselling cases found</p>
              <Button variant="primary" onClick={() => navigate('/counselling/create')}>
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
                  onClick={() => navigate(`/counselling/${caseRecord.id}`)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-base sm:text-lg font-semibold">{caseRecord.caseNo}</h3>
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                        {caseRecord.category}
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          caseRecord.status === 'closed'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {caseRecord.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Counsellor: <span className="font-medium">{toTitleCase(caseRecord.counsellorName)}</span>
                    </p>
                    <p className="text-sm text-gray-600">
                      Client:{' '}
                      {caseRecord.clientName
                        ? toTitleCase(caseRecord.clientName)
                        : caseRecord.clientMemberId
                          ? 'Member ID'
                          : 'Anonymous'}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(caseRecord.appointmentDate).toLocaleDateString()}
                    </p>
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
