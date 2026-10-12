import { create } from 'zustand';
import { notificationService } from '@/services/notificationService';
import { useAuthStore } from '@/store/authStore';
import { canReadNotifications } from '@/utils/apiAccess';

interface NotificationState {
  unreadCount: number;
  fetchUnreadCount: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  fetchUnreadCount: async () => {
    const { user, isSuperAdmin } = useAuthStore.getState();
    // Roles the API does not serve notifications to (member portal accounts) never poll.
    if (!canReadNotifications(user?.role, isSuperAdmin)) return;
    try {
      const result = await notificationService.getAll({ isRead: false, limit: 1 });
      set({ unreadCount: result.pagination?.total ?? result.data.length });
    } catch {
      set({ unreadCount: 0 });
    }
  },
}));
