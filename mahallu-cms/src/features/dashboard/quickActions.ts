import type { ComponentType } from 'react';
import { FiHome, FiCreditCard, FiGift, FiFilePlus, FiSend } from 'react-icons/fi';
import type { ModuleKey } from '@/constants/modules';
import { useAuthStore } from '@/store/authStore';
import { useModuleAccess } from '@/hooks/useModuleAccess';

export type Role = 'super_admin' | 'mahall' | 'survey' | 'institute' | 'member';

export interface QuickAction {
  id: string;
  label: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
  roles: Role[];
  moduleKey?: ModuleKey;
  /** extra search words for the command palette */
  keywords?: string[];
}

/** Mirrors the menu: same role lists and module gating as the sidebar entries these shortcuts open. */
export const QUICK_ACTIONS: QuickAction[] = [
  { id: 'new-family', label: 'New family', path: '/families/create', icon: FiHome, roles: ['super_admin', 'mahall', 'survey'], moduleKey: 'families', keywords: ['add', 'register', 'house'] },
  { id: 'record-varisangya', label: 'Record varisangya', path: '/collectibles/varisangya/create', icon: FiCreditCard, roles: ['super_admin', 'mahall'], keywords: ['collect', 'payment', 'receipt'] },
  { id: 'add-zakat', label: 'Add zakat', path: '/collectibles/zakat/create', icon: FiGift, roles: ['super_admin', 'mahall'], keywords: ['collect', 'payment'] },
  { id: 'issue-noc', label: 'Issue NOC', path: '/registrations/noc/create', icon: FiFilePlus, roles: ['super_admin', 'mahall'], moduleKey: 'registrations', keywords: ['certificate'] },
  { id: 'send-notice', label: 'Send notice', path: '/announcements/create', icon: FiSend, roles: ['super_admin', 'mahall'], moduleKey: 'communication', keywords: ['announcement', 'broadcast'] },
];

export function useRole(): Role | null {
  const { user, isSuperAdmin } = useAuthStore();
  return (user?.role || (isSuperAdmin ? 'super_admin' : null)) as Role | null;
}

/** Quick actions the current user may use (role + tenant module gating). */
export function useQuickActions(): QuickAction[] {
  const role = useRole();
  const { isModuleEnabled } = useModuleAccess();
  if (!role) return [];
  return QUICK_ACTIONS.filter((a) => a.roles.includes(role) && isModuleEnabled(a.moduleKey));
}
