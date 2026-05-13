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
      const result = await notificationService.getAll({ isRead: false, limit: 1 });
      set({ unreadCount: result.pagination?.total ?? result.data.length });
    } catch {
      set({ unreadCount: 0 });
    }
  },
}));
