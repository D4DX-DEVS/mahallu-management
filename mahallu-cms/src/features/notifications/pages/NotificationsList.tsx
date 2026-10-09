import { useState, useEffect } from 'react';
import { FiBell, FiCheck, FiMail, FiInbox } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Tabs from '@/components/ui/Tabs';
import TableToolbar from '@/components/ui/TableToolbar';
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
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  /* Unread across every page of the current filter (server total); null until known, then the page's own count is used. */
  const [unreadTotal, setUnreadTotal] = useState<number | null>(null);
  const { fetchUnreadCount } = useNotificationStore();
  const currentUserId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    fetchNotifications();
  }, [typeFilter, currentPage, itemsPerPage]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      // The API caps and defaults `limit` server-side (10 per page) — without
      // an explicit page/limit here, and without showing pagination, the list
      // silently stuck at the 10 most recent notifications forever.
      const params: any = { page: currentPage, limit: itemsPerPage };
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
    <>
      <PageHeader
        title="Notifications"
        description="Messages sent to you and to the community."
        actions={
          unreadCount > 0 ? (
            <Button variant="outline" icon={<FiCheck />} collapseLabel onClick={handleMarkAllAsRead}>
              Mark all as read
            </Button>
          ) : undefined
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      <TableCard>
        <TableToolbar
          tabs={
            <Tabs
              variant="segmented"
              ariaLabel="Notification type"
              value={typeFilter}
              onChange={(value) => {
                setTypeFilter(value);
                setCurrentPage(1);
              }}
              items={[
                { value: 'all', label: 'All' },
                { value: 'individual', label: 'Individual' },
                { value: 'collection', label: 'Collection' },
              ]}
            />
          }
          onRefresh={fetchNotifications}
        />

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
              <EmptyState entity="notifications" />
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`rounded-lg border p-4 ${
                    notification.isRead ? 'border-border bg-subtle/50' : 'border-primary/25 bg-primary/5'
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
                          <Badge variant="primary">New</Badge>
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
                      <Button variant="outline" size="sm" icon={<FiCheck />} onClick={() => handleMarkAsRead(notification.id)}>
                        Mark read
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {pagination && (
          <div className="mt-4">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              entity="notifications"
              onPageChange={setCurrentPage}
              onItemsPerPageChange={(size) => {
                setItemsPerPage(size);
                setCurrentPage(1);
              }}
            />
          </div>
        )}
      </TableCard>
    </>
  );
}
