import { 
  FiHome, 
  FiUsers, 
  FiSettings, 
  FiDatabase, 
  FiFileText, 
  FiDollarSign,
  FiShare2,
  FiBarChart2,
  FiBell,
  FiLayers,
  FiShield,
  FiGrid,
  FiClipboard,
  FiBook,
  FiBriefcase,
  FiList,
  FiCreditCard,
  FiBookOpen,
  FiFileMinus,
  FiMessageSquare,
  FiMessageCircle,
  FiMap,
  FiDroplet,
  FiSmile,
  FiPlusSquare,
  FiAlertCircle,
  FiUserCheck,
  FiTarget,
  FiCalendar,
  FiClock,
  FiHeart,
  FiMinusCircle,
  FiFile,
  FiFilePlus,
  FiArchive,
  FiActivity,
  FiGift,
  FiImage,
  FiCast,
  FiStar,
  FiHelpCircle,
  FiUser,
  FiPackage,
  FiSend
} from 'react-icons/fi';
import type { ModuleKey, SensitiveModuleKey } from './modules';
import { communityMenu } from './menu/communityMenu';
import { servicesMenu } from './menu/servicesMenu';

export interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType;
  path?: string;
  children?: MenuItem[];
  superAdminOnly?: boolean;
  allowedRoles?: ('super_admin' | 'mahall' | 'survey' | 'institute' | 'member')[];
  /** Hidden when the tenant has this module switched off. Omit = always visible. */
  moduleKey?: ModuleKey;
  /** Hidden unless the user's permissions.sensitiveModules includes this key (super admin always sees). */
  sensitiveKey?: SensitiveModuleKey;
}

