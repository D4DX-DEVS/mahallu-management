import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { memberPortalService, FamilyMember, MemberOverviewResponse } from '@/services/memberPortalService';
import Card from '@/components/ui/Card';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Pagination from '@/components/ui/Pagination';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

const FAMILY_EDITABLE_FIELDS = ['contactNo', 'wardNumber', 'houseNo', 'area', 'place', 'houseName'];
const MEMBER_EDITABLE_FIELDS = [
  'name',
  'phone',
  'email',
  'education',
  'occupation',
  'maritalStatus',
  'bloodGroup',
  'age',
  'relationship',
];

export default function MemberFamily() {
  const user = useAuthStore((state) => state.user);

  const [overview, setOverview] = useState<MemberOverviewResponse | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Family change modal
  const [familyChangeField, setFamilyChangeField] = useState<string>('');
  const [familyChangeValue, setFamilyChangeValue] = useState('');
  const [familySubmitting, setFamilySubmitting] = useState(false);
  const [familyError, setFamilyError] = useState<string | null>(null);
  const [familySuccess, setFamilySuccess] = useState<string | null>(null);

  // Member change modal
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [memberChangeField, setMemberChangeField] = useState<string>('');
  const [memberChangeValue, setMemberChangeValue] = useState('');
  const [memberSubmitting, setMemberSubmitting] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [memberSuccess, setMemberSuccess] = useState<string | null>(null);

  const limit = 10;

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const overviewData = await memberPortalService.getOverview();
        setOverview(overviewData);

        const familyResult = await memberPortalService.getFamilyMembers(page, limit);
        setMembers(familyResult.data || []);
        const total = familyResult.pagination?.total || 0;
        setTotalItems(total);
        setTotalPages(Math.ceil(total / limit));
      } catch (err: any) {
        setError(loadErrorMessage(err, 'family'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [page]);

  const handleFamilyChange = async () => {
    if (!familyChangeField || !familyChangeValue.trim()) {
      setFamilyError('Please select a field and enter a value');
      return;
    }

    try {
      setFamilySubmitting(true);
      setFamilyError(null);
      await memberPortalService.createChangeRequest({
        targetType: 'family',
        targetId: overview?.family.details?.id || '',
        changes: [{ field: familyChangeField, newValue: familyChangeValue }],
      });
      setFamilySuccess('Change request submitted!');
      setFamilyChangeField('');
      setFamilyChangeValue('');
      setTimeout(() => setFamilySuccess(null), 3000);
    } catch (err: any) {
      setFamilyError(errorMessage(err, { action: 'submit change request' }));
    } finally {
      setFamilySubmitting(false);
    }
  };

  const handleMemberChange = async () => {
    if (!selectedMemberId || !memberChangeField || !memberChangeValue.trim()) {
      setMemberError('Please select a field and enter a value');
      return;
    }

    try {
      setMemberSubmitting(true);
      setMemberError(null);
      await memberPortalService.createChangeRequest({
        targetType: 'member',
        targetId: selectedMemberId,
        changes: [{ field: memberChangeField, newValue: memberChangeValue }],
      });
      setMemberSuccess('Change request submitted!');
      setSelectedMemberId(null);
      setMemberChangeField('');
      setMemberChangeValue('');
      setTimeout(() => setMemberSuccess(null), 3000);
    } catch (err: any) {
      setMemberError(errorMessage(err, { action: 'submit change request' }));
    } finally {
      setMemberSubmitting(false);
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  if (error || !overview) {
    return (
      <div className="flex flex-col items-center justify-center h-screen-content gap-4">
        <p className="text-red-600 dark:text-red-400">{error || 'Unable to load family data'}</p>
      </div>
    );
  }

  const isFamilyHead = overview.member.id === user?.id;

  return (
    <div className="space-y-4 max-w-4xl w-full mx-auto">
      <PageHeader title="My Family" />
      {/* Family Details */}
      {overview.family.details && (
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold mb-3 text-foreground">Family Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {overview.family.details.houseName && (
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">House Name</p>
                    <p className="text-gray-900 dark:text-gray-100 font-medium capitalize">
                      {overview.family.details.houseName}
                    </p>
                  </div>
                )}
                {overview.varusankhyaDetails.familyMahallId && (
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Family ID</p>
                    <p className="text-gray-900 dark:text-gray-100 font-medium">
                      {overview.varusankhyaDetails.familyMahallId}
                    </p>
                  </div>
                )}
                {overview.family.details.area && (
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Area</p>
                    <p className="text-gray-900 dark:text-gray-100 font-medium">
                      {overview.family.details.area}
                    </p>
                  </div>
                )}
                {overview.family.details.place && (
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Place</p>
                    <p className="text-gray-900 dark:text-gray-100 font-medium">
                      {overview.family.details.place}
                    </p>
                  </div>
                )}
                {overview.family.details.contactNo && (
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Contact Number</p>
                    <p className="text-gray-900 dark:text-gray-100 font-medium">
                      {overview.family.details.contactNo}
                    </p>
                  </div>
                )}
                {overview.family.details.id && (
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Ward Number</p>
                    <p className="text-gray-900 dark:text-gray-100 font-medium">
                      {overview.family.details.id}
                    </p>
                  </div>
                )}
              </div>
            </div>
            {isFamilyHead && (
              <button
                onClick={() => setFamilyChangeField(FAMILY_EDITABLE_FIELDS[0])}
                className="text-sm text-primary-600 dark:text-primary-400 hover:underline whitespace-nowrap"
              >
                Request Change →
              </button>
            )}
          </div>

          {/* Family Change Modal */}
          {isFamilyHead && familyChangeField && (
            <div className="mt-4 p-4 border-t border-gray-200 dark:border-gray-800">
              <h3 className="font-semibold mb-3 text-foreground">Request Family Change</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Field to Change
                  </label>
                  <select
                    aria-label="Field to Change"
                    value={familyChangeField}
                    onChange={(e) => setFamilyChangeField(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {FAMILY_EDITABLE_FIELDS.map((field) => (
                      <option key={field} value={field}>
                        {field.replace(/([A-Z])/g, ' $1').trim()}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    New Value
                  </label>
                  <input
                    aria-label="New Value"
                    type="text"
                    value={familyChangeValue}
                    onChange={(e) => setFamilyChangeValue(e.target.value)}
                    placeholder="Enter new value"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {familyError && (
                  <p className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                    {familyError}
                  </p>
                )}
                {familySuccess && (
                  <p className="text-green-600 text-sm bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
                    {familySuccess}
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleFamilyChange}
                    disabled={familySubmitting}
                    className="flex-1 py-2 px-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors"
                  >
                    {familySubmitting ? 'Submitting…' : 'Submit'}
                  </button>
                  <button
                    onClick={() => {
                      setFamilyChangeField('');
                      setFamilyChangeValue('');
                      setFamilyError(null);
                    }}
                    className="py-2 px-4 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Family Members */}
      <Card>
        <h2 className="text-lg font-semibold mb-3 text-foreground">Family Members</h2>

        {members.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No family members found.</p>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <div key={member.id} className="border border-gray-200 dark:border-gray-800 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="font-semibold mb-2 text-foreground capitalize">{member.name}</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      {member.phone && (
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Phone</p>
                          <p className="text-gray-900 dark:text-gray-100">{member.phone}</p>
                        </div>
                      )}
                      {member.gender && (
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Gender</p>
                          <p className="text-gray-900 dark:text-gray-100 capitalize">{member.gender}</p>
                        </div>
                      )}
                      {member.age && (
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Age</p>
                          <p className="text-gray-900 dark:text-gray-100">{member.age} years</p>
                        </div>
                      )}
                      {member.maritalStatus && (
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Marital Status</p>
                          <p className="text-gray-900 dark:text-gray-100">{member.maritalStatus}</p>
                        </div>
                      )}
                      {member.education && (
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Education</p>
                          <p className="text-gray-900 dark:text-gray-100">{member.education}</p>
                        </div>
                      )}
                      {member.occupation && (
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Occupation</p>
                          <p className="text-gray-900 dark:text-gray-100">{member.occupation}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  {isFamilyHead && (
                    <button
                      onClick={() => setSelectedMemberId(member.id)}
                      className="text-sm text-primary-600 dark:text-primary-400 hover:underline whitespace-nowrap"
                    >
                      Request Change →
                    </button>
                  )}
                </div>

                {/* Member Change Modal */}
                {isFamilyHead && selectedMemberId === member.id && (
                  <div className="mt-4 p-4 border-t border-gray-200 dark:border-gray-800">
                    <h4 className="font-semibold mb-3 text-foreground">
                      Request Member Change
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Field to Change
                        </label>
                        <select
                          aria-label="Field to Change"
                          value={memberChangeField}
                          onChange={(e) => setMemberChangeField(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="">Select a field…</option>
                          {MEMBER_EDITABLE_FIELDS.map((field) => (
                            <option key={field} value={field}>
                              {field.replace(/([A-Z])/g, ' $1').trim()}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          New Value
                        </label>
                        <input
                          aria-label="New Value"
                          type="text"
                          value={memberChangeValue}
                          onChange={(e) => setMemberChangeValue(e.target.value)}
                          placeholder="Enter new value"
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>

                      {memberError && (
                        <p className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                          {memberError}
                        </p>
                      )}
                      {memberSuccess && (
                        <p className="text-green-600 text-sm bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
                          {memberSuccess}
                        </p>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={handleMemberChange}
                          disabled={memberSubmitting}
                          className="flex-1 py-2 px-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors"
                        >
                          {memberSubmitting ? 'Submitting…' : 'Submit'}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedMemberId(null);
                            setMemberChangeField('');
                            setMemberChangeValue('');
                            setMemberError(null);
                          }}
                          className="py-2 px-4 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center pt-4 mt-4 border-t border-gray-200 dark:border-gray-800">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={limit}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
