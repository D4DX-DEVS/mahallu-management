import { useState, useEffect } from 'react';
import { FiBell, FiCheck, FiMail, FiInbox } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { notificationService, Notification } from '@/services/notificationService';
import { useNotificationStore } from '@/store/notificationStore';
import { formatDate } from '@/utils/format';
import { shareViz, waitingViz } from '@/utils/statSeries';
import { getFriendlyError } from '@/utils/apiMessages';

export default function NotificationsList() {
  const [typeFilter, setTypeFilter] = useState('all');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { fetchUnreadCount } = useNotificationStore();

  useEffect(() => {
    fetchNotifications();
  }, [typeFilter]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {};
      if (typeFilter !== 'all') {
        params.recipientType = typeFilter;
      }
      const result = await notificationService.getAll(params);
      setNotifications(result.data || []);
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load notifications. Refresh the page or try again."));
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

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const stats = [
    { title: 'Total Notifications', value: notifications.length, icon: <FiBell className="h-[17px] w-[17px]" />, tone: 'green' as const, viz: notifications.length > 0 ? { type: 'segments' as const, segments: [{ value: notifications.length - unreadCount }, { value: unreadCount, color: '#FDD817' }] } : undefined, summary: `${notifications.length} notifications, ${unreadCount} unread`, },
    { title: 'Unread', value: unreadCount, icon: <FiInbox className="h-[17px] w-[17px]" />, tone: 'gold' as const, viz: waitingViz(unreadCount), summary: `${unreadCount} unread notifications`, },
    { title: 'Read', value: notifications.length - unreadCount, icon: <FiMail className="h-[17px] w-[17px]" />, tone: 'neutral' as const, viz: shareViz(notifications.length - unreadCount, notifications.length), summary: `${notifications.length - unreadCount} of ${notifications.length} notifications read`, },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notifications"
        description="Manage notifications"
        actions={
          unreadCount > 0 && (
            <Button onClick={handleMarkAllAsRead} variant="secondary">
              <FiCheck className="h-3.5 w-3.5" />
              Mark all as read
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((stat, index) => (
          <StatCard key={index} variant="inline" {...stat} />
        ))}
      </div>

      <Card padding="none" className="overflow-visible">
        <FilterBar>
          <div className="w-48">
            <Select
              options={[
                { value: 'all', label: 'All Notifications' },
                { value: 'individual', label: 'Individual' },
                { value: 'collection', label: 'Collection' },
              ]}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            />
          </div>
        </FilterBar>

        <div className="p-3.5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <p className="text-red-600 dark:text-red-400">{error}</p>
              <Button onClick={fetchNotifications} className="mt-4" variant="outline">
                Retry
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.length === 0 ? (
                <EmptyState title="No notifications found" description="Notifications you send or receive will appear here." />
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`rounded-xl border p-3.5 ${
                      notification.isRead
                        ? 'border-line bg-[#F9FBFA] dark:border-surface-border dark:bg-surface-raised'
                        : 'border-mint-deep bg-mint dark:border-brand-lime/20 dark:bg-brand-lime/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <FiBell className="h-3.5 w-3.5 text-[#7B8983]" aria-hidden="true" />
                          <h3 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">{notification.title}</h3>
                          {!notification.isRead && (
                            <Badge variant="solid" size="sm">
                              New
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-[13px] text-[#3A4741] dark:text-surface-text/80">{notification.message}</p>
                        {notification.imageUrl && (
                          <img
                            src={notification.imageUrl}
                            alt="Notification"
                            className="mt-2 h-24 w-auto max-w-xs rounded-xl border border-line object-cover dark:border-surface-border"
                          />
                        )}
                        <p className="mt-2 text-xs text-[#7B8983] dark:text-surface-muted">
                          {formatDate(notification.createdAt)}
                        </p>
                      </div>
                      {!notification.isRead && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleMarkAsRead(notification.id)}
                        >
                          <FiCheck className="h-3 w-3" />
                          Mark Read
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
