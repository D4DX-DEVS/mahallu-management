import { useState, useEffect } from 'react';
import { FiBell, FiCheck, FiMail, FiInbox } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Pagination from '@/components/ui/Pagination';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { notificationService, Notification } from '@/services/notificationService';
import { useNotificationStore } from '@/store/notificationStore';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/utils/format';
import { loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { Pagination as PaginationType } from '@/types';

export default function NotificationsList() {
  const [typeFilter, setTypeFilter] = useState('all');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  /* Unread across every page of the current filter (server total); null until known, then the page's own count is used. */
  const [unreadTotal, setUnreadTotal] = useState<number | null>(null);
  const { fetchUnreadCount } = useNotificationStore();
  const currentUserId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    fetchNotifications();
  }, [typeFilter, currentPage]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      // The API caps and defaults `limit` server-side (10 per page) — without
      // an explicit page/limit here, and without showing pagination, the list
      // silently stuck at the 10 most recent notifications forever.
      const params: any = { page: currentPage, limit: 20 };
      if (typeFilter !== 'all') {
        params.recipientType = typeFilter;
      }
      const result = await notificationService.getAll(params);
      const fetched = result.data || [];
      setNotifications(fetched);
      setPagination(result.pagination);

      // This list IS the notification detail view — there's no separate
      // per-item screen to open. Waiting for someone to notice the small
      // "Mark Read" button on each row left the header badge stuck long
      // after they had genuinely seen everything on the page.
      //
      // Only auto-mark what's actually addressed to this viewer (their own
      // recipientId, or a tenant-wide broadcast) — the "All" filter's query
      // isn't recipient-scoped, so it can include other people's individual
      // notifications, and this must never mark those read on their behalf.
      const unreadIds = fetched
        .filter((n) => !n.isRead && (n.recipientType === 'all' || n.recipientId === currentUserId))
        .map((n) => n.id);
      if (unreadIds.length > 0) {
        await Promise.allSettled(unreadIds.map((id) => notificationService.markAsRead(id)));
        fetchUnreadCount();
      }

      // The Unread / Read cards must cover every page of this filter, not just the 20 rows loaded. One
      // cheap count request (limit 1) with the same filter; if it fails the cards fall back to the page.
      try {
        const unread = await notificationService.getAll({
          ...(typeFilter !== 'all' ? { recipientType: typeFilter } : {}),
          isRead: false,
          page: 1,
          limit: 1,
        });
        setUnreadTotal(typeof unread.pagination?.total === 'number' ? unread.pagination.total : null);
      } catch {
        setUnreadTotal(null);
      }
    } catch (err: any) {
      setError(loadErrorMessage(err, 'notifications'));
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      await fetchNotifications();
      fetchUnreadCount();
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      await fetchNotifications();
      fetchUnreadCount();
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const totalCount = pagination?.total ?? notifications.length;
  const unreadCount = unreadTotal ?? notifications.filter((n) => !n.isRead).length;

  const stats = [
    {
      title: 'Total Notifications',
      value: totalCount,
      icon: <FiBell className="h-5 w-5" />,
    },
    { title: 'Unread', value: unreadCount, icon: <FiInbox className="h-5 w-5" /> },
    { title: 'Read', value: Math.max(0, totalCount - unreadCount), icon: <FiMail className="h-5 w-5" /> },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {unreadCount > 0 && (
              <Button onClick={handleMarkAllAsRead} variant="outline">
                <FiCheck className="h-4 w-4 mr-2" />
                Mark All as Read
              </Button>
            )}
          </div>
          <PageHeader description="Manage notifications" title="Notifications" />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Select
            options={[
              { value: 'all', label: 'All Notifications' },
              { value: 'individual', label: 'Individual' },
              { value: 'collection', label: 'Collection' },
            ]}
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full sm:w-48"
          />
        </div>

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <EmptyState
            variant="error"
            entity="notifications"
            description={error}
            action={{ label: 'Retry', onClick: fetchNotifications }}
          />
        ) : (
          <div className="space-y-2">
            {notifications.length === 0 ? (
              <p className="text-center py-10 text-gray-500 dark:text-gray-400">No notifications found</p>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border rounded-lg ${
                    notification.isRead
                      ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                      : 'bg-blue-50 dark:bg-blue-900 border-blue-200 dark:border-blue-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <FiBell className="h-4 w-4 text-gray-500" />
                        <h3 className="font-semibold text-foreground">
                          {notification.title}
                        </h3>
                        {!notification.isRead && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-200">
                            New
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{notification.message}</p>
                      {notification.imageUrl && (
                        <img
                          src={notification.imageUrl}
                          alt="Notification"
                          className="mt-2 h-24 w-auto max-w-xs rounded-lg object-cover border border-gray-200 dark:border-gray-700"
                        />
                      )}
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(notification.createdAt)}
                      </p>
                    </div>
                    {!notification.isRead && (
                      <Button variant="outline" size="sm" onClick={() => handleMarkAsRead(notification.id)}>
                        <FiCheck className="h-3 w-3 mr-1" />
                        Mark Read
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="mt-4">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
