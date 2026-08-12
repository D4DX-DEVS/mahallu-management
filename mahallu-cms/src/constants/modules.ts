/**
 * Gateable module keys. Mirrors mahallu-api/src/config/moduleFeatures.ts —
 * keep both lists in sync when adding a module.
 */
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
  'employment',
  'volunteers',
  'health',
  'religious',
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  families: 'Families',
  members: 'Members',
  survey: 'Survey & Demographics',
  registers: 'Community Registers',
  clusters: 'Clusters',
  welfare: 'Welfare',
  loans: 'Qard Hasan & Relief',
  education: 'Education',
  zakat: 'Zakat',
  finance: 'Finance & Accounting',
  committees: 'Committees',
  programs: 'Programs',
  mosque: 'Mosque',
  assets: 'Assets',
  communication: 'Communication',
  registrations: 'Registrations',
  reports: 'Reports',
  employment: 'Employment & Economy',
  volunteers: 'Volunteer Wing',
  health: 'Health & Medical',
  religious: 'Religious Services',
};

export const TENANT_CLASSIFICATIONS = [
  'fully_functional',
  'partially_functional',
  'urban_mosque',
  'musalla',
] as const;

export type TenantClassification = (typeof TENANT_CLASSIFICATIONS)[number];

export const CLASSIFICATION_LABELS: Record<TenantClassification, string> = {
  fully_functional: 'Fully Functional Mahallu',
  partially_functional: 'Partially Functional Mahallu',
  urban_mosque: 'Urban Mosque',
  musalla: 'Musalla / Prayer Space',
};

export const CLASSIFICATION_OPTIONS = TENANT_CLASSIFICATIONS.map((value) => ({
  value,
  label: CLASSIFICATION_LABELS[value],
}));
