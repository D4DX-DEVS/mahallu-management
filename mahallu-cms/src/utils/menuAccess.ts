import { MenuItem } from '@/constants/menuItems';
import type { ModuleKey, SensitiveModuleKey } from '@/constants/modules';

export type UserRole = 'super_admin' | 'mahall' | 'survey' | 'institute' | 'member';

/**
 * Shared with Sidebar and CommandPalette so both ever consult one definition
 * of "can this user see this item" — moduleKey/sensitiveKey/allowedRoles are
 * menu-display concerns, not enforced by the router itself.
 */
export function isMenuItemAccessible(
  item: Pick<MenuItem, 'superAdminOnly' | 'sensitiveKey' | 'allowedRoles'>,
  userRole: UserRole | null,
  isSuperAdmin: boolean,
  sensitiveModules: SensitiveModuleKey[]
) {
  if (item.superAdminOnly && !isSuperAdmin) return false;
  if (item.sensitiveKey && !isSuperAdmin && !sensitiveModules.includes(item.sensitiveKey)) return false;
  if (item.allowedRoles && userRole) return item.allowedRoles.includes(userRole);
  return true;
}

export interface FlatMenuItem {
  id: string;
  label: string;
  path: string;
  icon: MenuItem['icon'];
  breadcrumb: string[];
  moduleKey?: ModuleKey;
  sensitiveKey?: SensitiveModuleKey;
  allowedRoles?: MenuItem['allowedRoles'];
  superAdminOnly?: boolean;
  hidden?: boolean;
}

/** Every leaf with a path, depth-first, keeping its full breadcrumb trail. */
export function flattenMenuItems(items: MenuItem[], breadcrumb: string[] = []): FlatMenuItem[] {
  const result: FlatMenuItem[] = [];
  items.forEach((item) => {
    const currentBreadcrumb = [...breadcrumb, item.label];
    if (item.path) {
      result.push({
        id: item.id,
        label: item.label,
        path: item.path,
        icon: item.icon,
        breadcrumb: currentBreadcrumb,
        moduleKey: item.moduleKey,
        sensitiveKey: item.sensitiveKey,
        allowedRoles: item.allowedRoles,
        superAdminOnly: item.superAdminOnly,
        hidden: (item as MenuItem & { hidden?: boolean }).hidden,
      });
    }
    if (item.children) {
      result.push(...flattenMenuItems(item.children, currentBreadcrumb));
    }
  });
  return result;
}
