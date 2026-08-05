export const ROUTES = {
  // Auth
  LOGIN: '/login',
  
  // Dashboard
  DASHBOARD: '/dashboard',

  // Member Portal
  MEMBER: {
    OVERVIEW: '/member/overview',
    VARISANGYA: '/member/varisangya',
    NOC_REQUEST: '/member/noc/request',
    NOC_LIST: '/member/noc',
    PAYMENTS: '/member/payments',
  },
  
  // Users
  USERS: {
    MAHALL: '/users/mahall',
    SURVEY: '/users/survey',
    INSTITUTE: '/users/institute',
    CREATE_MAHALL: '/users/mahall/create',
    EDIT_MAHALL: (id: string) => `/users/mahall/${id}/edit`,
  },
  
  // Families
  FAMILIES: {
    LIST: '/families',
    CREATE: '/families/create',
    UNAPPROVED: '/families/unapproved',
    DETAIL: (id: string) => `/families/${id}`,
    EDIT: (id: string) => `/families/${id}/edit`,
  },
  
  // Members
  MEMBERS: {
    LIST: '/members',
    CREATE: '/members/create',
    DETAIL: (id: string) => `/members/${id}`,
    EDIT: (id: string) => `/members/${id}/edit`,
  },
  
  // Institutes
  INSTITUTES: {
    LIST: '/institutes',
    CREATE: '/institutes/create',
    DETAIL: (id: string) => `/institutes/${id}`,
  },
  
  // Programs
  PROGRAMS: {
    LIST: '/programs',
    CREATE: '/programs/create',
    DETAIL: (id: string) => `/programs/${id}`,
  },
  
  // Employees
  EMPLOYEES: {
    LIST: '/employees',
    CREATE: '/employees/create',
    DETAIL: (id: string) => `/employees/${id}`,
    EDIT: (id: string) => `/employees/${id}/edit`,
  },
  
  // Salary
  SALARY: {
    LIST: '/salary',
    CREATE: '/salary/create',
    DETAIL: (id: string) => `/salary/${id}`,
    SUMMARY: '/salary/summary',
  },
  
  // Accounting Reports
  ACCOUNTING: {
    DAY_BOOK: '/accounting/day-book',
    TRIAL_BALANCE: '/accounting/trial-balance',
    BALANCE_SHEET: '/accounting/balance-sheet',
    LEDGER_REPORT: '/accounting/ledger-report',
    INCOME_EXPENDITURE: '/accounting/income-expenditure',
    CONSOLIDATED: '/accounting/consolidated',
    PETTY_CASH: '/accounting/petty-cash',
    PETTY_CASH_DETAIL: (id: string) => `/petty-cash/${id}`,
  },
  
  // Committees
  COMMITTEES: {
    LIST: '/committees',
    MEETINGS: '/committees/meetings',
    DETAIL: (id: string) => `/committees/${id}`,
  },
  
  // Registrations
  REGISTRATIONS: {
    NIKAH: '/registrations/nikah',
    DEATH: '/registrations/death',
    NOC: {
      COMMON: '/registrations/noc/common',
      NIKAH: '/registrations/noc/nikah',
    },
  },
  
  // Collectibles
  COLLECTIBLES: {
    OVERVIEW: '/collections',
    VARISANGYA: '/collectibles/varisangya',
    FAMILY_VARISANGYA: {
      BASE: '/collectibles/family-varisangya',
      LIST: '/collectibles/family-varisangya',
      TRANSACTIONS: '/collectibles/family-varisangya',
      WALLET: '/collectibles/family-varisangya',
    },
    MEMBER_VARISANGYA: {
      BASE: '/collectibles/member-varisangya',
      LIST: '/collectibles/member-varisangya',
      TRANSACTIONS: '/collectibles/member-varisangya',
      WALLET: '/collectibles/member-varisangya',
    },
    ZAKAT: '/collectibles/zakat',
    DUES: '/collectibles/dues',
  },
  
  // Social
  SOCIAL: {
    BANNERS: '/social/banners',
    CREATE_BANNER: '/social/banners/create',
    EDIT_BANNER: '/social/banners/:id/edit',
    FEEDS: '/social/feeds',
    SUPER_FEEDS: '/social/super-feeds',
    ACTIVITY_LOGS: '/social/activity-logs',
    SUPPORT: '/social/support',
  },
  
  // Master Accounts
  MASTER_ACCOUNTS: {
    INSTITUTE_ACCOUNTS: '/master-accounts/institute',
    CATEGORIES: '/master-accounts/categories',
    WALLETS: '/master-accounts/wallets',
    LEDGERS: '/master-accounts/ledgers',
    LEDGER_ITEMS: '/master-accounts/ledger-items',
  },

  // Mahallu Finance
  MAHALLU_FINANCE: {
    ACCOUNTS: '/mahallu-finance/accounts',
    ACCOUNTS_CREATE: '/mahallu-finance/accounts/create',
    ACCOUNTS_EDIT: (id: string) => `/mahallu-finance/accounts/${id}/edit`,
    LEDGERS: '/mahallu-finance/ledgers',
    LEDGERS_CREATE: '/mahallu-finance/ledgers/create',
    LEDGERS_EDIT: (id: string) => `/mahallu-finance/ledgers/${id}/edit`,
    LEDGER_ITEMS: '/mahallu-finance/ledger-items',
    LEDGER_ITEMS_CREATE: '/mahallu-finance/ledger-items/create',
    CATEGORIES: '/mahallu-finance/categories',
    CATEGORIES_CREATE: '/mahallu-finance/categories/create',
    CATEGORIES_EDIT: (id: string) => `/mahallu-finance/categories/${id}/edit`,
    DAY_BOOK: '/mahallu-finance/day-book',
    TRIAL_BALANCE: '/mahallu-finance/trial-balance',
    BALANCE_SHEET: '/mahallu-finance/balance-sheet',
    LEDGER_REPORT: '/mahallu-finance/ledger-report',
    INCOME_EXPENDITURE: '/mahallu-finance/income-expenditure',
    COMBINED: '/mahallu-finance/combined',
  },
  
  // Notifications
  NOTIFICATIONS: {
    INDIVIDUAL: '/notifications/individual',
    COLLECTION: '/notifications/collection',
    SEND: '/notifications/send',
  },
  
  // Reports
  REPORTS: {
    AREA: '/reports/area',
    BLOOD_BANK: '/reports/blood-bank',
    ORPHANS: '/reports/orphans',
  },
  
  // Mahall Main
  MAHALL_MAIN: '/mahall-main',
  
  // Assets
  ASSETS: {
    LIST: '/assets',
    CREATE: '/assets/create',
    DETAIL: (id: string) => `/assets/${id}`,
    EDIT: (id: string) => `/assets/${id}/edit`,
  },
} as const;

