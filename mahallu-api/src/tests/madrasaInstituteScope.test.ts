import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAllClasses,
  getClassById,
  createClass,
  updateClass,
  deleteClass,
  getClassStudents,
  getAllEnrollments,
  createEnrollment,
  updateEnrollment,
  deleteEnrollment,
  getMadrasaSummary,
} from '../controllers/madrasaController';
import { call } from './support/fakeMongo';
import { makeEducationWorld, EducationWorld } from './support/educationWorld';

// Wrapped in one root suite so the stubs installed by this file's hooks only apply to its own tests
// when every suite is imported into the single `npm test` process.
describe('[isolated] madrasaInstituteScope', () => {

/**
 * Madrasa classes and enrollments are scoped to the caller's institute on the SERVER. An institute
 * account reaches only classes whose instituteId is its own (and enrollments through them); a
 * sibling institute's class or an old class with no instituteId (Mahallu level) answers 403 by id and
 * is missing from every list. Super admin / Mahallu admin keep the whole Mahallu, including old
 * classes, and may filter by an institute of their Mahallu. The institute never comes from the
 * query, body or a header.
 */

let w: EducationWorld;
beforeEach(() => {
  w = makeEducationWorld();
});
afterEach(() => w.restore());

// ids are regenerated for every test's world, so they are always read through `w.ids`.
const id = (name: keyof EducationWorld['ids']) => String(w.ids[name]);

describe('classes: institute account', () => {
  test('list shows only its own classes: no sibling, no Mahallu-level (no-institute) class, no other Mahallu', async () => {
    const reply = await call(getAllClasses, w.asInstitute1());
    assert.equal(reply.status, 200);
    assert.deepEqual(w.idsOf(reply.body), w.ofIds(w.ids.C1, w.ids.C1b));
    assert.equal(reply.body.pagination.total, 2);
  });

  test('?instituteId= cannot widen the list (it is ignored for an institute account)', async () => {
    for (const instituteId of [id('I2'), id('IX'), 'not-an-id']) {
      const reply = await call(getAllClasses, { ...w.asInstitute1(), query: { instituteId } });
      assert.equal(reply.status, 200, instituteId);
      assert.deepEqual(w.idsOf(reply.body), w.ofIds(w.ids.C1, w.ids.C1b), instituteId);
    }
  });

  test('an x-institute-id header and body/query tenantId do not change the scope', async () => {
    const reply = await call(getAllClasses, {
      ...w.asInstitute1(),
      headers: { 'x-institute-id': id('I2') },
      query: { tenantId: id('tenantB') },
      body: { instituteId: id('I2') },
    } as any);
    assert.deepEqual(w.idsOf(reply.body), w.ofIds(w.ids.C1, w.ids.C1b));
  });

  test('an institute account with no institute is refused instead of getting an unscoped list', async () => {
    const reply = await call(getAllClasses, w.asUnlinkedInstitute());
    assert.equal(reply.status, 403);
  });

  test('student counts only count the class they belong to', async () => {
    const reply = await call(getAllClasses, w.asInstitute1());
    const one = reply.body.data.find((c: any) => String(c._id) === id('C1'));
    assert.equal(one.studentCount, 1);
  });

  test('get by id: own class 200; sibling class, Mahallu-level class: 403; other Mahallu / unknown: 404', async () => {
    assert.equal((await call(getClassById, { ...w.asInstitute1(), params: { id: id('C1') } })).status, 200);
    assert.equal((await call(getClassById, { ...w.asInstitute1(), params: { id: id('C2') } })).status, 403);
    assert.equal((await call(getClassById, { ...w.asInstitute1(), params: { id: id('C0') } })).status, 403);
    assert.equal((await call(getClassById, { ...w.asInstitute1(), params: { id: id('CX') } })).status, 404);
    assert.equal((await call(getClassById, { ...w.asInstitute1(), params: { id: id('MX') } })).status, 404);
  });

  test('create always stamps its own institute, whatever the body says', async () => {
    const reply = await call(createClass, {
      ...w.asInstitute1(),
      body: { name: 'New', academicYear: '2025-26', instituteId: id('I2'), tenantId: id('tenantB') },
    });
    assert.equal(reply.status, 201);
    assert.equal(String(reply.body.data.instituteId), id('I1'));
    assert.equal(String(reply.body.data.tenantId), id('tenantA'));
    assert.equal(w.stores.klass.docs.length, 6);
  });

  test('create refuses a teacher of another institute and accepts its own', async () => {
    const foreign = await call(createClass, {
      ...w.asInstitute1(),
      body: { name: 'New', academicYear: '2025-26', teacherEmployeeId: id('E2') },
    });
    assert.equal(foreign.status, 400);
    const otherMahallu = await call(createClass, {
      ...w.asInstitute1(),
      body: { name: 'New', academicYear: '2025-26', teacherEmployeeId: id('EX') },
    });
    assert.equal(otherMahallu.status, 400);
    assert.equal(w.stores.klass.docs.length, 5);
    const own = await call(createClass, {
      ...w.asInstitute1(),
      body: { name: 'New', academicYear: '2025-26', teacherEmployeeId: id('E1') },
    });
    assert.equal(own.status, 201);
  });

  test('an institute account with no institute cannot create a class', async () => {
    const reply = await call(createClass, { ...w.asUnlinkedInstitute(), body: { name: 'New', academicYear: '2025-26' } });
    assert.equal(reply.status, 403);
    assert.equal(w.stores.klass.docs.length, 5);
  });

  test('update: own class works and keeps its institute even if the body names another', async () => {
    const reply = await call(updateClass, {
      ...w.asInstitute1(),
      params: { id: id('C1') },
      body: { name: 'Renamed', instituteId: id('I2') },
    });
    assert.equal(reply.status, 200);
    const stored = w.stores.klass.docs.find((d) => String(d._id) === id('C1'));
    assert.equal(stored.name, 'Renamed');
    assert.equal(String(stored.instituteId), id('I1'));
  });

  test('update: a sibling class or a Mahallu-level class is refused and untouched', async () => {
    for (const target of ['C2', 'C0'] as const) {
      const reply = await call(updateClass, { ...w.asInstitute1(), params: { id: id(target) }, body: { name: 'Hacked' } });
      assert.equal(reply.status, 403, target);
      assert.notEqual(w.stores.klass.docs.find((d) => String(d._id) === id(target)).name, 'Hacked');
    }
  });

  test('update: cannot pick a teacher of another institute', async () => {
    const reply = await call(updateClass, {
      ...w.asInstitute1(),
      params: { id: id('C1') },
      body: { teacherEmployeeId: id('E2') },
    });
    assert.equal(reply.status, 400);
    assert.equal(w.stores.klass.docs.find((d) => String(d._id) === id('C1')).teacherEmployeeId, undefined);
  });

  test('delete: own empty class goes; sibling / Mahallu-level classes are refused and kept', async () => {
    assert.equal((await call(deleteClass, { ...w.asInstitute1(), params: { id: id('C2') } })).status, 403);
    assert.equal((await call(deleteClass, { ...w.asInstitute1(), params: { id: id('C0') } })).status, 403);
    assert.equal(w.stores.klass.docs.length, 5);
    assert.equal((await call(deleteClass, { ...w.asInstitute1(), params: { id: id('C1') } })).status, 400, 'still has an enrolled student');
    assert.equal((await call(deleteClass, { ...w.asInstitute1(), params: { id: id('C1b') } })).status, 200);
    assert.equal(w.stores.klass.docs.length, 4);
  });

  test('students of a class: own class only', async () => {
    const own = await call(getClassStudents, { ...w.asInstitute1(), params: { id: id('C1') } });
    assert.equal(own.status, 200);
    assert.equal(own.body.data.length, 1);
    assert.equal((await call(getClassStudents, { ...w.asInstitute1(), params: { id: id('C2') } })).status, 403);
    assert.equal((await call(getClassStudents, { ...w.asInstitute1(), params: { id: id('C0') } })).status, 403);
  });
});

describe('enrollments: institute account', () => {
  test('list shows only enrollments of its own classes', async () => {
    const reply = await call(getAllEnrollments, w.asInstitute1());
    assert.equal(reply.status, 200);
    assert.deepEqual(w.idsOf(reply.body), w.ofIds(w.ids.EN1));
  });

  test('?classId= can narrow to its own class but never reach a sibling / Mahallu-level class', async () => {
    const own = await call(getAllEnrollments, { ...w.asInstitute1(), query: { classId: id('C1') } });
    assert.deepEqual(w.idsOf(own.body), w.ofIds(w.ids.EN1));
    for (const target of ['C2', 'C0', 'CX'] as const) {
      const reply = await call(getAllEnrollments, { ...w.asInstitute1(), query: { classId: id(target) } });
      assert.equal(reply.status, 200, target);
      assert.deepEqual(reply.body.data, [], target);
    }
    assert.equal((await call(getAllEnrollments, { ...w.asInstitute1(), query: { classId: 'nope' } })).status, 400);
  });

  test('enrol into its own class works (and the roll is stamped on its Mahallu)', async () => {
    const reply = await call(createEnrollment, {
      ...w.asInstitute1(),
      body: { classId: id('C1'), memberId: id('M4'), tenantId: id('tenantB') },
    });
    assert.equal(reply.status, 201);
    const stored = w.stores.enrollment.docs.find((d) => String(d.memberId) === id('M4'));
    assert.equal(String(stored.classId), id('C1'));
    assert.equal(String(stored.tenantId), id('tenantA'));
  });

  test('cannot enrol into a sibling institute class, a Mahallu-level class or another Mahallu class', async () => {
    for (const target of ['C2', 'C0', 'CX'] as const) {
      const reply = await call(createEnrollment, { ...w.asInstitute1(), body: { classId: id(target), memberId: id('M4') } });
      assert.equal(reply.status, 400, target);
    }
    assert.equal(w.stores.enrollment.docs.length, 4);
  });

  test('cannot enrol a student of another Mahallu', async () => {
    const reply = await call(createEnrollment, { ...w.asInstitute1(), body: { classId: id('C1'), memberId: id('MX') } });
    assert.equal(reply.status, 400);
  });

  test('update / delete: own enrollment works; sibling and Mahallu-level enrollments are refused and kept', async () => {
    assert.equal(
      (await call(updateEnrollment, { ...w.asInstitute1(), params: { id: id('EN1') }, body: { rollNo: '9' } })).status,
      200
    );
    assert.equal(w.stores.enrollment.docs.find((d) => String(d._id) === id('EN1')).rollNo, '9');
    for (const target of ['EN2', 'EN0'] as const) {
      assert.equal((await call(updateEnrollment, { ...w.asInstitute1(), params: { id: id(target) }, body: { rollNo: '9' } })).status, 403, target);
      assert.equal((await call(deleteEnrollment, { ...w.asInstitute1(), params: { id: id(target) } })).status, 403, target);
    }
    assert.equal((await call(deleteEnrollment, { ...w.asInstitute1(), params: { id: id('ENX') } })).status, 404);
    assert.equal(w.stores.enrollment.docs.length, 4);
    assert.equal((await call(deleteEnrollment, { ...w.asInstitute1(), params: { id: id('EN1') } })).status, 200);
    assert.equal(w.stores.enrollment.docs.length, 3);
  });

  test('an enrollment whose class has been removed is not reachable by an institute account', async () => {
    w.stores.klass.docs = w.stores.klass.docs.filter((d) => String(d._id) !== id('C1'));
    assert.equal((await call(updateEnrollment, { ...w.asInstitute1(), params: { id: id('EN1') }, body: { rollNo: '9' } })).status, 403);
    assert.deepEqual((await call(getAllEnrollments, w.asInstitute1())).body.data, []);
  });
});

describe('summary: institute account', () => {
  test('counts only its own classes and the enrollments in them', async () => {
    const reply = await call(getMadrasaSummary, w.asInstitute1());
    assert.equal(reply.status, 200);
    assert.equal(reply.body.data.totalClasses, 2);
    assert.equal(reply.body.data.activeStudents, 1);
    assert.deepEqual(reply.body.data.byClassType, { tuition: 1, remedial: 1 });
  });

  test('the other institute sees its own numbers, an institute with no class sees zeros', async () => {
    const two = await call(getMadrasaSummary, w.asInstitute2());
    assert.equal(two.body.data.totalClasses, 1);
    assert.equal(two.body.data.activeStudents, 1);
    w.stores.klass.docs = w.stores.klass.docs.filter((d) => String(d.instituteId) !== id('I2'));
    const empty = await call(getMadrasaSummary, w.asInstitute2());
    assert.equal(empty.body.data.totalClasses, 0);
    assert.equal(empty.body.data.activeStudents, 0);
  });
});

describe('classes: institute account A versus institute account B', () => {
  test('each sees only its own', async () => {
    assert.deepEqual(w.idsOf(await call(getAllClasses, w.asInstitute2()).then((r) => r.body)), w.ofIds(w.ids.C2));
    assert.equal((await call(getClassById, { ...w.asInstitute2(), params: { id: id('C1') } })).status, 403);
    assert.deepEqual(w.idsOf((await call(getAllEnrollments, w.asInstitute2())).body), w.ofIds(w.ids.EN2));
  });
});

describe('classes: super admin and Mahallu admin keep the whole Mahallu', () => {
  for (const [label, as] of [
    ['mahall', () => w.asMahall()],
    ['super admin viewing the Mahallu', () => w.asSuperAdmin({ tenantId: String(w.ids.tenantA) })],
  ] as const) {
    test(`${label}: lists every class of the Mahallu including the old one with no institute, not other Mahallus`, async () => {
      const reply = await call(getAllClasses, as());
      assert.deepEqual(w.idsOf(reply.body), w.ofIds(w.ids.C1, w.ids.C1b, w.ids.C2, w.ids.C0));
    });

    test(`${label}: can open any class of the Mahallu, old class included`, async () => {
      for (const target of ['C1', 'C2', 'C0'] as const) {
        assert.equal((await call(getClassById, { ...as(), params: { id: id(target) } })).status, 200, target);
      }
      assert.equal((await call(getClassById, { ...as(), params: { id: id('CX') } })).status, 404);
    });

    test(`${label}: ?instituteId= filters by an institute of the Mahallu`, async () => {
      const one = await call(getAllClasses, { ...as(), query: { instituteId: id('I1') } });
      assert.deepEqual(w.idsOf(one.body), w.ofIds(w.ids.C1, w.ids.C1b));
      const two = await call(getAllClasses, { ...as(), query: { instituteId: id('I2') } });
      assert.deepEqual(w.idsOf(two.body), w.ofIds(w.ids.C2));
    });

    test(`${label}: an institute of another Mahallu or a malformed id is rejected, not silently ignored`, async () => {
      assert.equal((await call(getAllClasses, { ...as(), query: { instituteId: id('IX') } })).status, 400);
      assert.equal((await call(getAllClasses, { ...as(), query: { instituteId: 'nope' } })).status, 400);
    });

    test(`${label}: enrollments, students and summary cover the whole Mahallu`, async () => {
      assert.deepEqual(w.idsOf((await call(getAllEnrollments, as())).body), w.ofIds(w.ids.EN1, w.ids.EN2, w.ids.EN0));
      const students = await call(getClassStudents, { ...as(), params: { id: id('C0') } });
      assert.equal(students.status, 200);
      assert.equal(students.body.data.length, 1);
      const summary = await call(getMadrasaSummary, as());
      assert.equal(summary.body.data.totalClasses, 4);
      assert.equal(summary.body.data.activeStudents, 3);
    });
  }

  test('mahall: creates a Mahallu-level class (no institute) or one for an institute of the Mahallu', async () => {
    const plain = await call(createClass, { ...w.asMahall(), body: { name: 'Plain', academicYear: '2025-26' } });
    assert.equal(plain.status, 201);
    assert.equal(plain.body.data.instituteId, undefined);
    const owned = await call(createClass, { ...w.asMahall(), body: { name: 'Owned', academicYear: '2025-26', instituteId: id('I2'), teacherEmployeeId: id('E2') } });
    assert.equal(owned.status, 201);
    assert.equal(String(owned.body.data.instituteId), id('I2'));
  });

  test('mahall: cannot create a class for an institute or teacher of another Mahallu, or stamp another tenant', async () => {
    const institute = await call(createClass, { ...w.asMahall(), body: { name: 'X', academicYear: '2025-26', instituteId: id('IX') } });
    assert.equal(institute.status, 400);
    const teacher = await call(createClass, { ...w.asMahall(), body: { name: 'X', academicYear: '2025-26', teacherEmployeeId: id('EX') } });
    assert.equal(teacher.status, 400);
    const tenant = await call(createClass, { ...w.asMahall(), body: { name: 'T', academicYear: '2025-26', tenantId: id('tenantB') } });
    assert.equal(tenant.status, 201);
    assert.equal(String(tenant.body.data.tenantId), id('tenantA'));
  });

  test('mahall: can assign, change and clear the institute of a class (old class included)', async () => {
    const assign = await call(updateClass, { ...w.asMahall(), params: { id: id('C0') }, body: { instituteId: id('I1') } });
    assert.equal(assign.status, 200);
    assert.equal(String(w.stores.klass.docs.find((d) => String(d._id) === id('C0')).instituteId), id('I1'));
    // it now belongs to institute 1
    assert.equal((await call(getClassById, { ...w.asInstitute1(), params: { id: id('C0') } })).status, 200);
    assert.equal((await call(getClassById, { ...w.asInstitute2(), params: { id: id('C0') } })).status, 403);
    const clear = await call(updateClass, { ...w.asMahall(), params: { id: id('C0') }, body: { instituteId: '' } });
    assert.equal(clear.status, 200);
    assert.ok(w.stores.klass.docs.find((d) => String(d._id) === id('C0')).instituteId == null, 'back at Mahallu level');
    assert.equal((await call(getClassById, { ...w.asInstitute1(), params: { id: id('C0') } })).status, 403);
    assert.equal((await call(getClassById, { ...w.asMahall(), params: { id: id('C0') } })).status, 200);
    const foreign = await call(updateClass, { ...w.asMahall(), params: { id: id('C0') }, body: { instituteId: id('IX') } });
    assert.equal(foreign.status, 400);
  });

  test('mahall: keeps working on an old class with no institute (update, enrol, delete after emptying)', async () => {
    assert.equal((await call(updateClass, { ...w.asMahall(), params: { id: id('C0') }, body: { name: 'Old, renamed' } })).status, 200);
    assert.equal((await call(createEnrollment, { ...w.asMahall(), body: { classId: id('C0'), memberId: id('M4') } })).status, 201);
    assert.equal((await call(deleteEnrollment, { ...w.asMahall(), params: { id: id('EN0') } })).status, 200);
    assert.equal((await call(updateEnrollment, { ...w.asMahall(), params: { id: id('EN2') }, body: { rollNo: '5' } })).status, 200);
  });

  test('mahall cannot reach another Mahallu\'s class, enrollment or teacher', async () => {
    assert.equal((await call(updateClass, { ...w.asMahall(), params: { id: id('CX') }, body: { name: 'x' } })).status, 404);
    assert.equal((await call(deleteClass, { ...w.asMahall(), params: { id: id('CX') } })).status, 404);
    assert.equal((await call(updateEnrollment, { ...w.asMahall(), params: { id: id('ENX') }, body: { rollNo: '9' } })).status, 404);
    assert.equal((await call(createEnrollment, { ...w.asMahall(), body: { classId: id('CX'), memberId: id('M4') } })).status, 400);
  });
});

});
