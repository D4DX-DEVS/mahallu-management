import { MadrasaClass, StudentEnrollment } from '../../models/Madrasa';
import { ClassAttendance, Exam } from '../../models/Attendance';
import Institute from '../../models/Institute';
import Employee from '../../models/Employee';
import Member from '../../models/Member';
import { FakeStore, Installed, installFake, oid } from './fakeMongo';

/**
 * Two Mahallus (A, B). Mahallu A has two institutes (I1, I2), each with a class, an enrollment, an
 * attendance sheet and an exam, plus a Mahallu-level class with NO instituteId (an "old" class) that
 * has the same kind of children. Mahallu B has one institute with its own class and children.
 * Every education model is a stateful in-memory fake (see fakeMongo.ts); no database is touched.
 */
export function makeEducationWorld() {
  const installs: Installed[] = [];
  const fake = (Model: any, seed: any[] = []): FakeStore => {
    const installed = installFake(Model, seed);
    installs.push(installed);
    return installed.store;
  };

  const tenantA = oid();
  const tenantB = oid();
  const I1 = oid();
  const I2 = oid();
  const IX = oid(); // institute of tenant B
  const E1 = oid(); // teacher of I1
  const E2 = oid(); // teacher of I2
  const EX = oid(); // teacher of tenant B
  const C1 = oid(); // I1, active
  const C1b = oid(); // I1, inactive, nothing in it
  const C2 = oid(); // I2
  const C0 = oid(); // old class: no instituteId (Mahallu level)
  const CX = oid(); // tenant B
  const M1 = oid();
  const M2 = oid();
  const M3 = oid();
  const M4 = oid();
  const MX = oid();
  const EN1 = oid(); // enrollment in C1
  const EN2 = oid(); // in C2
  const EN0 = oid(); // in C0
  const ENX = oid(); // in CX
  const A1 = oid(); // attendance sheet C1
  const A2 = oid();
  const A0 = oid();
  const AX = oid();
  const X1 = oid(); // exam C1
  const X2 = oid();
  const X0 = oid();
  const XX = oid();

  const day = new Date(Date.UTC(2026, 2, 2));

  const stores = {
    institute: fake(Institute, [
      { _id: I1, tenantId: tenantA, name: 'Institute One' },
      { _id: I2, tenantId: tenantA, name: 'Institute Two' },
      { _id: IX, tenantId: tenantB, name: 'Institute X' },
    ]),
    employee: fake(Employee, [
      { _id: E1, tenantId: tenantA, instituteId: I1, name: 'Teacher One' },
      { _id: E2, tenantId: tenantA, instituteId: I2, name: 'Teacher Two' },
      { _id: EX, tenantId: tenantB, instituteId: IX, name: 'Teacher X' },
    ]),
    member: fake(Member, [
      { _id: M1, tenantId: tenantA, name: 'Student One' },
      { _id: M2, tenantId: tenantA, name: 'Student Two' },
      { _id: M3, tenantId: tenantA, name: 'Student Three' },
      { _id: M4, tenantId: tenantA, name: 'Student Four' },
      { _id: MX, tenantId: tenantB, name: 'Student X' },
    ]),
    klass: fake(MadrasaClass, [
      { _id: C1, tenantId: tenantA, instituteId: I1, name: 'Class One', academicYear: '2025-26', classType: 'tuition', status: 'active' },
      { _id: C1b, tenantId: tenantA, instituteId: I1, name: 'Class One B', academicYear: '2025-26', classType: 'remedial', status: 'inactive' },
      { _id: C2, tenantId: tenantA, instituteId: I2, name: 'Class Two', academicYear: '2025-26', classType: 'tuition', status: 'active' },
      { _id: C0, tenantId: tenantA, name: 'Old Mahallu Class', academicYear: '2024-25', classType: 'weekend_madrasa', status: 'active' },
      { _id: CX, tenantId: tenantB, instituteId: IX, name: 'Class X', academicYear: '2025-26', classType: 'tuition', status: 'active' },
    ]),
    enrollment: fake(StudentEnrollment, [
      { _id: EN1, tenantId: tenantA, classId: C1, memberId: M1, status: 'active', rollNo: '1' },
      { _id: EN2, tenantId: tenantA, classId: C2, memberId: M2, status: 'active', rollNo: '1' },
      { _id: EN0, tenantId: tenantA, classId: C0, memberId: M3, status: 'active', rollNo: '1' },
      { _id: ENX, tenantId: tenantB, classId: CX, memberId: MX, status: 'active', rollNo: '1' },
    ]),
    attendance: fake(ClassAttendance, [
      { _id: A1, tenantId: tenantA, classId: C1, date: day, records: [{ enrollmentId: EN1, present: true }] },
      { _id: A2, tenantId: tenantA, classId: C2, date: day, records: [{ enrollmentId: EN2, present: true }] },
      { _id: A0, tenantId: tenantA, classId: C0, date: day, records: [{ enrollmentId: EN0, present: false }] },
      { _id: AX, tenantId: tenantB, classId: CX, date: day, records: [{ enrollmentId: ENX, present: true }] },
    ]),
    exam: fake(Exam, [
      { _id: X1, tenantId: tenantA, classId: C1, name: 'Exam One', examDate: day, maxMarks: 100, status: 'scheduled', results: [{ enrollmentId: EN1, marks: 80 }] },
      { _id: X2, tenantId: tenantA, classId: C2, name: 'Exam Two', examDate: day, maxMarks: 100, status: 'scheduled', results: [{ enrollmentId: EN2, marks: 70 }] },
      { _id: X0, tenantId: tenantA, classId: C0, name: 'Old Exam', examDate: day, maxMarks: 100, status: 'scheduled', results: [{ enrollmentId: EN0, marks: 60 }] },
      { _id: XX, tenantId: tenantB, classId: CX, name: 'Exam X', examDate: day, maxMarks: 100, status: 'scheduled', results: [] },
    ]),
  };

  // The handlers use a few document methods the fake's plain results do not have: give them just
  // enough (populate is a no-op; save writes the document back; the rest of the API is unchanged).
  const originals: Array<[any, string, any]> = [];
  const patch = (target: any, key: string, impl: any, own = true) => {
    originals.push([target, key, own ? target[key] : undefined]);
    target[key] = impl;
  };
  const attach = (store: FakeStore, doc: any) => {
    if (!doc) return doc;
    Object.defineProperty(doc, 'populate', { value: async () => doc, enumerable: false });
    Object.defineProperty(doc, 'save', {
      enumerable: false,
      value: async () => {
        const target = store.docs.find((d) => String(d._id) === String(doc._id));
        if (target) {
          Object.keys(doc).forEach((k) => {
            if (typeof doc[k] !== 'function') target[k] = doc[k];
          });
        }
        return doc;
      },
    });
    return doc;
  };
  const docify = (Model: any, store: FakeStore) => {
    for (const op of ['findOne', 'findById']) {
      const original = Model[op];
      patch(Model, op, (...args: any[]) => {
        const q = original.apply(Model, args);
        const then = q.then;
        q.then = (resolve: any, reject: any) => then.call(q, (d: any) => resolve(attach(store, d)), reject);
        return q;
      });
    }
  };
  docify(Exam, stores.exam);
  const createEnrollment = (StudentEnrollment as any).create;
  patch(StudentEnrollment, 'create', async (data: any) => attach(stores.enrollment, await createEnrollment.call(StudentEnrollment, data)));
  // `new Exam(...).save()` is stubbed by fakeMongo; populate on a real document would query.
  patch((Exam as any).prototype, 'populate', async function (this: any) {
    return this;
  }, false);

  const caller = (role: string, extra: Record<string, any> = {}) => ({
    tenantId: String(tenantA),
    ...extra,
    user: { _id: oid(), role, ...(extra.user || {}) },
  });
  const ids = {
    tenantA, tenantB, I1, I2, IX, E1, E2, EX, C1, C1b, C2, C0, CX, M1, M2, M3, M4, MX,
    EN1, EN2, EN0, ENX, A1, A2, A0, AX, X1, X2, X0, XX,
  };
  const s = (id: any) => String(id);

  return {
    ids,
    stores,
    /** An institute account of institute I1 / I2 in Mahallu A. */
    asInstitute1: (extra: Record<string, any> = {}) => caller('institute', { ...extra, user: { instituteId: s(I1), ...(extra.user || {}) } }),
    asInstitute2: (extra: Record<string, any> = {}) => caller('institute', { ...extra, user: { instituteId: s(I2), ...(extra.user || {}) } }),
    /** An institute-role account that is not linked to any institute. */
    asUnlinkedInstitute: () => caller('institute'),
    asMahall: (extra: Record<string, any> = {}) => caller('mahall', extra),
    /** A super admin viewing Mahallu A. */
    asSuperAdmin: (extra: Record<string, any> = {}) => caller('super_admin', { isSuperAdmin: true, ...extra, user: { isSuperAdmin: true } }),
    /** The ids (as text) a handler answered with. */
    idsOf: (body: any): string[] => (body?.data || []).map((row: any) => String(row.id ?? row._id)).sort(),
    ofIds: (...list: any[]) => list.map(s).sort(),
    restore: () => {
      originals.reverse().forEach(([target, key, original]) => {
        if (original === undefined) delete target[key];
        else target[key] = original;
      });
      installs.forEach((i) => i.restore());
    },
  };
}

export type EducationWorld = ReturnType<typeof makeEducationWorld>;