export const menuItems: MenuItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: FiGrid,
    path: '/dashboard',
    allowedRoles: ['super_admin', 'mahall', 'survey', 'institute'],
  },
  {
    id: 'ai-assistant',
    label: 'AI Assistant',
    icon: FiMessageCircle,
    path: '/assistant',
    allowedRoles: ['super_admin', 'mahall'],
  },
  {
    id: 'member-space',
    label: 'My Space',
    icon: FiUserCheck,
    allowedRoles: ['member'],
    children: [
      {
        id: 'member-overview',
        label: 'My Dashboard',
        icon: FiUserCheck,
        path: '/member/overview',
        allowedRoles: ['member'],
      },
      {
        id: 'member-varisangya-portal',
        label: 'My Varisangya',
        icon: FiCreditCard,
        path: '/member/varisangya',
        allowedRoles: ['member'],
      },
      {
        id: 'member-noc-request',
        label: 'Request NOC',
        icon: FiFilePlus,
        path: '/member/noc/request',
        allowedRoles: ['member'],
      },
      {
        id: 'member-noc-list',
        label: 'My NOCs',
        icon: FiFile,
        path: '/member/noc',
        allowedRoles: ['member'],
      },
      {
        id: 'member-payments',
        label: 'My Payments',
        icon: FiDollarSign,
        path: '/member/payments',
        allowedRoles: ['member'],
      },
    ],
  },
  communityMenu,
  servicesMenu,
  {
    id: 'institute-operations',
    label: 'Institute & Finance',
    icon: FiBook,
    children: [
      {
        id: 'education',
        label: 'Institute Management',
        icon: FiBook,
        allowedRoles: ['super_admin', 'mahall', 'institute'],
        children: [
          {
            id: 'institutes-staff',
            label: 'Institutes & Staff',
            icon: FiTarget,
            allowedRoles: ['super_admin', 'mahall', 'institute'],
            children: [
              { id: 'institutes', label: 'Institutes', icon: FiTarget, path: '/institutes', allowedRoles: ['super_admin', 'mahall', 'institute'] },
              { id: 'employees', label: 'Employees', icon: FiUser, path: '/employees', allowedRoles: ['super_admin', 'mahall', 'institute'] },
              { id: 'salary', label: 'Salary', icon: FiCreditCard, path: '/salary', allowedRoles: ['super_admin', 'mahall', 'institute'] },
            ],
          },
          {
            id: 'accounts-setup',
            label: 'Accounts Setup',
            icon: FiBriefcase,
            allowedRoles: ['super_admin', 'mahall', 'institute'],
            children: [
              { id: 'institute-accounts', label: 'Institute Accounts', icon: FiBriefcase, path: '/master-accounts/institute', allowedRoles: ['super_admin', 'mahall', 'institute'] },
              { id: 'categories', label: 'Categories', icon: FiList, path: '/master-accounts/categories', allowedRoles: ['super_admin', 'mahall', 'institute'] },
              { id: 'ledgers', label: 'Ledgers', icon: FiBookOpen, path: '/master-accounts/ledgers', allowedRoles: ['super_admin', 'mahall', 'institute'] },
              { id: 'ledger-items', label: 'Ledger Items', icon: FiFileMinus, path: '/master-accounts/ledger-items', allowedRoles: ['super_admin', 'mahall', 'institute'] },
            ],
          },
          {
            id: 'financial-reports',
            label: 'Financial Reports',
            icon: FiBarChart2,
            allowedRoles: ['super_admin', 'mahall', 'institute'],
            children: [
              { id: 'day-book', label: 'Day Book', icon: FiBookOpen, path: '/accounting/day-book', allowedRoles: ['super_admin', 'mahall', 'institute'] },
              { id: 'trial-balance', label: 'Trial Balance', icon: FiBarChart2, path: '/accounting/trial-balance', allowedRoles: ['super_admin', 'mahall', 'institute'] },
              { id: 'balance-sheet', label: 'Balance Sheet', icon: FiFileText, path: '/accounting/balance-sheet', allowedRoles: ['super_admin', 'mahall', 'institute'] },
              { id: 'ledger-report', label: 'Ledger Report', icon: FiBookOpen, path: '/accounting/ledger-report', allowedRoles: ['super_admin', 'mahall', 'institute'] },
              { id: 'income-expenditure', label: 'Income & Expenditure', icon: FiFileText, path: '/accounting/income-expenditure', allowedRoles: ['super_admin', 'mahall', 'institute'] },
              { id: 'consolidated-report', label: 'Consolidated Report', icon: FiBarChart2, path: '/accounting/consolidated', allowedRoles: ['super_admin', 'mahall'] },
              { id: 'petty-cash', label: 'Petty Cash', icon: FiDollarSign, path: '/accounting/petty-cash', allowedRoles: ['super_admin', 'mahall', 'institute'] },
            ],
          },
        ],
      },
      {
        id: 'wallets',
        label: 'Wallets',
        icon: FiCreditCard,
        path: '/master-accounts/wallets',
        allowedRoles: ['super_admin', 'mahall'],
      },
    ],
  },
  {
    id: 'administration',
    label: 'Administration',
    icon: FiSettings,
    children: [
      {
        id: 'settings',
        label: 'Settings',
        icon: FiSettings,
        allowedRoles: ['super_admin', 'mahall'],
        children: [
          { id: 'mahall-main', label: 'Mahall Settings', icon: FiSettings, path: '/mahall-main', allowedRoles: ['super_admin', 'mahall'] },
          { id: 'security-settings', label: 'Security & Access History', icon: FiShield, path: '/settings/security', allowedRoles: ['super_admin', 'mahall'] },
          {
            id: 'users',
            label: 'User Management',
            icon: FiUsers,
            allowedRoles: ['super_admin', 'mahall'],
            children: [
              { id: 'mahall-users', label: 'Mahall Users', icon: FiUser, path: '/users/mahall', allowedRoles: ['super_admin', 'mahall'] },
              { id: 'survey-users', label: 'Survey Users', icon: FiClipboard, path: '/users/survey', allowedRoles: ['super_admin', 'mahall'] },
              { id: 'institute-users', label: 'Institute Users', icon: FiBook, path: '/users/institute', allowedRoles: ['super_admin', 'mahall'] },
            ],
          },
        ],
      },
      {
        id: 'admin',
        label: 'Super Admin',
        icon: FiShield,
        superAdminOnly: true,
        children: [
          { id: 'tenants', label: 'Tenants Management', icon: FiGrid, path: '/admin/tenants', superAdminOnly: true },
          { id: 'all-users', label: 'All Users', icon: FiUsers, path: '/admin/users', superAdminOnly: true },
        ],
      },
    ],
  },
  {
    id: 'mahallu-finance',
    label: 'Mahallu Finance',
    icon: FiDollarSign,
    allowedRoles: ['super_admin', 'mahall'],
    children: [
      {
        id: 'mahallu-accounts-setup',
        label: 'Accounts Setup',
        icon: FiBriefcase,
        allowedRoles: ['super_admin', 'mahall'],
        children: [
          { id: 'mahallu-bank-accounts', label: 'Mahallu Accounts', icon: FiBriefcase, path: '/mahallu-finance/accounts', allowedRoles: ['super_admin', 'mahall'] },
          { id: 'mahallu-ledgers', label: 'Ledgers', icon: FiBookOpen, path: '/mahallu-finance/ledgers', allowedRoles: ['super_admin', 'mahall'] },
          { id: 'mahallu-ledger-items', label: 'Ledger Items', icon: FiFileMinus, path: '/mahallu-finance/ledger-items', allowedRoles: ['super_admin', 'mahall'] },
          { id: 'mahallu-categories', label: 'Categories', icon: FiList, path: '/mahallu-finance/categories', allowedRoles: ['super_admin', 'mahall'] },
        ],
      },
      {
        id: 'mahallu-reports',
        label: 'Financial Reports',
        icon: FiBarChart2,
        allowedRoles: ['super_admin', 'mahall'],
        children: [
          { id: 'mahallu-day-book', label: 'Day Book', icon: FiBookOpen, path: '/mahallu-finance/day-book', allowedRoles: ['super_admin', 'mahall'] },
          { id: 'mahallu-trial-balance', label: 'Trial Balance', icon: FiBarChart2, path: '/mahallu-finance/trial-balance', allowedRoles: ['super_admin', 'mahall'] },
          { id: 'mahallu-balance-sheet', label: 'Balance Sheet', icon: FiFileText, path: '/mahallu-finance/balance-sheet', allowedRoles: ['super_admin', 'mahall'] },
          { id: 'mahallu-ledger-report', label: 'Ledger Report', icon: FiBookOpen, path: '/mahallu-finance/ledger-report', allowedRoles: ['super_admin', 'mahall'] },
          { id: 'mahallu-income-expenditure', label: 'Income & Expenditure', icon: FiFileText, path: '/mahallu-finance/income-expenditure', allowedRoles: ['super_admin', 'mahall'] },
          { id: 'mahallu-combined', label: 'Combined Report', icon: FiLayers, path: '/mahallu-finance/combined', allowedRoles: ['super_admin', 'mahall'] },
        ],
      },
    ],
  },
];
