import { useCallback, useEffect, useState } from 'react';
import { FiShield } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';
import { authService } from '@/services/authService';
import { socialService, type ActivityLog } from '@/services/socialService';
import { useAuthStore } from '@/store/authStore';
import { formatDateTime } from '@/utils/format';

/** Task C5 — two-factor switch plus this account's access history. */
export default function Security() {
  const { user, setUser } = useAuthStore();
  const [twoFactor, setTwoFactor] = useState(!!user?.twoFactorEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const itemsPerPage = 20;

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await socialService.getActivityLogs({
        userId: user.id,
        page: currentPage,
        limit: itemsPerPage,
      });
      setLogs(res.data || []);
      setPagination(res.pagination);
    } catch (err) {
      console.error('Failed to load access history:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, currentPage]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleTwoFactor = async () => {
    const next = !twoFactor;
    setSaving(true);
    setError('');
    try {
      const res = await authService.setTwoFactor(next);
      setTwoFactor(res.twoFactorEnabled);
      if (user) setUser({ ...user, twoFactorEnabled: res.twoFactorEnabled });
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not update two-factor setting');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Security</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Two-factor login and the access history for your account
        </p>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex gap-3">
            <FiShield className="mt-1 h-5 w-5 text-primary-600" />
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Two-factor login</h2>
              <p className="mt-1 max-w-xl text-sm text-gray-600 dark:text-gray-400">
                When on, signing in with a password stops at an OTP step — the code goes to your
                registered WhatsApp number. Keep that number reachable before switching this on.
              </p>
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={twoFactor}
              disabled={saving}
              onChange={toggleTwoFactor}
              className="h-5 w-5 rounded border-gray-300"
            />
            {twoFactor ? 'On' : 'Off'}
          </label>
        </div>
        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      </Card>

      <Card className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Access history</h2>
          <span className="text-xs sm:text-sm text-gray-500">
            {pagination?.total ?? logs.length} recorded actions
          </span>
        </div>

        {loading ? (
          <div className="py-6 text-center text-gray-500">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="py-6 text-center text-gray-500">No activity recorded yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500">
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2 pr-3">Action</th>
                  <th className="py-2 pr-3">Module</th>
                  <th className="py-2 pr-3">Endpoint</th>
                  <th className="py-2">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap py-2 pr-3">{formatDateTime(log.createdAt)}</td>
                    <td className="py-2 pr-3">{log.action}</td>
                    <td className="py-2 pr-3">{log.entityType}</td>
                    <td className="py-2 pr-3 text-gray-500">
                      {log.httpMethod} {log.endpoint}
                    </td>
                    <td className="py-2 text-gray-500">{log.ipAddress || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="mt-4">
            <Pagination
              currentPage={currentPage}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
