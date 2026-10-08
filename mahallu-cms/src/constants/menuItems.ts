import {
  RiPulseLine,
  RiErrorWarningLine,
  RiArchiveLine,
  RiBarChartBoxLine,
  RiNotification3Line,
  RiBook2Line,
  RiBookOpenLine,
  RiBriefcaseLine,
  RiCalendarLine,
  RiBroadcastLine,
  RiClipboardLine,
  RiTimeLine,
  RiBankCardLine,
  RiMoneyDollarCircleLine,
  RiDropLine,
  RiFileLine,
  RiFileReduceLine,
  RiFileAddLine,
  RiFileTextLine,
  RiGiftLine,
  RiLayoutGridLine,
  RiHeartLine,
  RiQuestionLine,
  RiHome5Line,
  RiImageLine,
  RiStackLine,
  RiListCheck,
  RiMap2Line,
  RiChat3Line,
  RiMessage2Line,
  RiIndeterminateCircleLine,
  RiBox3Line,
  RiPieChartLine,
  RiSendPlaneLine,
  RiSettings2Line,
  RiShieldCheckLine,
  RiEmotionLine,
  RiStarLine,
  RiPriceTag3Line,
  RiFocus3Line,
  RiLineChartLine,
  RiUser3Line,
  RiUserFollowLine,
  RiGroupLine,
  RiUserStarLine,
} from 'react-icons/ri';
import type { ModuleKey, SensitiveModuleKey } from './modules';

export interface MenuItem {
  id: string;
  label: string;
  /** Stable workspace section used by the shell to group top-level entries. */
  section?: 'Overview' | 'Community' | 'Services' | 'Finance & reports' | 'Administration';
  icon: React.ComponentType;
  path?: string;
  children?: MenuItem[];
  superAdminOnly?: boolean;
  allowedRoles?: ('super_admin' | 'mahall' | 'survey' | 'institute' | 'member')[];
  /** Hidden when the tenant has this module switched off. Omit = always visible. */
  moduleKey?: ModuleKey;
  /** Hidden unless the user's permissions.sensitiveModules includes this key. */
  sensitiveKey?: SensitiveModuleKey;
  /** CEO decision: hidden for current ERP version, retained for future. Do not delete. */
  hidden?: boolean;
}

/* ===========================================================================
 * Information architecture
 *
 * Two levels, never three. Every destination has exactly one home.
 *
 * What changed and why:
 *
 *  - Registrations appeared twice — under Services and as a top-level group —
 *    with both branches pointing at the same routes. It now appears once.
 *
 *  - Institute finance and Mahallu finance were structurally identical
 *    eleven-item trees, and the one report that differed was called
 *    "Consolidated" on one side and "Combined" on the other. Finance is now a
 *    single group; which set of routes it points at follows the user's role,
 *    so no user is ever shown two parallel accounting trees. Users who can see
 *    both switch scope from the page header, not the menu.
 *
 *  - Reports lived in four places. They now live in one, and financial
 *    statements sit inside Finance where they are operated.
 *
 *  - Depth dropped from four levels to two. Trial Balance was four clicks from
 *    the sidebar; it is now two.
 *
 *  - "Mahall" and "Mahallu" were both used for the product's central noun.
 *    "Mahallu" is now used throughout.
 *
 *  - Wrapper groups that grouped nothing ("Registration Types",
 *    "Institutes & Staff") are gone. So is the "Grouped access" subtitle that
 *    printed under every group, and the top-level Reports section that held a
 *    single item.
 *
 *  - Labels that named nothing ("Individual", "Collection" under
 *    Notifications) now say what they are.
 * ======================================================================== */

const ADMIN_ROLES: MenuItem['allowedRoles'] = ['super_admin', 'mahall'];
const SURVEY_ROLES: MenuItem['allowedRoles'] = ['super_admin', 'mahall', 'survey'];
const INSTITUTE_ROLES: MenuItem['allowedRoles'] = ['super_admin', 'mahall', 'institute'];
const INSTITUTE_ONLY: MenuItem['allowedRoles'] = ['institute'];

