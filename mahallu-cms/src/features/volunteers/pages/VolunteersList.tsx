import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { volunteerService, type VolunteerProfile, VOLUNTEER_WINGS } from '@/services/volunteerService';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';

export default function VolunteersList() {
  const navigate = useNavigate();
  const [volunteers, setVolunteers] = useState<VolunteerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [wingFilter, setWingFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchVolunteers = async () => {
      try {
        setLoading(true);
        const result = await volunteerService.getVolunteers({
          page: currentPage,
          limit: itemsPerPage,
          wing: wingFilter || undefined,
          status: statusFilter || undefined,
        });
        setVolunteers(result.data);
        setTotalPages(result.pagination?.totalPages || 1);
      } catch (error) {
        console.error('Failed to fetch volunteers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVolunteers();
  }, [currentPage, itemsPerPage, wingFilter, statusFilter]);

  const handleDelete = useCallback(async (id: string) => {
    if (confirm('Delete this volunteer?')) {
      try {
        await volunteerService.deleteVolunteer(id);
        setVolunteers((prev) => prev.filter((v) => v._id !== id));
      } catch (error) {
        console.error('Failed to delete volunteer:', error);
      }
    }
  }, []);

  const statusColor = (status: string) => {
    return status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
  };

  const volunteerName = (volunteer: VolunteerProfile) => {
    if (volunteer.memberId && typeof volunteer.memberId === 'object') {
      return volunteer.memberId.name;
    }
    return '-';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex-1">
          <div className="flex gap-2 flex-wrap">
            {[
              { value: '', label: 'All Wings' },
              ...VOLUNTEER_WINGS.map((w) => ({ value: w.value, label: w.label })),
            ].map((wing) => (
              <button
                key={wing.value}
                onClick={() => {
                  setWingFilter(wing.value);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  wingFilter === wing.value
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {wing.label}
              </button>
            ))}
          </div>
        </div>
        <Button onClick={() => navigate('/volunteers/create')} className="w-full sm:w-auto">
          + Add Volunteer
        </Button>
      </div>

      {loading ? (
        <Card>
          <div className="p-8 text-center">Loading volunteers...</div>
        </Card>
      ) : volunteers.length === 0 ? (
        <Card>
          <div className="p-8 text-center text-gray-500">
            <p>No volunteers found</p>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {volunteers.map((volunteer) => (
              <Card
                key={volunteer._id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/volunteers/${volunteer._id}`)}
              >
                <div className="p-4 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{volunteerName(volunteer)}</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {volunteer.wings.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(', ')}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${statusColor(
                        volunteer.status
                      )}`}
                    >
                      {volunteer.status}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-600">Service Types:</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {volunteer.serviceTypes.slice(0, 3).map((st) => (
                        <span
                          key={st}
                          className="inline-block bg-blue-50 text-blue-700 px-2 py-1 text-xs rounded"
                        >
                          {st.replace(/_/g, ' ')}
                        </span>
                      ))}
                      {volunteer.serviceTypes.length > 3 && (
                        <span className="text-xs text-gray-500">
                          +{volunteer.serviceTypes.length - 3}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/volunteers/${volunteer._id}/edit`);
                      }}
                      className="flex-1 px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(volunteer._id);
                      }}
                      className="flex-1 px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalPages * itemsPerPage}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </>
      )}
    </div>
  );
}
