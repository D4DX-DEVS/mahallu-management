import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import User from '../models/User';
import { updateUser } from '../controllers/userController';
import { rangeStart, rangeEnd } from '../utils/dayWindow';
import { getPaginationParams } from '../utils/pagination';
import { clearableUpdate } from '../utils/sanitizeUpdate';

const src = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
const fnBody = (code: string, name: string) => {
  const i = code.indexOf(name);
  assert.ok(i >= 0, `${name} not found`);
  return code.slice(i, i + 6000);
};

const fakeRes = () => {
  const res: any = { statusCode: 200, body: undefined };
  res.status = (c: number) => ((res.statusCode = c), res);
  res.json = (b: any) => ((res.body = b), res);
  return res;
};

// ---- B: updateUser tenant / super-admin checks (the select('_id') bug made every update 404)
const stubUsers = (target: any) => {
  const origFind = (User as any).findById;
  const origUpd = (User as any).findByIdAndUpdate;
  let selected = '';
  (User as any).findById = () => ({
    select: (s: string) => {
      selected = s;
      // a real select would hide unselected fields: emulate that
      const visible: any = {};
      for (const f of s.split(/\s+/)) if (f in target) visible[f] = target[f];
      return Promise.resolve(visible);
    },
  });
  (User as any).findByIdAndUpdate = (_id: any, upd: any) => ({ select: () => Promise.resolve({ _id, applied: upd }) });
  return { restore: () => ((User as any).findById = origFind, (User as any).findByIdAndUpdate = origUpd), selected: () => selected };
};

test('updateUser: mahall admin can update a user of their own tenant', async () => {
  const stub = stubUsers({ _id: 'u1', tenantId: 'T1', isSuperAdmin: false, role: 'survey' });
  const res = fakeRes();
  await updateUser({ params: { id: 'u1' }, body: { name: 'New', permissions: { canApprovePayments: false } }, tenantId: 'T1', isSuperAdmin: false } as any, res);
  stub.restore();
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data.applied.$set, { name: 'New', 'permissions.canApprovePayments': false });
});

test('updateUser: other tenant and super admin targets stay hidden (404)', async () => {
  for (const target of [
    { _id: 'u2', tenantId: 'T2', isSuperAdmin: false },
    { _id: 'u3', tenantId: 'T1', isSuperAdmin: true },
    { _id: 'u4', isSuperAdmin: true },
  ]) {
    const stub = stubUsers(target);
    const res = fakeRes();
    await updateUser({ params: { id: target._id }, body: { name: 'X' }, tenantId: 'T1', isSuperAdmin: false } as any, res);
    stub.restore();
    assert.equal(res.statusCode, 404, JSON.stringify(target));
  }
});

test('updateUser: financeAdmin / canDeleteReceipts only by super admin, flags must be boolean', async () => {
  const stub = stubUsers({ _id: 'u1', tenantId: 'T1', isSuperAdmin: false });
  let res = fakeRes();
  await updateUser({ params: { id: 'u1' }, body: { permissions: { financeAdmin: true } }, tenantId: 'T1', isSuperAdmin: false } as any, res);
  assert.equal(res.statusCode, 403);
  res = fakeRes();
  await updateUser({ params: { id: 'u1' }, body: { permissions: { canCloseCashDay: 'yes' } }, tenantId: 'T1', isSuperAdmin: false } as any, res);
  assert.equal(res.statusCode, 400);
  stub.restore();
});

// ---- D: L-04 date-only range bounds are whole IST days
test('rangeEnd/rangeStart: date-only means the whole IST day', () => {
  assert.equal(rangeStart('2026-10-12').toISOString(), '2026-10-11T18:30:00.000Z');
  assert.equal(rangeEnd('2026-10-12').toISOString(), '2026-10-12T18:29:59.999Z');
  assert.equal(rangeEnd('2026-10-12T05:00:00.000Z').toISOString(), '2026-10-12T05:00:00.000Z');
});

// ---- D: L-02 pagination caps
test('pagination: default 10, cap 1000, all=true cap 5000', () => {
  const p = (q: any) => getPaginationParams({ query: q } as any).limit;
  assert.equal(p({}), 10);
  assert.equal(p({ limit: '10000' }), 1000);
  assert.equal(p({ limit: '250' }), 250);
  assert.equal(p({ all: 'true' }), 5000);
  assert.equal(p({ all: '1', limit: '99999' }), 5000);
});

// ---- D: L-17 clear semantics
test('clearableUpdate: null and empty string unset, undefined untouched', () => {
  assert.deepEqual(clearableUpdate({ a: 'x', b: null, c: '', d: '  ', e: undefined, f: 0, g: false }), {
    $set: { a: 'x', f: 0, g: false },
    $unset: { b: '', c: '', d: '' },
  });
});

