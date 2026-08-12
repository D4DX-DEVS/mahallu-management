/**
 * Mahallu classification (spec 3) and the DEFAULT module feature set each one gets.
 *
 * Classification never hard-gates a module: it only seeds `tenant.settings.features`
 * on create (and when the classification changes). A super admin can toggle any
 * feature for any tenant afterwards.
 */
export type TenantClassification =
  | 'fully_functional'
  | 'partially_functional'
  | 'urban_mosque'
  | 'musalla';

export const TENANT_CLASSIFICATIONS: TenantClassification[] = [
  'fully_functional',
  'partially_functional',
  'urban_mosque',
  'musalla',
];

/** Every gateable module key. Frontend menu + route guards read the same list. */
export const MODULE_KEYS = [
  'families',
  'members',
  'survey',
  'registers',
  'clusters',
  'welfare',
  'loans',
  'education',
  'zakat',
  'finance',
  'committees',
  'programs',
  'mosque',
  'assets',
  'communication',
  'registrations',
  'reports',
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

const all = (value: boolean): Record<string, boolean> =>
  Object.fromEntries(MODULE_KEYS.map((key) => [key, value]));

const withOverrides = (base: boolean, overrides: Partial<Record<ModuleKey, boolean>>) => ({
  ...all(base),
  ...overrides,
});

export const DEFAULT_FEATURES: Record<TenantClassification, Record<string, boolean>> = {
  // Full Mahallu - everything on
  fully_functional: all(true),
  // Same defaults; the admin trims what they do not run
  partially_functional: all(true),
  // Urban mosque - no household survey / welfare / education wings by default
  urban_mosque: withOverrides(true, {
    survey: false,
    registers: false,
    clusters: false,
    welfare: false,
    education: false,
  }),
  // Musalla - minimal prayer-space setup
  musalla: withOverrides(false, {
    members: true,
    programs: true,
    mosque: true,
    finance: true,
    communication: true,
  }),
};

export const defaultFeaturesFor = (classification?: string): Record<string, boolean> =>
  DEFAULT_FEATURES[(classification as TenantClassification) ?? 'fully_functional'] ??
  DEFAULT_FEATURES.fully_functional;
