import { MasterCategory as Category, MasterCategoryValue as CategoryValue } from '../models/MasterCategory';
import Member from '../models/Member';
import Tenant from '../models/Tenant';
import { WELFARE_CATEGORIES } from '../models/Welfare';
import { ZAKAT_CATEGORIES } from '../models/Zakat';

interface SeedValue {
  code: string;
  label: string;
  /** Only 'varisangya_grade' carries this - the monthly amount for the grade. */
  amount?: number;
}

interface SeedCategory {
  key: string;
  name: string;
  description: string;
  values: SeedValue[];
}

const EDUCATION_FALLBACK = [
  'Below SSLC',
  'SSLC',
  'Plus Two',
  'Degree',
  'Diploma',
  'Post Graduation',
  'Doctorate',
  'MBBS',
];

/**
 * Varisangya grades used to live in per-tenant settings (Tenant.settings.varisangyaGrades).
 * They are global master data now - one list every Mahallu shares, Super Admin edits it in Categories.
 * Area stays per-tenant (Tenant.settings.areaOptions) since each Mahallu names its own localities.
 */
const VARISANGYA_GRADE_SEED: SeedValue[] = [
  { code: 'Grade A', label: 'Grade A', amount: 100 },
  { code: 'Grade B', label: 'Grade B', amount: 75 },
  { code: 'Grade C', label: 'Grade C', amount: 50 },
  { code: 'Grade D', label: 'Grade D', amount: 25 },
];

const HEALTH_STATUS_SEED: SeedValue[] = [
  { code: 'healthy', label: 'Healthy' },
  { code: 'under_treatment', label: 'Under Treatment' },
  { code: 'chronic', label: 'Chronic Illness' },
  { code: 'disabled', label: 'Disabled' },
  { code: 'critical', label: 'Critical' },
  { code: 'recovering', label: 'Recovering' },
];

const ZAKAT_LABELS: Record<string, string> = {
  fakir: 'Fakir (destitute)',
  miskin: 'Miskin (needy)',
  amil: 'Amil (zakat administrator)',
  muallaf: "Muallaf (new to Islam)",
  riqab: 'Riqab (freeing captives)',
  gharim: 'Gharim (debtor)',
  fisabilillah: "Fisabilillah (in Allah's cause)",
  ibnussabil: 'Ibnussabil (stranded traveller)',
  other: 'Other',
};

const WELFARE_LABELS: Record<string, string> = {
  medical: 'Medical',
  housing: 'Housing',
  education: 'Education',
  livelihood: 'Livelihood',
  food: 'Food',
  marriage_assistance: 'Marriage Assistance',
  emergency: 'Emergency',
  other: 'Other',
};

const titleCase = (code: string) =>
  code
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

async function buildEducationSeed(): Promise<SeedValue[]> {
  const tenants = await Tenant.find({}, 'settings.educationOptions');
  const union = new Set<string>();
  EDUCATION_FALLBACK.forEach((v) => union.add(v));
  tenants.forEach((t) => (t.settings?.educationOptions || []).forEach((v) => v && union.add(v.trim())));
  return Array.from(union).map((v) => ({ code: v, label: v }));
}

const STATIC_CATEGORIES: Omit<SeedCategory, 'values'>[] = [
  { key: 'gender', name: 'Gender', description: 'Member gender' },
  { key: 'blood_group', name: 'Blood Group', description: 'Member blood group' },
  { key: 'marital_status', name: 'Marital Status', description: 'Member marital status' },
  { key: 'relationship', name: 'Relationship', description: 'Relationship of a member to the family head' },
  { key: 'occupation_sector', name: 'Occupation Sector', description: 'Member occupation sector' },
  { key: 'monthly_income_range', name: 'Monthly Income Range', description: 'Member monthly income range' },
  { key: 'housing_type', name: 'Housing Type', description: 'Family housing type' },
  { key: 'economic_status', name: 'Economic Status', description: 'Family economic status' },
  { key: 'welfare_category', name: 'Welfare Category', description: 'Welfare scheme category' },
  { key: 'zakat_asnaf_category', name: 'Zakat Asnaf Category', description: 'Qur\'anic zakat recipient category' },
  { key: 'health_status', name: 'Health Status', description: 'Member health status' },
  { key: 'education', name: 'Education', description: 'Member education level' },
  {
    key: 'varisangya_grade',
    name: 'Varisangya Grade',
    description: 'Family varisangya grade and the amount billed for it',
  },
];

