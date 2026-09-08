import { useState, useEffect } from 'react';
import { FiBell, FiCheck, FiMail, FiInbox } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { notificationService, Notification } from '@/services/notificationService';
import { useNotificationStore } from '@/store/notificationStore';
import { formatDate } from '@/utils/format';
import { loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

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

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const stats = [
    { title: 'Total Notifications', value: notifications.length, icon: <FiBell className="h-5 w-5" /> },
    { title: 'Unread', value: unreadCount, icon: <FiInbox className="h-5 w-5" /> },
    { title: 'Read', value: notifications.length - unreadCount, icon: <FiMail className="h-5 w-5" /> },
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>
      </div>

      <Card>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Select
            options={[
              { value: 'all', label: 'All Notifications' },
              { value: 'individual', label: 'Individual' },
              { value: 'collection', label: 'Collection' },
            ]}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full sm:w-48"
          />
        </div>

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchNotifications} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.length === 0 ? (
              <p className="text-center py-12 text-gray-500 dark:text-gray-400">No notifications found</p>
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
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
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
      </Card>
    </div>
  );
}
