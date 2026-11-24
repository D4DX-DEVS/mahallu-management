import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface UserGuideProgress {
  /** The first-login welcome was answered (started or skipped). */
  welcomed: boolean;
  /** Ids of the chapters the user marked as done. */
  done: string[];
  /** Last chapter opened, for "continue where you stopped". */
  last?: string;
}

interface GuideProgressState {
  /** Keyed by user id: two admins sharing one browser keep separate progress. */
  byUser: Record<string, UserGuideProgress>;
  setWelcomed: (userId: string) => void;
  setDone: (userId: string, chapterId: string, done: boolean) => void;
  setLast: (userId: string, chapterId: string) => void;
  reset: (userId: string) => void;
}

const EMPTY: UserGuideProgress = { welcomed: false, done: [] };

const patch = (state: GuideProgressState, userId: string, change: Partial<UserGuideProgress>) => ({
  byUser: { ...state.byUser, [userId]: { ...(state.byUser[userId] ?? EMPTY), ...change } },
});

export const useGuideProgress = create<GuideProgressState>()(
  persist(
    (set) => ({
      byUser: {},
      setWelcomed: (userId) => set((state) => patch(state, userId, { welcomed: true })),
      setDone: (userId, chapterId, done) =>
        set((state) => {
          const current = state.byUser[userId]?.done ?? [];
          const next = done ? [...new Set([...current, chapterId])] : current.filter((id) => id !== chapterId);
          return patch(state, userId, { done: next });
        }),
      setLast: (userId, chapterId) => set((state) => patch(state, userId, { last: chapterId })),
      reset: (userId) => set((state) => patch(state, userId, { done: [], last: undefined })),
    }),
    { name: 'guide-progress', storage: createJSONStorage(() => localStorage) }
  )
);

/** Progress of one user; a stable empty value while nobody is signed in. */
export const useUserGuideProgress = (userId: string | undefined): UserGuideProgress =>
  useGuideProgress((state) => (userId ? state.byUser[userId] : undefined) ?? EMPTY);