async function buildSeedCategories(): Promise<SeedCategory[]> {
  return [
    { ...STATIC_CATEGORIES[0], values: [{ code: 'male', label: 'Male' }, { code: 'female', label: 'Female' }] },
    {
      ...STATIC_CATEGORIES[1],
      values: ['A +ve', 'A -ve', 'B +ve', 'B -ve', 'AB +ve', 'AB -ve', 'O +ve', 'O -ve'].map((v) => ({
        code: v,
        label: v,
      })),
    },
    {
      ...STATIC_CATEGORIES[2],
      values: [
        { code: 'single', label: 'Single' },
        { code: 'married', label: 'Married' },
        { code: 'divorced', label: 'Divorced' },
        { code: 'widowed', label: 'Widowed' },
      ],
    },
    {
      ...STATIC_CATEGORIES[3],
      values: ['head', 'spouse', 'son', 'daughter', 'father', 'mother', 'other'].map((v) => ({
        code: v,
        label: titleCase(v),
      })),
    },
    {
      ...STATIC_CATEGORIES[4],
      values: [
        { code: 'government', label: 'Government' },
        { code: 'private', label: 'Private' },
        { code: 'self_employed', label: 'Self Employed' },
        { code: 'abroad', label: 'Abroad' },
        { code: 'unemployed', label: 'Unemployed' },
        { code: 'student', label: 'Student' },
        { code: 'homemaker', label: 'Homemaker' },
        { code: 'retired', label: 'Retired' },
        { code: 'none', label: 'None' },
      ],
    },
    {
      ...STATIC_CATEGORIES[5],
      values: [
        { code: 'none', label: 'No Income' },
        { code: 'below_10k', label: 'Below 10,000' },
        { code: '10k_25k', label: '10,000 - 25,000' },
        { code: '25k_50k', label: '25,000 - 50,000' },
        { code: 'above_50k', label: 'Above 50,000' },
      ],
    },
    {
      ...STATIC_CATEGORIES[6],
      values: [
        { code: 'own', label: 'Own House' },
        { code: 'rented', label: 'Rented' },
        { code: 'shared', label: 'Shared' },
        { code: 'none', label: 'No Housing' },
      ],
    },
    {
      ...STATIC_CATEGORIES[7],
      values: [
        { code: 'stable', label: 'Stable' },
        { code: 'struggling', label: 'Struggling' },
        { code: 'needs_assistance', label: 'Needs Assistance' },
      ],
    },
    {
      ...STATIC_CATEGORIES[8],
      values: WELFARE_CATEGORIES.map((v) => ({ code: v, label: WELFARE_LABELS[v] || titleCase(v) })),
    },
    {
      ...STATIC_CATEGORIES[9],
      values: ZAKAT_CATEGORIES.map((v) => ({ code: v, label: ZAKAT_LABELS[v] || titleCase(v) })),
    },
    { ...STATIC_CATEGORIES[10], values: HEALTH_STATUS_SEED },
    { ...STATIC_CATEGORIES[11], values: await buildEducationSeed() },
    { ...STATIC_CATEGORIES[12], values: VARISANGYA_GRADE_SEED },
  ];
}

/**
 * Backfills any free-text value already sitting in existing Member records
 * that predates the enum/tenant-list it's being seeded from (education and
 * health status never had a backend enum, so pre-existing typos/one-offs are
 * possible). Without this, the new dynamic validator could reject a save of
 * a record that already existed before this feature shipped.
 */
async function backfillFreeTextValues(categoryId: any, categoryKey: string, field: string) {
  const distinctValues: string[] = await Member.distinct(field, { [field]: { $nin: [null, ''] } });
  if (distinctValues.length === 0) return;

  const existing = await CategoryValue.find({ categoryId }, 'code');
  const existingLower = new Set(existing.map((v) => v.code.toLowerCase()));
  const maxSortOrder = existing.length;

  let nextSortOrder = maxSortOrder;
  for (const value of distinctValues) {
    const trimmed = (value || '').trim();
    if (!trimmed || existingLower.has(trimmed.toLowerCase())) continue;
    existingLower.add(trimmed.toLowerCase());
    nextSortOrder += 1;
    await CategoryValue.findOneAndUpdate(
      { categoryId, code: trimmed },
      {
        $setOnInsert: {
          categoryId,
          categoryKey,
          code: trimmed,
          label: trimmed,
          sortOrder: nextSortOrder,
          status: 'active',
        },
      },
      { upsert: true, collation: { locale: 'en', strength: 2 } }
    );
  }
}

export async function seedCategories(): Promise<void> {
  const seedCategoryList = await buildSeedCategories();

  for (const seed of seedCategoryList) {
    const category = await Category.findOneAndUpdate(
      { key: seed.key },
      { $setOnInsert: { key: seed.key, name: seed.name, description: seed.description, isSystem: true, status: 'active' } },
      { upsert: true, new: true, collation: { locale: 'en', strength: 2 } }
    );

    for (let i = 0; i < seed.values.length; i++) {
      const value = seed.values[i];
      await CategoryValue.findOneAndUpdate(
        { categoryId: category._id, code: value.code },
        {
          $setOnInsert: {
            categoryId: category._id,
            categoryKey: category.key,
            code: value.code,
            label: value.label,
            sortOrder: i,
            status: 'active',
            ...(value.amount === undefined ? {} : { amount: value.amount }),
          },
        },
        { upsert: true, collation: { locale: 'en', strength: 2 } }
      );
    }

    if (seed.key === 'education') {
      await backfillFreeTextValues(category._id, category.key, 'education');
    }
    if (seed.key === 'health_status') {
      await backfillFreeTextValues(category._id, category.key, 'healthStatus');
    }
  }

  console.log(`✅ Category master data seeded (${seedCategoryList.length} categories)`);
}