// ---- A: period lock is checked before the first write in every money handler
test('collectibleController: ensurePeriodOpen precedes writes', () => {
  const c = src('controllers/collectibleController.ts');
  const before = (fn: string, write: string) => {
    const body = fnBody(c, fn);
    const a = body.indexOf('ensurePeriodOpen');
    const w = body.indexOf(write);
    assert.ok(a > 0 && w > 0 && a < w, `${fn}: ensurePeriodOpen must come before ${write}`);
  };
  before('export const createVarisangya', 'createReceiptDoc(');
  before('export const createZakat', 'createReceiptDoc(');
  before('const updateReceipt', 'existing.save()');
  assert.match(fnBody(c, 'const updateReceipt'), /\[existing\.paymentDate, req\.body\?\.paymentDate\]/);
  before('const deleteReceipt', 'findByIdAndDelete');
  before('export const cancelReceipt', 'findOneAndUpdate');
  before('export const approvePaymentRequest', 'findOneAndUpdate');
});

test('welfare, campaign, petty cash, salary check the period up front', () => {
  assert.match(fnBody(src('controllers/welfareController.ts'), "if (nextStatus === 'disbursed')"), /ensurePeriodOpen[\s\S]*findOneAndUpdate/);
  assert.match(src('controllers/campaignController.ts'), /assertPeriodOpen\(tenantId[\s\S]*nextCampaignReceiptNo/);
  assert.match(src('controllers/campaignController.ts'), /ensurePeriodOpen\(res, c\.tenantId, c\.paymentDate\)/);
  const pc = fnBody(src('controllers/pettyCashController.ts'), 'export const replenishPettyCash');
  assert.ok(pc.indexOf('ensurePeriodOpen') < pc.indexOf('postLedgerEntry'));
});

// ---- B: route guards
test('routes carry the permission guards', () => {
  const coll = src('routes/collectibleRoutes.ts');
  assert.match(coll, /payment-requests\/:type\/:id\/approve', requirePermission\('canApprovePayments'\)/);
  assert.match(coll, /payment-requests\/:type\/:id\/reject', requirePermission\('canApprovePayments'\)/);
  assert.match(coll, /delete\('\/varisangya\/:id', allowRoles\(\['super_admin'\]\)/);
  const per = src('routes/periodRoutes.ts');
  for (const r of ["post('/', ", "post('/:id/close', ", "delete('/:id', "]) {
    const line = per.split('\n').find((l) => l.includes(`router.${r}`))!;
    assert.match(line, /requirePermission\('canManagePeriods'\)/, r);
  }
});

// ---- D: L-01 / L-14 / L-11
test('consolidated report excludes null-institute rows from the institute grouping', () => {
  const a = fnBody(src('controllers/accountingReportController.ts'), 'getConsolidatedReport');
  assert.match(a, /\$match: \{ \.\.\.matchQuery, instituteId: \{ \$ne: null \} \}/);
});

test('shared active-member filter is used by dashboard and reports', () => {
  assert.match(src('utils/archiveFilters.ts'), /ACTIVE_MEMBER_FILTER/);
  assert.match(src('controllers/dashboardController.ts'), /ACTIVE_MEMBER_FILTER/);
  const r = src('controllers/reportController.ts');
  assert.match(r, /isOrphan: true/);
  assert.doesNotMatch(r, /\(m\.age \|\| 0\) < 18/);
});

test('welfare: application fields and disbursement are guarded', () => {
  const w = src('controllers/welfareController.ts');
  assert.match(fnBody(w, 'export const createApplication'), /refBelongsToTenant\(Family[\s\S]*Family\.updateOne\(\{ _id: application\.familyId, tenantId \}/);
  assert.match(fnBody(w, 'export const updateApplication'), /approvedAmount, disbursedDate, disbursedVia, ledgerItemId/);
  assert.match(w, /status: 'approved' \},\s*\{ \$set: \{ status: 'disbursed'/);
});

test('qard repayment creates the record before touching the loan, with a conditional update', () => {
  const q = fnBody(src('controllers/qardController.ts'), 'export const createRepayment');
  assert.ok(q.indexOf('QardRepayment.create') < q.indexOf('QardLoan.findOneAndUpdate'));
  assert.match(q, /outstandingBalance: loan\.outstandingBalance/);
  assert.match(q, /Payment date must be a valid date/);
});

test('petty cash: float is not posted, replenish uses postedAt and atomic balance updates', () => {
  const p = src('controllers/pettyCashController.ts');
  assert.doesNotMatch(fnBody(p, 'export const createPettyCash'), /postLedgerEntry\(/);
  assert.match(p, /postedAt: \{ \$exists: false \}/);
  assert.match(p, /currentBalance: \{ \$gte: amount \}/);
});
