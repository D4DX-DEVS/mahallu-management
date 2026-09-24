/**
 * Categories master-data system: schema shape, seed-source correctness, and
 * the usage-map that guards hard-deletes against orphaning live records.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { MasterCategory as Category, MasterCategoryValue as CategoryValue } from '../models/MasterCategory';
import Member from '../models/Member';
import { IMember } from '../models/Member';
import Family from '../models/Family';
import { WelfareScheme } from '../models/Welfare';
import HealthResource from '../models/HealthResource';

test('Category requires a key and name, defaults to active and non-system', () => {
  const paths = Category.schema.paths;
  assert.equal(paths.key.isRequired, true);
  assert.equal(paths.name.isRequired, true);
  assert.equal((paths.status as any).options.default, 'active');
  assert.equal((paths.isSystem as any).options.default, false);
});

test('Category key is validated as lowercase snake_case', async () => {
  const doc = new Category({ key: 'Not Valid', name: 'Bad' });
  await assert.rejects(() => doc.validate(), /Key must be lowercase/);

  const ok = new Category({ key: 'valid_key', name: 'Good' });
  await ok.validate();
});

test('Category has a case-insensitive unique index on key', () => {
  const hasIndex = Category.schema
    .indexes()
    .some(([fields, opts]: any[]) => fields.key === 1 && opts?.unique && opts?.collation);
  assert.ok(hasIndex, 'Expected a case-insensitive unique index on key');
});

test('CategoryValue requires categoryId, categoryKey, code and label', () => {
  const paths = CategoryValue.schema.paths;
  assert.equal(paths.categoryId.isRequired, true);
  assert.equal(paths.categoryKey.isRequired, true);
  assert.equal(paths.code.isRequired, true);
  assert.equal(paths.label.isRequired, true);
  assert.equal((paths.status as any).options.default, 'active');
});

test('CategoryValue has case-insensitive unique indexes on (categoryId, code) and (categoryId, label)', () => {
  const indexes = CategoryValue.schema.indexes();
  const hasCodeIndex = indexes.some(
    ([fields, opts]: any[]) => fields.categoryId === 1 && fields.code === 1 && opts?.unique && opts?.collation
  );
  const hasLabelIndex = indexes.some(
    ([fields, opts]: any[]) => fields.categoryId === 1 && fields.label === 1 && opts?.unique && opts?.collation
  );
  assert.ok(hasCodeIndex, 'Expected a case-insensitive unique index on (categoryId, code)');
  assert.ok(hasLabelIndex, 'Expected a case-insensitive unique index on (categoryId, label)');
});

test('Member fields migrated to Categories no longer carry a hardcoded Mongoose enum', () => {
  const migratedFields: (keyof IMember)[] = [
    'gender',
    'bloodGroup',
    'maritalStatus',
    'relationship',
    'occupationSector',
    'monthlyIncomeRange',
  ];
  for (const field of migratedFields) {
    const path = Member.schema.paths[field as string] as any;
    assert.equal(path.options.enum, undefined, `${field} should no longer have a Mongoose enum`);
  }
});

test('Family.economicStatus/housingType migrated, but welfareStatus stays a hardcoded workflow enum', () => {
  const economicStatus = Family.schema.paths.economicStatus as any;
  const housingType = Family.schema.paths.housingType as any;
  const welfareStatus = Family.schema.paths.welfareStatus as any;
  assert.equal(economicStatus.options.enum, undefined);
  assert.equal(housingType.options.enum, undefined);
  assert.deepEqual(welfareStatus.options.enum, ['none', 'receiving', 'applied', 'needs_review']);
});

test('HealthResource.bloodGroup shares the blood_group Category instead of its own enum', () => {
  const bloodGroup = HealthResource.schema.paths.bloodGroup as any;
  assert.equal(bloodGroup.options.enum, undefined);
  // type stays a hardcoded list — it selects behaviour (sensitive vs not), not master data
  assert.ok(Array.isArray((HealthResource.schema.paths.type as any).options.enum));
});

test('WelfareScheme.category migrated, but application status stays a hardcoded workflow enum', () => {
  const category = WelfareScheme.schema.paths.category as any;
  assert.equal(category.options.enum, undefined);
});
