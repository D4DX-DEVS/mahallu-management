import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { memberPortalService, MemberOverviewResponse, ChangeRequest } from '@/services/memberPortalService';
import { authService } from '@/services/authService';
import Card from '@/components/ui/Card';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Pagination from '@/components/ui/Pagination';

const EDITABLE_MEMBER_FIELDS = [
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

export default function MemberProfile() {
  const user = useAuthStore((state) => state.user);

  const [overview, setOverview] = useState<MemberOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Profile edit state
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  // Change request state
  const [changeField, setChangeField] = useState<string>('');
  const [changeValue, setChangeValue] = useState('');
  const [submittingChange, setSubmittingChange] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changeSuccess, setChangeSuccess] = useState<string | null>(null);

  // Phone change OTP state
  const [phoneOtpFlow, setPhoneOtpFlow] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);

  // Change requests list
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [requestsPage, setRequestsPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const requestsLimit = 10;

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const overviewData = await memberPortalService.getOverview();
        setOverview(overviewData);
        setPhone(overviewData.member.phone || '');
        setEmail('');
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    const loadRequests = async () => {
      try {
        setLoadingRequests(true);
        const result = await memberPortalService.getChangeRequests(requestsPage, requestsLimit);
        setChangeRequests(result.data || []);
        const total = result.pagination?.total || 0;
        setTotalItems(total);
        setTotalPages(Math.ceil(total / requestsLimit));
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load change requests');
      } finally {
        setLoadingRequests(false);
      }
    };

    loadRequests();
  }, [requestsPage]);

  const handleUpdateProfile = async () => {
    if (!phone.trim()) {
      setProfileError('Phone is required');
      return;
    }

    try {
      setUpdatingProfile(true);
      setProfileError(null);
      await memberPortalService.updateProfile({ phone, email: email || undefined });
      setProfileSuccess('Profile updated successfully!');
      setTimeout(() => setProfileSuccess(null), 3000);
    } catch (err: any) {
      setProfileError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleSendPhoneOtp = async () => {
    if (!changeValue.trim()) {
      setChangeError('Please enter a new phone number');
      return;
    }
    if (!/^\d{10}$/.test(changeValue)) {
      setChangeError('Phone number must be exactly 10 digits');
      return;
    }

    try {
      setSendingOtp(true);
      setChangeError(null);
      await authService.sendOTP(changeValue);
      setPhoneOtpFlow(true);
      setPhoneOtp('');
      setChangeError(null);
    } catch (err: any) {
      setChangeError(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSubmitChangeRequest = async () => {
    if (!changeField || !changeValue.trim()) {
      setChangeError('Please select a field and enter a value');
      return;
    }

    // For phone field, require OTP
    if (changeField === 'phone') {
      if (!phoneOtpFlow) {
        setChangeError('Please send OTP first');
        return;
      }
      if (!phoneOtp.trim()) {
        setChangeError('Please enter the OTP');
        return;
      }
    }

    try {
      setSubmittingChange(true);
      setChangeError(null);
      const requestData: any = {
        targetType: 'member',
        targetId: user?.id || '',
        changes: [{ field: changeField, newValue: changeValue }],
      };

      // Add OTP to request body for phone changes
      if (changeField === 'phone') {
        requestData.phoneOtp = phoneOtp;
      }

      await memberPortalService.createChangeRequest(requestData);
      setChangeSuccess('Change request submitted successfully!');
      setChangeField('');
      setChangeValue('');
      setPhoneOtpFlow(false);
      setPhoneOtp('');
      setTimeout(() => setChangeSuccess(null), 3000);
      // Refresh requests
      setRequestsPage(1);
    } catch (err: any) {
      setChangeError(err.response?.data?.message || 'Failed to submit change request');
    } finally {
      setSubmittingChange(false);
    }
  };

  if (loading) {
    return (
      <PageSkeleton />
    );
  }

  if (error || !overview) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-140px)] gap-4">
        <p className="text-red-600 dark:text-red-400">{error || 'Unable to load profile'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl w-full mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Profile</h1>

      {/* Current Profile */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Member Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500 dark:text-gray-400">Name</p>
            <p className="text-gray-900 dark:text-gray-100 font-medium">{overview.member.name}</p>
          </div>
          {overview.varusankhyaDetails.memberMahallId && (
            <div>
              <p className="text-gray-500 dark:text-gray-400">Member ID</p>
              <p className="text-gray-900 dark:text-gray-100 font-medium">{overview.varusankhyaDetails.memberMahallId}</p>
            </div>
          )}
          {overview.member.phone && (
            <div>
              <p className="text-gray-500 dark:text-gray-400">Phone</p>
              <p className="text-gray-900 dark:text-gray-100 font-medium">{overview.member.phone}</p>
            </div>
          )}
          {overview.varusankhyaDetails.familyMahallId && (
            <div>
              <p className="text-gray-500 dark:text-gray-400">Family ID</p>
              <p className="text-gray-900 dark:text-gray-100 font-medium">{overview.varusankhyaDetails.familyMahallId}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Edit Profile */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Update Contact Information</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Phone <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {profileError && (
            <p className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              {profileError}
            </p>
          )}
          {profileSuccess && (
            <p className="text-green-600 text-sm bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
              {profileSuccess}
            </p>
          )}

          <button
            onClick={handleUpdateProfile}
            disabled={updatingProfile}
            className="py-2 px-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors"
          >
            {updatingProfile ? 'Updating…' : 'Update Profile'}
          </button>
        </div>
      </Card>

      {/* Request Field Changes */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Request Field Changes</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Request changes to other fields that require admin approval.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Field to Change <span className="text-red-500">*</span>
            </label>
            <select
              value={changeField}
              onChange={(e) => setChangeField(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select a field…</option>
              {EDITABLE_MEMBER_FIELDS.filter((f) => f !== 'phone' && f !== 'email').map((field) => (
                <option key={field} value={field}>
                  {field.replace(/([A-Z])/g, ' $1').trim()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              New Value <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type={changeField === 'phone' ? 'tel' : 'text'}
                value={changeValue}
                onChange={(e) => {
                  setChangeValue(e.target.value);
                  // Reset OTP flow when user changes the value
                  if (changeField === 'phone') {
                    setPhoneOtpFlow(false);
                    setPhoneOtp('');
                  }
                }}
                placeholder="Enter new value"
                maxLength={changeField === 'phone' ? 10 : undefined}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {changeField === 'phone' && !phoneOtpFlow && (
                <button
                  onClick={handleSendPhoneOtp}
                  disabled={sendingOtp || !changeValue.trim()}
                  className="py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors whitespace-nowrap"
                >
                  {sendingOtp ? 'Sending…' : 'Send OTP'}
                </button>
              )}
            </div>
          </div>

          {phoneOtpFlow && changeField === 'phone' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Enter OTP <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={phoneOtp}
                onChange={(e) => setPhoneOtp(e.target.value)}
                placeholder="Enter 6-digit OTP"
                maxLength={6}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          )}

          {changeError && (
            <p className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              {changeError}
            </p>
          )}
          {changeSuccess && (
            <p className="text-green-600 text-sm bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
              {changeSuccess}
            </p>
          )}

          <button
            onClick={handleSubmitChangeRequest}
            disabled={submittingChange}
            className="py-2 px-4 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors"
          >
            {submittingChange ? 'Submitting…' : 'Submit Change Request'}
          </button>
        </div>
      </Card>

      {/* Change Requests History */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Change Request History</h2>
        {loadingRequests ? (
          <PageSkeleton variant="section" />
        ) : changeRequests.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No change requests yet.</p>
        ) : (
          <div className="space-y-3">
            {changeRequests.map((req) => (
              <div
                key={req._id}
                className="border border-gray-200 dark:border-gray-800 rounded-lg p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-2 items-center mb-2">
                      {req.changes.map((change, idx) => (
                        <span key={idx} className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {change.field}: <span className="text-primary-600 dark:text-primary-400">{change.newValue}</span>
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(req.createdAt).toLocaleDateString('en-IN')}
                    </p>
                    {req.remarks && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{req.remarks}</p>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                      req.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : req.status === 'approved'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    }`}
                  >
                    {req.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center pt-4 mt-4 border-t border-gray-200 dark:border-gray-800">
            <Pagination
              currentPage={requestsPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={requestsLimit}
              onPageChange={setRequestsPage}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
