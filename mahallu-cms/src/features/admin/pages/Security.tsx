import { useCallback, useEffect, useState } from 'react';
import { FiShield } from 'react-icons/fi';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Table from '@/components/ui/Table';
import { TableColumn } from '@/types';
import Card from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';
import { authService } from '@/services/authService';
import { socialService, type ActivityLog } from '@/services/socialService';
import { useAuthStore } from '@/store/authStore';
import { formatDateTime } from '@/utils/format';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

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
      toast.error(getFriendlyError(err, "Couldn't update two-factor setting. Try again in a moment."));
    } finally {
      setSaving(false);
    }
  };

  const logColumns: TableColumn<ActivityLog>[] = [
    { key: 'createdAt', label: 'When', render: (v) => <span className="whitespace-nowrap">{formatDateTime(v)}</span> },
    { key: 'action', label: 'Action', render: (v) => (v ? <StatusBadge status={String(v)} tone={/delet|remov/i.test(String(v)) ? 'danger' : /creat|add/i.test(String(v)) ? 'success' : /updat|edit|chang/i.test(String(v)) ? 'info' : 'neutral'} dot={false} /> : '—') },
    { key: 'entityType', label: 'Module', render: (v) => (v ? <StatusBadge status={String(v)} tone="neutral" dot={false} /> : '—') },
    {
      key: 'endpoint',
      label: 'Endpoint',
      render: (_v, log) => (
        <span className="inline-flex items-center gap-2 text-[#7B8983] dark:text-surface-muted">
          {log.httpMethod && <StatusBadge status={log.httpMethod} tone={log.httpMethod === 'DELETE' ? 'danger' : log.httpMethod === 'POST' ? 'success' : log.httpMethod === 'GET' ? 'info' : 'warning'} dot={false} size="sm" />}
          {log.endpoint}
        </span>
      ),
    },
    { key: 'ipAddress', label: 'IP', render: (v) => v || '—' },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Security" description="Two-factor login and the access history for your account" />

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex gap-3">
            <span className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[11px] bg-mint text-primary-700 dark:bg-brand-lime/15 dark:text-brand-lime">
              <FiShield className="h-[17px] w-[17px]" />
            </span>
            <div>
              <h2 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text">Two-factor login</h2>
              <p className="mt-0.5 max-w-xl text-xs text-[#5B6963] dark:text-surface-muted">
                When on, signing in with a password stops at an OTP step — the code goes to your
                registered WhatsApp number. Keep that number reachable before switching this on.
              </p>
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-[#3A4741] dark:text-surface-text">
            <input
              type="checkbox"
              checked={twoFactor}
              disabled={saving}
              onChange={toggleTwoFactor}
              className="h-4 w-4 cursor-pointer rounded border-line-strong accent-primary-700 dark:accent-brand-lime"
            />
            {twoFactor ? 'On' : 'Off'}
          </label>
        </div>
        {error && <Alert tone="danger" className="mt-3">{error}</Alert>}
      </Card>

      <Card padding="none" className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-3.5 py-3 dark:border-surface-border">
          <h2 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text">Access history</h2>
          <span className="text-xs font-semibold text-[#7B8983] dark:text-surface-muted">
            {pagination?.total ?? logs.length} recorded actions
          </span>
        </div>

        <div className="p-3.5">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : logs.length === 0 ? (
          <EmptyState title="No activity recorded yet" description="Access events for your account will appear here." />
        ) : (
          <Table columns={logColumns} data={logs} showExport={false} />
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
        </div>
      </Card>
    </div>
  );
}
