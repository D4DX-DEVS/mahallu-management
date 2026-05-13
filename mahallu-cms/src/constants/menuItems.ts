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

export interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType;
  path?: string;
  children?: MenuItem[];
  superAdminOnly?: boolean;
  allowedRoles?: ('super_admin' | 'mahall' | 'survey' | 'institute' | 'member')[];
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

  // Core Data Management - Most Used
  {
    id: 'families',
    label: 'Families',
    icon: FiHome,
    path: '/families',
    allowedRoles: ['super_admin', 'mahall', 'survey'],
  },
  {
    id: 'members',
    label: 'Members',
    icon: FiUsers,
    path: '/members',
    allowedRoles: ['super_admin', 'mahall', 'survey'],
  },
  
  // Financial Management
  {
    id: 'collectibles',
    label: 'Collections',
    icon: FiDollarSign,
    allowedRoles: ['super_admin', 'mahall'],
    children: [
      { id: 'varisangya', label: 'Varisangyas', icon: FiArchive, path: '/collectibles/varisangya', allowedRoles: ['super_admin', 'mahall'] },
      { id: 'family-varisangya', label: 'Family Varisangya', icon: FiHome, path: '/collectibles/family-varisangya', allowedRoles: ['super_admin', 'mahall'] },
      { id: 'member-varisangya', label: 'Member Varisangya', icon: FiUser, path: '/collectibles/member-varisangya', allowedRoles: ['super_admin', 'mahall'] },
      { id: 'zakat', label: 'Zakat', icon: FiGift, path: '/collectibles/zakat', allowedRoles: ['super_admin', 'mahall'] },
      { id: 'all-collections', label: 'All Collections', icon: FiDollarSign, path: '/collections', allowedRoles: ['super_admin', 'mahall'] },
    ],
  },
  
  // Registrations
  {
    id: 'registrations',
    label: 'Registrations',
    icon: FiFileText,
    allowedRoles: ['super_admin', 'mahall'],
    children: [
      { id: 'nikah', label: 'Nikah Registrations', icon: FiHeart, path: '/registrations/nikah', allowedRoles: ['super_admin', 'mahall'] },
      { id: 'death', label: 'Death Registrations', icon: FiMinusCircle, path: '/registrations/death', allowedRoles: ['super_admin', 'mahall'] },
      {
        id: 'noc',
        label: 'N.O.C',
        icon: FiFile,
        allowedRoles: ['super_admin', 'mahall'],
        children: [
          { id: 'common-noc', label: 'Common NOC', icon: FiFileText, path: '/registrations/noc/common', allowedRoles: ['super_admin', 'mahall'] },
          { id: 'nikah-noc', label: 'Nikah NOC', icon: FiFilePlus, path: '/registrations/noc/nikah', allowedRoles: ['super_admin', 'mahall'] },
        ],
      },
    ],
  },
  
  // Programs & Events
  {
    id: 'programs',
    label: 'Programs',
    icon: FiCalendar,
    path: '/programs',
    allowedRoles: ['super_admin', 'mahall'],
  },
  
  // Education & Institute Management
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
        icon: FiLayers,
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
  
  // Committees
  {
    id: 'committees',
    label: 'Committees',
    icon: FiUsers,
    allowedRoles: ['super_admin', 'mahall'],
    children: [
      { id: 'all-committees', label: 'All Committees', icon: FiList, path: '/committees', allowedRoles: ['super_admin', 'mahall'] },
      { id: 'all-meetings', label: 'All Meetings', icon: FiClock, path: '/committees/meetings', allowedRoles: ['super_admin', 'mahall'] },
    ],
  },
  
  // Asset Management
  {
    id: 'assets',
    label: 'Asset Management',
    icon: FiPackage,
    path: '/assets',
    allowedRoles: ['super_admin', 'mahall'],
  },
  
  // Reports
  {
    id: 'reports',
    label: 'Reports',
    icon: FiBarChart2,
    allowedRoles: ['super_admin', 'mahall', 'survey'],
    children: [
      { id: 'area', label: 'Area Report', icon: FiMap, path: '/reports/area', allowedRoles: ['super_admin', 'mahall', 'survey'] },
      { id: 'blood-bank', label: 'Blood Bank Report', icon: FiDroplet, path: '/reports/blood-bank', allowedRoles: ['super_admin', 'mahall', 'survey'] },
      { id: 'orphans', label: 'Orphans Report', icon: FiSmile, path: '/reports/orphans', allowedRoles: ['super_admin', 'mahall', 'survey'] },
    ],
  },
  
  // Notifications
  {
    id: 'notifications',
    label: 'Notifications',
    icon: FiBell,
    allowedRoles: ['super_admin', 'mahall'],
    children: [
      { id: 'send-notification', label: 'Send Notification', icon: FiSend, path: '/notifications/send', allowedRoles: ['super_admin', 'mahall'] },
      { id: 'individual', label: 'Individual', icon: FiMessageSquare, path: '/notifications/individual', allowedRoles: ['super_admin', 'mahall'] },
      { id: 'collection', label: 'Collection', icon: FiMessageCircle, path: '/notifications/collection', allowedRoles: ['super_admin', 'mahall'] },
    ],
  },
  
  // Social Media
  {
    id: 'social',
    label: 'Social Media',
    icon: FiShare2,
    allowedRoles: ['super_admin', 'mahall'],
    children: [
      { id: 'banners', label: 'Banners', icon: FiImage, path: '/social/banners', allowedRoles: ['super_admin', 'mahall'] },
      { id: 'feeds', label: 'Feeds', icon: FiCast, path: '/social/feeds', allowedRoles: ['super_admin', 'mahall'] },
      { id: 'super-feeds', label: 'Super Feeds', icon: FiStar, path: '/social/super-feeds', allowedRoles: ['super_admin', 'mahall'] },
      { id: 'activity-logs', label: 'Activity Logs', icon: FiActivity, path: '/social/activity-logs', allowedRoles: ['super_admin', 'mahall'] },
      { id: 'support', label: 'Support', icon: FiHelpCircle, path: '/social/support', allowedRoles: ['super_admin', 'mahall'] },
    ],
  },
  
  // Wallets (Mahallu-level wallets - separate from institute accounts)
  {
    id: 'wallets',
    label: 'Wallets',
    icon: FiCreditCard,
    path: '/master-accounts/wallets',
    allowedRoles: ['super_admin', 'mahall'],
  },
  
  // Settings & Administration
  {
    id: 'settings',
    label: 'Settings',
    icon: FiSettings,
    allowedRoles: ['super_admin', 'mahall'],
    children: [
      { id: 'mahall-main', label: 'Mahall Settings', icon: FiSettings, path: '/mahall-main', allowedRoles: ['super_admin', 'mahall'] },
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
  
  // Admin Section (Super Admin Only)
  {
    id: 'admin',
    label: 'Admin',
    icon: FiShield,
    superAdminOnly: true,
    children: [
      { id: 'tenants', label: 'Tenants Management', icon: FiGrid, path: '/admin/tenants', superAdminOnly: true },
      { id: 'all-users', label: 'All Users', icon: FiUsers, path: '/admin/users', superAdminOnly: true },
    ],
  },
];
