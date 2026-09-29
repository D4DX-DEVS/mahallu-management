import { TableColumn } from '@/types';

export interface RegisterConfig {
  key: string;
  title: string;
  description: string;
  source: 'member' | 'family';
  /** Extra query params exposed as filters on the page. */
  filters?: Array<{ name: string; label: string; options: Array<{ value: string; label: string }> }>;
}

/*
 * Name/House Name leads: Table uses a mobile card's first data column as its
 * title, so with "No." first every card on a phone read as "1", "2", "3…"
 * instead of the person it was actually about. Family/contact stay at
 * `primary` priority (Table's default) so they still appear on the mobile
 * card as compact secondary fields; age/gender and the row number are the
 * least useful for picking someone out at a glance, so they drop to
 * `secondary`/`tertiary` and only reappear at tablet/desktop widths — the
 * data itself, and the desktop table's columns, are unchanged either way.
 */
const memberColumns: TableColumn<any>[] = [
  { key: 'name', label: 'Name' },
  { key: 'familyName', label: 'Family' },
  { key: 'phone', label: 'Phone', render: (v) => v || '—' },
  { key: 'age', label: 'Age', priority: 'secondary', render: (v) => v ?? '—' },
  { key: 'gender', label: 'Gender', priority: 'secondary', render: (v) => v || '—' },
  { key: 'index', label: 'No.', priority: 'tertiary', render: (_v, _r, index) => (index ?? 0) + 1 },
];

const familyColumns: TableColumn<any>[] = [
  { key: 'houseName', label: 'House Name' },
  { key: 'familyHead', label: 'Family Head', render: (v) => v || '—' },
  { key: 'contactNo', label: 'Contact', render: (v) => v || '—' },
  { key: 'area', label: 'Area', priority: 'secondary', render: (v) => v || '—' },
  { key: 'welfareStatus', label: 'Welfare', priority: 'secondary', render: (v) => v || '—' },
  { key: 'index', label: 'No.', priority: 'tertiary', render: (_v, _r, index) => (index ?? 0) + 1 },
];

export const columnsFor = (source: 'member' | 'family'): TableColumn<any>[] =>
  source === 'family' ? familyColumns : memberColumns;

/** Mirrors the REGISTERS map in mahallu-api/src/controllers/registerController.ts */
export const REGISTER_CONFIGS: RegisterConfig[] = [
  {
    key: 'zakat-payers',
    title: 'Zakat Payers',
    description: 'Members flagged as zakat contributors',
    source: 'member',
  },
  {
    key: 'zakat-beneficiaries',
    title: 'Zakat Beneficiaries',
    description: 'Candidates for zakat support (verification happens in the Zakat module)',
    source: 'member',
  },
  { key: 'job-seekers', title: 'Job Seekers', description: 'Members looking for work', source: 'member' },
  {
    key: 'skilled-workers',
    title: 'Skilled Workers',
    description: 'Members with recorded skills',
    source: 'member',
  },
  { key: 'students', title: 'Students', description: 'Members currently studying', source: 'member' },
  {
    key: 'marriageable',
    title: 'Marriageable Members',
    description: 'Members open to marriage proposals',
    source: 'member',
    filters: [
      {
        name: 'gender',
        label: 'Gender',
        options: [
          { value: '', label: 'All' },
          { value: 'male', label: 'Male' },
          { value: 'female', label: 'Female' },
        ],
      },
    ],
  },
  {
    key: 'volunteers',
    title: 'Volunteers',
    description: 'Members available for volunteer service',
    source: 'member',
  },
  { key: 'widows', title: 'Widows', description: 'Widowed members', source: 'member' },
  { key: 'orphans', title: 'Orphans', description: 'Orphan members', source: 'member' },
  {
    key: 'disabled',
    title: 'Members with Disability',
    description: 'Members needing accessibility support',
    source: 'member',
  },
  { key: 'elderly', title: 'Senior Citizens', description: 'Members aged 60 and above', source: 'member' },
  { key: 'unemployed', title: 'Unemployed', description: 'Members without employment', source: 'member' },
  {
    key: 'welfare',
    title: 'Welfare Families',
    description: 'Households receiving or needing assistance',
    source: 'family',
    filters: [
      {
        name: 'welfareStatus',
        label: 'Welfare Status',
        options: [
          { value: '', label: 'All' },
          { value: 'receiving', label: 'Receiving' },
          { value: 'applied', label: 'Applied' },
          { value: 'needs_review', label: 'Needs Review' },
        ],
      },
    ],
  },
];

export const findRegisterConfig = (key?: string): RegisterConfig | undefined =>
  REGISTER_CONFIGS.find((config) => config.key === key);
