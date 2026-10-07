import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { getEducationReport } from '../controllers/reportController';
import { MadrasaClass, StudentEnrollment } from '../models/Madrasa';
import { ClassAttendance, Exam } from '../models/Attendance';
import { Scholarship, ScholarshipAward, AcademicSupportCase } from '../models/Scholarship';

// Wrapped in one root suite so the stubs installed by this file's hooks only apply to its own tests
// when every suite is imported into the single `npm test` process.
describe('[isolated] educationReportScope', () => {

/**
 * GET /reports/education for an institute account is limited to that institute's classes
 * (enrollments, attendance sheets and exams are reached through classId -> MadrasaClass.instituteId);
 * scholarships, awards and support cases have no institute, so they are withheld (null + scopeNote),
 * never zeroed. Mahallu admins keep the whole-Mahallu numbers. Models are stubbed with a tiny
 * in-memory store, so every number below is computed from the filter the controller sent.
 */

const oid = () => new mongoose.Types.ObjectId();
const T_A = oid();
const T_B = oid();
const INST_1 = oid(); // the institute admin's own institute (tenant A)
const INST_2 = oid(); // a sibling institute (tenant A)
const INST_X = oid(); // an institute of tenant B

const C1 = oid(); // INST_1, active
const C1b = oid(); // INST_1, inactive
const C2 = oid(); // INST_2, active
const C0 = oid(); // Mahallu-level class, no institute
const CX = oid(); // tenant B

let classes: any[] = [];
let enrollments: any[] = [];
let attendance: any[] = [];
let exams: any[] = [];
let scholarships: any[] = [];
let awards: any[] = [];
let cases: any[] = [];
let touched: string[] = [];

const same = (a: any, b: any) => String(a) === String(b);
const matches = (doc: any, filter: Record<string, any>): boolean =>
  Object.entries(filter).every(([key, want]) => {
    if (want && typeof want === 'object' && !(want instanceof mongoose.Types.ObjectId) && '$in' in want) {
      return want.$in.some((v: any) => same(v, doc[key]));
    }
    if (want && typeof want === 'object' && !(want instanceof mongoose.Types.ObjectId) && ('$gte' in want || '$lte' in want)) {
      return (!want.$gte || doc[key] >= want.$gte) && (!want.$lte || doc[key] <= want.$lte);
    }
    return same(doc[key], want);
  });

const restore: Array<[any, string, any]> = [];
const stub = (target: any, key: string, impl: any) => {
  restore.push([target, key, target[key]]);
  target[key] = impl;
};

const call = async (req: Record<string, any>) => {
  const out: any = { status: 200, body: undefined };
  const res: any = { status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; return res; } };
  await getEducationReport({ query: {}, isSuperAdmin: false, ...req } as any, res);
  return out;
};

const institute = (instituteId: any = INST_1, extra: Record<string, any> = {}) => ({
  user: { role: 'institute', instituteId: String(instituteId) },
  tenantId: String(T_A),
  ...extra,
});
const mahall = (tenantId: any = T_A) => ({ user: { role: 'mahall' }, tenantId: String(tenantId) });

beforeEach(() => {
  touched = [];
  const today = new Date();
  const inMonth = new Date(today.getFullYear(), today.getMonth(), 1, 12);
  classes = [
    { _id: C1, tenantId: T_A, instituteId: INST_1, status: 'active' },
    { _id: C1b, tenantId: T_A, instituteId: INST_1, status: 'inactive' },
    { _id: C2, tenantId: T_A, instituteId: INST_2, status: 'active' },
    { _id: C0, tenantId: T_A, status: 'active' },
    { _id: CX, tenantId: T_B, instituteId: INST_X, status: 'active' },
  ];
  enrollments = [
    { tenantId: T_A, classId: C1, status: 'active' },
    { tenantId: T_A, classId: C1, status: 'active' },
    { tenantId: T_A, classId: C1, status: 'dropped' },
    { tenantId: T_A, classId: C2, status: 'active' },
    { tenantId: T_A, classId: C2, status: 'active' },
    { tenantId: T_A, classId: C2, status: 'active' },
    { tenantId: T_A, classId: C0, status: 'active' },
    { tenantId: T_B, classId: CX, status: 'active' },
  ];
  attendance = [
    { tenantId: T_A, classId: C1, date: inMonth, records: [{ present: true }, { present: true }, { present: false }, { present: false }] },
    { tenantId: T_A, classId: C2, date: inMonth, records: [{ present: true }, { present: true }, { present: true }, { present: true }] },
    { tenantId: T_B, classId: CX, date: inMonth, records: [{ present: false }] },
  ];
  exams = [
    { tenantId: T_A, classId: C1 },
    { tenantId: T_A, classId: C2 },
    { tenantId: T_A, classId: C2 },
    { tenantId: T_B, classId: CX },
  ];
  scholarships = [
    { tenantId: T_A, status: 'active' },
    { tenantId: T_A, status: 'closed' },
    { tenantId: T_B, status: 'active' },
  ];
  awards = [
    { tenantId: T_A, status: 'approved', amount: 500 },
    { tenantId: T_A, status: 'paid', amount: 700 },
    { tenantId: T_B, status: 'paid', amount: 9999 },
  ];
  cases = [
    { tenantId: T_A, type: 'tuition', status: 'open' },
    { tenantId: T_A, type: 'tuition', status: 'closed' },
    { tenantId: T_B, type: 'dropout', status: 'open' },
  ];

  stub(MadrasaClass, 'distinct', async (_field: string, filter: any) => {
    touched.push('class.distinct');
    return classes.filter((c) => matches(c, filter)).map((c) => c._id);
  });
  stub(MadrasaClass, 'countDocuments', async (filter: any) => classes.filter((c) => matches(c, filter)).length);
  stub(StudentEnrollment, 'countDocuments', async (filter: any) => enrollments.filter((e) => matches(e, filter)).length);
  stub(Exam, 'countDocuments', async (filter: any) => exams.filter((e) => matches(e, filter)).length);
  stub(ClassAttendance, 'aggregate', async (pipeline: any[]) => {
    const filter = pipeline[0].$match;
    const rows = attendance.filter((a) => matches(a, filter));
    const total = rows.reduce((n, a) => n + a.records.length, 0);
    const present = rows.reduce((n, a) => n + a.records.filter((r: any) => r.present).length, 0);
    return rows.length ? [{ _id: null, total, present }] : [];
  });
  stub(Scholarship, 'countDocuments', async (filter: any) => {
    touched.push('scholarship');
    return scholarships.filter((s) => matches(s, filter)).length;
  });
  stub(ScholarshipAward, 'aggregate', async (pipeline: any[]) => {
    touched.push('award');
    const rows = awards.filter((a) => matches(a, pipeline[0].$match));
    const groups: Record<string, any> = {};
    rows.forEach((r) => {
      groups[r.status] = groups[r.status] || { _id: r.status, count: 0, amount: 0 };
      groups[r.status].count += 1;
      groups[r.status].amount += r.amount;
    });
    return Object.values(groups);
  });
  stub(AcademicSupportCase, 'aggregate', async (pipeline: any[]) => {
    touched.push('case');
    const rows = cases.filter((c) => matches(c, pipeline[0].$match));
    const groups: Record<string, any> = {};
    rows.forEach((r) => {
      const key = `${r.type}/${r.status}`;
      groups[key] = groups[key] || { _id: { type: r.type, status: r.status }, count: 0 };
      groups[key].count += 1;
    });
    return Object.values(groups);
  });
});
afterEach(() => {
  while (restore.length) {
    const [target, key, original] = restore.pop()!;
    target[key] = original;
  }
});

describe('institute account', () => {
  test('sees only its own institute: students, classes, attendance and exams of its classes', async () => {
    const r = await call(institute());
    assert.equal(r.status, 200);
    assert.equal(r.body.data.studentsCount, 2, 'active enrollments of INST_1 classes only');
    assert.equal(r.body.data.activeClassesCount, 1, 'the inactive class and other institutes are not counted');
    assert.equal(r.body.data.attendancePercentThisMonth, 50, "only INST_1's 2 of 4, not the Mahallu's 6 of 8");
    assert.equal(r.body.data.examsCount, 1);
  });

  test('Mahallu-level programmes are withheld as null with a note, never zeroed, and never even queried', async () => {
    const r = await call(institute());
    assert.equal(r.body.data.scholarships, null);
    assert.equal(r.body.data.supportCases, null);
    assert.match(r.body.data.scopeNote, /institute/i);
    assert.deepEqual(touched.filter((t) => t !== 'class.distinct'), [], 'scholarship/award/support-case models are not read');
    assert.doesNotMatch(JSON.stringify(r.body), /9999|1200/);
  });

  test('another institute is scoped to its own classes only', async () => {
    const r = await call(institute(INST_2));
    assert.equal(r.body.data.studentsCount, 3);
    assert.equal(r.body.data.attendancePercentThisMonth, 100);
    assert.equal(r.body.data.examsCount, 2);
    assert.equal(r.body.data.activeClassesCount, 1);
  });

  test('an institute with no classes gets zeros for its own numbers, not the Mahallu totals', async () => {
    const r = await call(institute(oid()));
    assert.equal(r.status, 200);
    assert.equal(r.body.data.studentsCount, 0);
    assert.equal(r.body.data.examsCount, 0);
    assert.equal(r.body.data.attendancePercentThisMonth, 0);
    assert.equal(r.body.data.activeClassesCount, 0);
  });

  test('the institute comes from the session: query/body/header values cannot widen it', async () => {
    const r = await call(
      institute(INST_1, {
        query: { instituteId: String(INST_2), tenantId: String(T_B), scope: 'all' },
        body: { instituteId: String(INST_2) },
        headers: { 'x-institute-id': String(INST_2) },
      })
    );
    assert.equal(r.body.data.studentsCount, 2);
    assert.equal(r.body.data.examsCount, 1);
  });

  test("an institute id belonging to another Mahallu's institute counts nothing of tenant B", async () => {
    // Session says INST_X but the request's Mahallu is A: tenant B's class is never matched.
    const r = await call(institute(INST_X));
    assert.equal(r.body.data.studentsCount, 0);
    assert.equal(r.body.data.examsCount, 0);
  });

  test('fails closed: an institute account with no institute is refused', async () => {
    for (const user of [{ role: 'institute' }, { role: 'institute', instituteId: null }, { role: 'institute', instituteId: 'not-an-id' }]) {
      const r = await call({ user, tenantId: String(T_A) });
      assert.equal(r.status, 403, JSON.stringify(user));
      assert.equal(r.body.success, false);
      assert.equal(r.body.data, undefined);
    }
    assert.deepEqual(touched, []);
  });
});

describe('Mahallu admin and super admin', () => {
  test('Mahallu admin: whole-Mahallu numbers, unchanged shape, other Mahallu never counted', async () => {
    const r = await call(mahall());
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.data, {
      studentsCount: 6,
      activeClassesCount: 3,
      attendancePercentThisMonth: 75,
      examsCount: 3,
      scholarships: {
        activeScholarships: 1,
        totalAwardedAmount: 1200,
        totalAwards: 2,
        awardsByStatus: { approved: 1, paid: 1 },
      },
      supportCases: { total: 2, byType: { tuition: 2 }, byStatus: { open: 1, closed: 1 } },
    });
    assert.equal(r.body.data.scopeNote, undefined);
    assert.ok(!touched.includes('class.distinct'), 'no per-institute class lookup for the Mahallu admin');
  });

  test('another Mahallu admin sees only its own Mahallu', async () => {
    const r = await call(mahall(T_B));
    assert.equal(r.body.data.studentsCount, 1);
    assert.equal(r.body.data.scholarships.totalAwardedAmount, 9999);
  });

  test('super admin viewing a Mahallu is unscoped inside it', async () => {
    const r = await call({ user: { role: 'super_admin' }, isSuperAdmin: true, tenantId: String(T_A) });
    assert.equal(r.body.data.studentsCount, 6);
    assert.ok(r.body.data.scholarships);
    assert.ok(r.body.data.supportCases);
  });

  test('no Mahallu selected is still a 400', async () => {
    const r = await call({ user: { role: 'mahall' } });
    assert.equal(r.status, 400);
  });
});

});
