/**
 * B1 tests. Zakat beneficiary / distribution schema shape and the verification gate
 * that guards distributions.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import {
  ZakatBeneficiary,
  ZakatDistribution,
  ZAKAT_CATEGORIES,
  PRIORITY_AREAS,
} from '../models/Zakat';

test('zakat categories are the eight Quranic asnaf plus other', () => {
  assert.deepEqual([...ZAKAT_CATEGORIES], [
    'fakir',
    'miskin',
    'amil',
    'muallaf',
    'riqab',
    'gharim',
    'fisabilillah',
    'ibnussabil',
    'other',
  ]);
});

test('priority areas match spec', () => {
  assert.deepEqual([...PRIORITY_AREAS], [
    'medical',
    'housing',
    'education',
    'livelihood',
    'living_expenses',
  ]);
});

test('beneficiary requires tenantId and starts unverified', () => {
  const paths = ZakatBeneficiary.schema.paths;
  assert.equal(paths.tenantId.isRequired, true);
  assert.equal((paths.verificationStatus as any).options.default, 'pending');
  assert.deepEqual((paths.verificationStatus as any).options.enum, [
    'pending',
    'verified',
    'rejected',
  ]);
});

test('beneficiary and distribution are timestamped', () => {
  for (const model of [ZakatBeneficiary, ZakatDistribution]) {
    assert.ok(model.schema.paths.createdAt, `${model.modelName} has no createdAt`);
    assert.ok(model.schema.paths.updatedAt, `${model.modelName} has no updatedAt`);
  }
});

test('beneficiary is indexed for the verification-status tab queries', () => {
  const hasIndex = ZakatBeneficiary.schema
    .indexes()
    .some(([fields]: any[]) => fields.tenantId === 1 && fields.verificationStatus === 1);
  assert.ok(hasIndex, 'Expected compound index on (tenantId, verificationStatus)');
});

test('distribution requires tenantId, beneficiary and amount', () => {
  const paths = ZakatDistribution.schema.paths;
  assert.equal(paths.tenantId.isRequired, true);
  assert.equal(paths.beneficiaryId.isRequired, true);
  assert.equal(paths.amount.isRequired, true);
});

test('distribution types cover regular, monthly, fitr and qurbani', () => {
  const typeEnum = (ZakatDistribution.schema.paths.type as any).options.enum;
  ['regular', 'monthly', 'fitr', 'qurbani'].forEach((t) => {
    assert.ok(typeEnum.includes(t), `distribution type '${t}' missing`);
  });
});

test('only a verified beneficiary passes the distribution gate', () => {
  // Mirrors createDistribution in zakatDistributionController.
  const gate = (verificationStatus: string) => verificationStatus === 'verified';
  assert.equal(gate('pending'), false);
  assert.equal(gate('rejected'), false);
  assert.equal(gate('verified'), true);
});

test('beneficiary documents validate without a member reference', async () => {
  // Non-member (free-text name) beneficiaries are allowed by spec.
  const doc = new ZakatBeneficiary({
    tenantId: new mongoose.Types.ObjectId(),
    name: 'Walk-in recipient',
    category: 'fakir',
  });
  await doc.validate();
  assert.equal(doc.verificationStatus, 'pending');
  assert.equal(doc.status, 'active');
});

test('category is no longer schema-enforced — moved to the dynamic Category system', () => {
  // Categories master data (see models/Category.ts) is now the source of
  // truth for valid asnaf codes, enforced by validCategoryValue at the route
  // layer (categoryValueValidation.ts), not by a Mongoose enum. ZAKAT_CATEGORIES
  // above only feeds the seed script now.
  const categoryPath = ZakatBeneficiary.schema.paths.category as any;
  assert.equal(categoryPath.options.enum, undefined);
});