export const menuItems: MenuItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    section: 'Overview',
    icon: RiLayoutGridLine,
    path: '/dashboard',
    allowedRoles: ['super_admin', 'mahall', 'survey', 'institute'],
  },

  /* ---------------------------------------------------------------- Member */
  {
    id: 'member-space',
    label: 'My space',
    section: 'Overview',
    icon: RiUserFollowLine,
    allowedRoles: ['member'],
    children: [
      // The "My" prefix is dropped: the group already says whose space this is.
      {
        id: 'member-overview',
        label: 'Dashboard',
        icon: RiLayoutGridLine,
        path: '/member/overview',
        allowedRoles: ['member'],
      },
      {
        id: 'member-profile',
        label: 'Profile',
        icon: RiUser3Line,
        path: '/member/profile',
        allowedRoles: ['member'],
      },
      {
        id: 'member-family',
        label: 'Family',
        icon: RiGroupLine,
        path: '/member/family',
        allowedRoles: ['member'],
      },
      {
        id: 'member-varisangya-portal',
        label: 'Varisangya',
        icon: RiBankCardLine,
        path: '/member/varisangya',
        allowedRoles: ['member'],
      },
      {
        id: 'member-payments',
        label: 'Payments',
        icon: RiMoneyDollarCircleLine,
        path: '/member/payments',
        allowedRoles: ['member'],
      },
      {
        id: 'member-requests',
        label: 'Requests',
        icon: RiClipboardLine,
        path: '/member/requests',
        allowedRoles: ['member'],
      },
      { id: 'member-noc-list', label: 'NOCs', icon: RiFileLine, path: '/member/noc', allowedRoles: ['member'] },
      {
        id: 'member-certificates',
        label: 'Certificates',
        icon: RiFileTextLine,
        path: '/member/certificates',
        allowedRoles: ['member'],
      },
    ],
  },
  {
    id: 'member-apply',
    label: 'Apply',
    section: 'Overview',
    icon: RiFileAddLine,
    allowedRoles: ['member'],
    children: [
      // Imperatives are grouped together, away from the nouns above.
      {
        id: 'member-noc-request',
        label: 'Request an NOC',
        icon: RiFileAddLine,
        path: '/member/noc/request',
        allowedRoles: ['member'],
      },
      {
        id: 'member-nikah-request',
        label: 'Register a nikah',
        icon: RiHeartLine,
        path: '/member/nikah/request',
        allowedRoles: ['member'],
      },
      {
        id: 'member-death-request',
        label: 'Report a death',
        icon: RiErrorWarningLine,
        path: '/member/death/request',
        allowedRoles: ['member'],
      },
    ],
  },

  /* ------------------------------------------------------------- Community */
  {
    id: 'community',
    label: 'Community',
    section: 'Community',
    icon: RiGroupLine,
    children: [
      {
        id: 'families',
        label: 'Families',
        icon: RiHome5Line,
        path: '/families',
        allowedRoles: SURVEY_ROLES,
        moduleKey: 'families',
      },
      {
        id: 'members',
        label: 'Members',
        icon: RiGroupLine,
        path: '/members',
        allowedRoles: SURVEY_ROLES,
        moduleKey: 'members',
      },
      {
        id: 'registers',
        label: 'Registers',
        icon: RiListCheck,
        path: '/registers',
        allowedRoles: SURVEY_ROLES,
        moduleKey: 'registers',
      },
      {
        id: 'survey',
        label: 'Survey',
        icon: RiClipboardLine,
        path: '/survey',
        allowedRoles: SURVEY_ROLES,
        moduleKey: 'survey',
      },
      {
        id: 'locality-facilities',
        label: 'Locality facilities',
        icon: RiMap2Line,
        path: '/survey/facilities',
        allowedRoles: SURVEY_ROLES,
        moduleKey: 'survey',
      },
      {
        id: 'clusters',
        label: 'Clusters',
        icon: RiLayoutGridLine,
        path: '/clusters',
        allowedRoles: SURVEY_ROLES,
        moduleKey: 'clusters',
      },
      {
        id: 'mosque',
        label: 'Mosque',
        icon: RiHome5Line,
        path: '/mosque',
        allowedRoles: ['super_admin', 'mahall', 'survey', 'institute'],
        moduleKey: 'mosque',
      },
      {
        id: 'mahallu-committee',
        label: 'Mahallu committee',
        icon: RiUserStarLine,
        path: '/committees/mahallu',
        allowedRoles: ADMIN_ROLES,
        moduleKey: 'committees',
      },
      {
        id: 'committees',
        label: 'Committees',
        icon: RiGroupLine,
        path: '/committees',
        allowedRoles: ADMIN_ROLES,
        moduleKey: 'committees',
      },
      {
        id: 'meetings',
        label: 'Meetings',
        icon: RiTimeLine,
        path: '/committees/meetings',
        allowedRoles: ADMIN_ROLES,
        moduleKey: 'committees',
      },
      {
        id: 'programs',
        label: 'Programs',
        icon: RiCalendarLine,
        path: '/programs',
        allowedRoles: ADMIN_ROLES,
        moduleKey: 'programs',
      },
      {
        id: 'assets',
        label: 'Assets',
        icon: RiBox3Line,
        path: '/assets',
        allowedRoles: ADMIN_ROLES,
        moduleKey: 'assets',
      },
      {
        id: 'development-projects',
        label: 'Development projects',
        icon: RiFocus3Line,
        path: '/development',
        allowedRoles: ADMIN_ROLES,
        moduleKey: 'development',
      },
    ],
  },

  /* -------------------------------------------------------------- Services */
  {
    id: 'services',
    label: 'Services',
    section: 'Services',
    icon: RiHeartLine,
    children: [
      {
        id: 'welfare-applications',
        label: 'Welfare applications',
        icon: RiFileTextLine,
        path: '/welfare/applications',
        allowedRoles: SURVEY_ROLES,
        moduleKey: 'welfare',
        sensitiveKey: 'welfare',
      },
      {
        id: 'welfare-schemes',
        label: 'Welfare schemes',
        icon: RiGiftLine,
        path: '/welfare/schemes',
        allowedRoles: ADMIN_ROLES,
        moduleKey: 'welfare',
      },
      // Zakat lives here only. It used to be split between its own group and Collections.
      {
        id: 'zakat',
        label: 'Zakat',
        icon: RiGiftLine,
        path: '/zakat',
        allowedRoles: ADMIN_ROLES,
        moduleKey: 'zakat',
      },
      {
        // HIDDEN per CEO decision (Interest-Free Loan & Relief Fund — Qard Hasan) — retained for future, do not delete.
        id: 'qard-hasan',
        label: 'Qard Hasan',
        icon: RiBankCardLine,
        path: '/loans',
        allowedRoles: ADMIN_ROLES,
        moduleKey: 'loans',
        hidden: true,
      },
      {
        id: 'emergency-relief',
        label: 'Emergency relief',
        icon: RiErrorWarningLine,
        path: '/relief',
        allowedRoles: ADMIN_ROLES,
        moduleKey: 'loans',
      },
      {
        // HIDDEN per CEO decision (Employment & Economic Development) — retained for future, do not delete.
        id: 'employment',
        label: 'Employment',
        icon: RiBriefcaseLine,
        path: '/employment/employers',
        allowedRoles: ADMIN_ROLES,
        moduleKey: 'employment',
        hidden: true,
      },
      {
        // HIDDEN per CEO decision (Youth Volunteer Wing / Sevana Vedi + Women's Forum / Vanitha Vedi via volunteer wings) — retained for future, do not delete.
        id: 'volunteers',
        label: 'Volunteers',
        icon: RiGroupLine,
        path: '/volunteers',
        allowedRoles: ADMIN_ROLES,
        moduleKey: 'volunteers',
        hidden: true,
      },
      {
        id: 'health',
        label: 'Health',
        icon: RiDropLine,
        path: '/health/doctors',
        allowedRoles: ADMIN_ROLES,
        moduleKey: 'health',
      },
      {
        // HIDDEN per CEO decision (Islamic Awareness & Religious Services — Khutbah Management) — retained for future, do not delete.
        id: 'religious',
        label: 'Religious services',
        icon: RiCalendarLine,
        path: '/religious/khutbahs',
        allowedRoles: ADMIN_ROLES,
        moduleKey: 'religious',
        hidden: true,
      },
      {
        // HIDDEN per CEO decision (Counselling Services) — retained for future, do not delete.
        id: 'counselling',
        label: 'Counselling',
        icon: RiMessage2Line,
        path: '/counselling',
        allowedRoles: ADMIN_ROLES,
        moduleKey: 'counselling',
        sensitiveKey: 'counselling',
        hidden: true,
      },
      {
        // HIDDEN per CEO decision (Maslahat / Reconciliation Committee) — retained for future, do not delete.
        // Glossed for anyone outside the domain — it sat unexplained beside
        // English labels like "Counselling" and "Inheritance".
        id: 'maslahat',
        label: 'Maslahat (disputes)',
        icon: RiGroupLine,
        path: '/maslahat',
        allowedRoles: ADMIN_ROLES,
        moduleKey: 'maslahat',
        sensitiveKey: 'maslahat',
        hidden: true,
      },
      {
        id: 'inheritance',
        label: 'Inheritance',
        icon: RiStackLine,
        path: '/inheritance',
        allowedRoles: ADMIN_ROLES,
        moduleKey: 'inheritance',
        sensitiveKey: 'inheritance',
      },
      {
        id: 'cemetery',
        label: 'Cemetery',
        icon: RiArchiveLine,
        path: '/cemetery',
        allowedRoles: ADMIN_ROLES,
        moduleKey: 'cemetery',
      },
      {
        // HIDDEN per CEO decision (Mosque Library & Reading Room) — retained for future, do not delete.
        id: 'library',
        label: 'Library',
        icon: RiBook2Line,
        path: '/library/books',
        allowedRoles: ADMIN_ROLES,
        moduleKey: 'library',
        hidden: true,
      },
    ],
  },

  /* --------------------------------------------------------- Registrations */
  {
    id: 'registrations',
    label: 'Registrations',
    section: 'Services',
    icon: RiFileTextLine,
    allowedRoles: ADMIN_ROLES,
    moduleKey: 'registrations',
    children: [
      { id: 'nikah', label: 'Nikah', icon: RiHeartLine, path: '/registrations/nikah', allowedRoles: ADMIN_ROLES },
      {
        id: 'death',
        label: 'Death',
        icon: RiIndeterminateCircleLine,
        path: '/registrations/death',
        allowedRoles: ADMIN_ROLES,
      },
      {
        id: 'common-noc',
        label: 'Common NOC',
        icon: RiFileTextLine,
        path: '/registrations/noc/common',
        allowedRoles: ADMIN_ROLES,
      },
      {
        id: 'nikah-noc',
        label: 'Nikah NOC',
        icon: RiFileAddLine,
        path: '/registrations/noc/nikah',
        allowedRoles: ADMIN_ROLES,
      },
      {
        id: 'marriage-assistance',
        label: 'Marriage assistance',
        icon: RiHeartLine,
        path: '/registrations/marriage-assistance',
        allowedRoles: ADMIN_ROLES,
      },
      {
        id: 'certificates',
        label: 'Certificates',
        icon: RiFileTextLine,
        path: '/admin/certificates',
        allowedRoles: ADMIN_ROLES,
      },
      {
        id: 'change-requests',
        label: 'Change requests',
        icon: RiClipboardLine,
        path: '/admin/change-requests',
        allowedRoles: ADMIN_ROLES,
      },
    ],
  },

  /* ------------------------------------------------------------ Collections
   * The menu said "Collections", the routes said "collectibles" and the code
   * folder said "collectibles". The user-facing name is Collections. */
  {
    id: 'collections',
    label: 'Collections',
    section: 'Finance & reports',
    icon: RiMoneyDollarCircleLine,
    allowedRoles: ADMIN_ROLES,
    children: [
      {
        id: 'all-collections',
        label: 'All collections',
        icon: RiMoneyDollarCircleLine,
        path: '/collections',
        allowedRoles: ADMIN_ROLES,
      },
      {
        id: 'live-dues',
        label: 'Dues',
        icon: RiTimeLine,
        path: '/collectibles/dues',
        allowedRoles: ADMIN_ROLES,
      },
      {
        id: 'varisangya',
        label: 'Varisangyas',
        icon: RiArchiveLine,
        path: '/collectibles/varisangya',
        allowedRoles: ADMIN_ROLES,
      },
      {
        id: 'family-varisangya',
        label: 'Family varisangya',
        icon: RiHome5Line,
        path: '/collectibles/family-varisangya',
        allowedRoles: ADMIN_ROLES,
      },
      {
        id: 'member-varisangya',
        label: 'Member varisangya',
        icon: RiUser3Line,
        path: '/collectibles/member-varisangya',
        allowedRoles: ADMIN_ROLES,
      },
      {
        id: 'zakat-collection',
        label: 'Zakat collection',
        icon: RiGiftLine,
        path: '/collectibles/zakat',
        allowedRoles: ADMIN_ROLES,
      },
    ],
  },

  /* --------------------------------------------------------------- Finance
   * One group. Mahallu admins get the mahallu ledger set; institute users get
   * the institute set at the same labels. Nobody sees two parallel trees, and
   * users who can see both switch scope from the page header. */
  {
    id: 'finance',
    label: 'Finance',
    section: 'Finance & reports',
    icon: RiMoneyDollarCircleLine,
    moduleKey: 'finance',
    children: [
      {
        id: 'fin-accounts',
        label: 'Accounts',
        icon: RiBriefcaseLine,
        path: '/mahallu-finance/accounts',
        allowedRoles: ADMIN_ROLES,
      },
      {
        id: 'fin-ledgers',
        label: 'Ledgers',
        icon: RiBookOpenLine,
        path: '/mahallu-finance/ledgers',
        allowedRoles: ADMIN_ROLES,
      },
      {
        id: 'fin-ledger-items',
        label: 'Ledger items',
        icon: RiFileReduceLine,
        path: '/mahallu-finance/ledger-items',
        allowedRoles: ADMIN_ROLES,
      },
      {
        id: 'fin-categories',
        label: 'Categories',
        icon: RiListCheck,
        path: '/mahallu-finance/categories',
        allowedRoles: ADMIN_ROLES,
      },
      {
        id: 'fin-day-book',
        label: 'Day book',
        icon: RiBookOpenLine,
        path: '/mahallu-finance/day-book',
        allowedRoles: ADMIN_ROLES,
      },
      {
        id: 'fin-trial-balance',
        label: 'Trial balance',
        icon: RiBarChartBoxLine,
        path: '/mahallu-finance/trial-balance',
        allowedRoles: ADMIN_ROLES,
      },
      {
        id: 'fin-balance-sheet',
        label: 'Balance sheet',
        icon: RiFileTextLine,
        path: '/mahallu-finance/balance-sheet',
        allowedRoles: ADMIN_ROLES,
      },
      {
        id: 'fin-ledger-report',
        label: 'Ledger report',
        icon: RiFileTextLine,
        path: '/mahallu-finance/ledger-report',
        allowedRoles: ADMIN_ROLES,
      },
      {
        id: 'fin-income-expenditure',
        label: 'Income and expenditure',
        icon: RiPieChartLine,
        path: '/mahallu-finance/income-expenditure',
        allowedRoles: ADMIN_ROLES,
      },
      // "Consolidated" and "Combined" were two names for the same report.
      {
        id: 'fin-consolidated',
        label: 'Consolidated report',
        icon: RiStackLine,
        path: '/mahallu-finance/combined',
        allowedRoles: ADMIN_ROLES,
      },
      {
        id: 'fin-petty-cash',
        label: 'Petty cash',
        icon: RiMoneyDollarCircleLine,
        path: '/accounting/petty-cash',
        allowedRoles: ADMIN_ROLES,
      },
      {
        id: 'fin-wallets',
        label: 'Wallets',
        icon: RiBankCardLine,
        path: '/master-accounts/wallets',
        allowedRoles: ADMIN_ROLES,
      },

      /* Institute users see the same labels pointing at the institute routes. */
      {
        id: 'fin-i-accounts',
        label: 'Accounts',
        icon: RiBriefcaseLine,
        path: '/master-accounts/institute',
        allowedRoles: INSTITUTE_ONLY,
      },
      {
        id: 'fin-i-ledgers',
        label: 'Ledgers',
        icon: RiBookOpenLine,
        path: '/master-accounts/ledgers',
        allowedRoles: INSTITUTE_ONLY,
      },
      {
        id: 'fin-i-ledger-items',
        label: 'Ledger items',
        icon: RiFileReduceLine,
        path: '/master-accounts/ledger-items',
        allowedRoles: INSTITUTE_ONLY,
      },
      {
        id: 'fin-i-categories',
        label: 'Categories',
        icon: RiListCheck,
        path: '/master-accounts/categories',
        allowedRoles: INSTITUTE_ONLY,
      },
      {
        id: 'fin-i-day-book',
        label: 'Day book',
        icon: RiBookOpenLine,
        path: '/accounting/day-book',
        allowedRoles: INSTITUTE_ONLY,
      },
      {
        id: 'fin-i-trial-balance',
        label: 'Trial balance',
        icon: RiBarChartBoxLine,
        path: '/accounting/trial-balance',
        allowedRoles: INSTITUTE_ONLY,
      },
      {
        id: 'fin-i-balance-sheet',
        label: 'Balance sheet',
        icon: RiFileTextLine,
        path: '/accounting/balance-sheet',
        allowedRoles: INSTITUTE_ONLY,
      },
      {
        id: 'fin-i-ledger-report',
        label: 'Ledger report',
        icon: RiFileTextLine,
        path: '/accounting/ledger-report',
        allowedRoles: INSTITUTE_ONLY,
      },
      {
        id: 'fin-i-income-expenditure',
        label: 'Income and expenditure',
        icon: RiPieChartLine,
        path: '/accounting/income-expenditure',
        allowedRoles: INSTITUTE_ONLY,
      },
      {
        id: 'fin-i-petty-cash',
        label: 'Petty cash',
        icon: RiMoneyDollarCircleLine,
        path: '/accounting/petty-cash',
        allowedRoles: INSTITUTE_ONLY,
      },
    ],
  },

  /* -------------------------------------------------------------- Institute */
  {
    id: 'institute',
    label: 'Institutes',
    section: 'Administration',
    icon: RiBook2Line,
    allowedRoles: INSTITUTE_ROLES,
    children: [
      {
        id: 'institutes',
        label: 'Institutes',
        icon: RiFocus3Line,
        path: '/institutes',
        allowedRoles: INSTITUTE_ROLES,
      },
      { id: 'employees', label: 'Staff', icon: RiUser3Line, path: '/employees', allowedRoles: INSTITUTE_ROLES },
      { id: 'salary', label: 'Salary', icon: RiBankCardLine, path: '/salary', allowedRoles: INSTITUTE_ROLES },
      {
        // HIDDEN per CEO decision (Education Management — Holiday/Weekend Madrasa + Adult Qur'an Learning / madrasa classes) — retained for future, do not delete. Scholarships & Academic Support remain visible.
        id: 'education-classes',
        label: 'Classes and students',
        icon: RiBookOpenLine,
        path: '/education',
        allowedRoles: INSTITUTE_ROLES,
        moduleKey: 'education',
        hidden: true,
      },
      {
        id: 'education-scholarships',
        label: 'Scholarships',
        icon: RiGiftLine,
        path: '/education/scholarships',
        allowedRoles: ADMIN_ROLES,
        moduleKey: 'education',
      },
      {
        id: 'education-support',
        label: 'Academic support',
        icon: RiQuestionLine,
        path: '/education/support',
        allowedRoles: ADMIN_ROLES,
        moduleKey: 'education',
      },
    ],
  },

  /* ---------------------------------------------------------------- Reports
   * One home. These used to be scattered across four groups, with Education
   * Report listed twice pointing at the same route. */
  {
    id: 'reports',
    label: 'Reports',
    section: 'Finance & reports',
    icon: RiBarChartBoxLine,
    moduleKey: 'reports',
    children: [
      {
        id: 'r-demographics',
        label: 'Demographics',
        icon: RiPieChartLine,
        path: '/reports/demographics',
        allowedRoles: SURVEY_ROLES,
      },
      { id: 'r-area', label: 'Area', icon: RiMap2Line, path: '/reports/area', allowedRoles: SURVEY_ROLES },
      {
        id: 'r-blood-bank',
        label: 'Blood bank',
        icon: RiDropLine,
        path: '/reports/blood-bank',
        allowedRoles: SURVEY_ROLES,
      },
      {
        id: 'r-orphans',
        label: 'Orphans',
        icon: RiEmotionLine,
        path: '/reports/orphans',
        allowedRoles: SURVEY_ROLES,
      },
      {
        id: 'r-welfare',
        label: 'Welfare',
        icon: RiHeartLine,
        path: '/reports/welfare',
        allowedRoles: ADMIN_ROLES,
      },
      {
        id: 'r-education',
        label: 'Education',
        icon: RiBookOpenLine,
        path: '/education/report',
        allowedRoles: INSTITUTE_ROLES,
      },
      {
        id: 'r-community',
        label: 'Community',
        icon: RiGroupLine,
        path: '/reports/community',
        allowedRoles: ADMIN_ROLES,
      },
      {
        id: 'r-annual',
        label: 'Annual',
        icon: RiCalendarLine,
        path: '/reports/annual',
        allowedRoles: ADMIN_ROLES,
      },
      {
        id: 'r-development-index',
        label: 'Development index',
        icon: RiLineChartLine,
        path: '/reports/development-index',
        allowedRoles: ADMIN_ROLES,
      },
      {
        id: 'r-data-quality',
        label: 'Data quality',
        icon: RiPulseLine,
        path: '/admin/data-quality',
        allowedRoles: ADMIN_ROLES,
      },
    ],
  },

  /* --------------------------------------------------------- Communication */
  {
    id: 'communication',
    label: 'Communication',
    section: 'Administration',
    icon: RiSendPlaneLine,
    allowedRoles: ADMIN_ROLES,
    children: [
      {
        id: 'announcements',
        label: 'Announcements',
        icon: RiSendPlaneLine,
        path: '/announcements',
        allowedRoles: ADMIN_ROLES,
        moduleKey: 'communication',
      },
      {
        id: 'send-notification',
        label: 'Send a notification',
        icon: RiNotification3Line,
        path: '/notifications/send',
        allowedRoles: ADMIN_ROLES,
      },
      // These two were labelled "Individual" and "Collection", which named nothing.
      {
        id: 'notifications-sent',
        label: 'Notification history',
        icon: RiMessage2Line,
        path: '/notifications/individual',
        allowedRoles: ADMIN_ROLES,
      },
      {
        id: 'notifications-collection',
        label: 'Collection reminders',
        icon: RiChat3Line,
        path: '/notifications/collection',
        allowedRoles: ADMIN_ROLES,
      },
      { id: 'banners', label: 'Banners', icon: RiImageLine, path: '/social/banners', allowedRoles: ADMIN_ROLES },
      { id: 'feeds', label: 'Feeds', icon: RiBroadcastLine, path: '/social/feeds', allowedRoles: ADMIN_ROLES },
      {
        id: 'super-feeds',
        label: 'Super feeds',
        icon: RiStarLine,
        path: '/social/super-feeds',
        allowedRoles: ADMIN_ROLES,
      },
    ],
  },

  /* -------------------------------------------------------- Administration */
  {
    id: 'administration',
    label: 'Administration',
    section: 'Administration',
    icon: RiSettings2Line,
    children: [
      {
        id: 'mahallu-settings',
        label: 'Mahallu settings',
        icon: RiSettings2Line,
        path: '/mahall-main',
        allowedRoles: ADMIN_ROLES,
      },
      // One label, one concept. It used to jam two into "Security & Access History".
      {
        id: 'security-settings',
        label: 'Security',
        icon: RiShieldCheckLine,
        path: '/settings/security',
        allowedRoles: ADMIN_ROLES,
      },
      {
        id: 'mahallu-users',
        label: 'Mahallu users',
        icon: RiUser3Line,
        path: '/users/mahall',
        allowedRoles: ADMIN_ROLES,
      },
      {
        id: 'survey-users',
        label: 'Survey users',
        icon: RiClipboardLine,
        path: '/users/survey',
        allowedRoles: ADMIN_ROLES,
      },
      {
        id: 'institute-users',
        label: 'Institute users',
        icon: RiBook2Line,
        path: '/users/institute',
        allowedRoles: ADMIN_ROLES,
      },
      // Activity logs and support are administration, not social media.
      {
        id: 'activity-logs',
        label: 'Activity logs',
        icon: RiPulseLine,
        path: '/social/activity-logs',
        allowedRoles: ADMIN_ROLES,
      },
      {
        id: 'support',
        label: 'Support tickets',
        icon: RiQuestionLine,
        path: '/social/support',
        allowedRoles: ADMIN_ROLES,
      },
      {
        id: 'assistant',
        label: 'Assistant',
        icon: RiChat3Line,
        path: '/assistant',
        allowedRoles: ADMIN_ROLES,
      },
      { id: 'tenants', label: 'Tenants', icon: RiLayoutGridLine, path: '/admin/tenants', superAdminOnly: true },
      { id: 'all-users', label: 'All users', icon: RiGroupLine, path: '/admin/users', superAdminOnly: true },
      {
        id: 'categories-admin',
        label: 'Categories',
        icon: RiPriceTag3Line,
        path: '/admin/categories',
        superAdminOnly: true,
      },
    ],
  },

];
