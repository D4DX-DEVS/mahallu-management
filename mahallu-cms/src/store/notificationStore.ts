import { create } from 'zustand';
import { notificationService } from '@/services/notificationService';

interface NotificationState {
  unreadCount: number;
  fetchUnreadCount: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  fetchUnreadCount: async () => {
    try {
      // Without recipientType: 'individual', the backend counts every unread
      // notification in the tenant, not just this user's own + broadcast ones
      // — the bell badge included notifications addressed to other people
      // that this user has no way to act on.
      const result = await notificationService.getAll({
        isRead: false,
        limit: 1,
        recipientType: 'individual',
      });
      set({ unreadCount: result.pagination?.total ?? result.data.length });
    } catch {
      set({ unreadCount: 0 });
    }
  },
}));
