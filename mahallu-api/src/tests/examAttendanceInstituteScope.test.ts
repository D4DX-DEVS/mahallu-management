import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { listExams, getExamById, createExam, updateExam, deleteExam, updateExamResults } from '../controllers/examController';
import { upsertAttendance, listAttendance, getAttendanceById, getClassProgress } from '../controllers/attendanceController';
import { call } from './support/fakeMongo';
import { makeEducationWorld, EducationWorld } from './support/educationWorld';

// Wrapped in one root suite so the stubs installed by this file's hooks only apply to its own tests
// when every suite is imported into the single `npm test` process.
describe('[isolated] examAttendanceInstituteScope', () => {

/**
 * Exams, attendance sheets and class progress reach their institute through the class. An institute
 * account only touches those of its own institute's classes; a sibling institute's records and those
 * of an old class with no instituteId (Mahallu level) answer 403 by id and are missing from lists.
 * Super admin / Mahallu admin keep the whole Mahallu. (The attendance and exam WRITE routes are
 * super admin / Mahallu admin only today; the handlers still refuse an institute caller defensively.)
 */

let w: EducationWorld;
beforeEach(() => {
  w = makeEducationWorld();
});
afterEach(() => w.restore());

const id = (name: keyof EducationWorld['ids']) => String(w.ids[name]);
const exam = (name: keyof EducationWorld['ids']) => w.stores.exam.docs.find((d) => String(d._id) === id(name));
const sheet = (name: keyof EducationWorld['ids']) => w.stores.attendance.docs.find((d) => String(d._id) === id(name));
const NEW_EXAM = { name: 'Mid term', examDate: '2026-04-01', maxMarks: 50 };

describe('exams: institute account', () => {
  test('list shows only exams of its own classes', async () => {
    const reply = await call(listExams, w.asInstitute1());
    assert.equal(reply.status, 200);
    assert.deepEqual(w.idsOf(reply.body), w.ofIds(w.ids.X1));
    assert.equal(reply.body.pagination.total, 1);
  });

  test('?classId= can only select its own class; ?instituteId= / headers cannot widen the list', async () => {
    assert.deepEqual(w.idsOf((await call(listExams, { ...w.asInstitute1(), query: { classId: id('C1') } })).body), w.ofIds(w.ids.X1));
    for (const target of ['C2', 'C0', 'CX'] as const) {
      const reply = await call(listExams, { ...w.asInstitute1(), query: { classId: id(target) } });
      assert.equal(reply.status, 200, target);
      assert.deepEqual(reply.body.data, [], target);
    }
    const widened = await call(listExams, { ...w.asInstitute1(), query: { instituteId: id('I2') }, headers: { 'x-institute-id': id('I2') } } as any);
    assert.deepEqual(w.idsOf(widened.body), w.ofIds(w.ids.X1));
    assert.equal((await call(listExams, { ...w.asInstitute1(), query: { classId: 'nope' } })).status, 400);
  });

  test('an institute account with no institute is refused', async () => {
    assert.equal((await call(listExams, w.asUnlinkedInstitute())).status, 403);
    assert.equal((await call(listAttendance, w.asUnlinkedInstitute())).status, 403);
  });

  test('get by id: own exam (with its results) 200; sibling / Mahallu-level exam 403; other Mahallu 404', async () => {
    const own = await call(getExamById, { ...w.asInstitute1(), params: { id: id('X1') } });
    assert.equal(own.status, 200);
    assert.equal(own.body.data.results.length, 1);
    assert.equal((await call(getExamById, { ...w.asInstitute1(), params: { id: id('X2') } })).status, 403);
    assert.equal((await call(getExamById, { ...w.asInstitute1(), params: { id: id('X0') } })).status, 403);
    assert.equal((await call(getExamById, { ...w.asInstitute1(), params: { id: id('XX') } })).status, 404);
  });

  test('create: own class allowed; sibling, Mahallu-level and other-Mahallu classes refused', async () => {
    const own = await call(createExam, { ...w.asInstitute1(), body: { ...NEW_EXAM, classId: id('C1') } });
    assert.equal(own.status, 201);
    assert.equal(String(own.body.data.tenantId), id('tenantA'));
    for (const target of ['C2', 'C0', 'CX'] as const) {
      const reply = await call(createExam, { ...w.asInstitute1(), body: { ...NEW_EXAM, classId: id(target) } });
      assert.equal(reply.status, 400, target);
    }
    assert.equal(w.stores.exam.docs.length, 5);
  });

  test('update: own exam works; sibling / Mahallu-level exam refused and untouched', async () => {
    assert.equal((await call(updateExam, { ...w.asInstitute1(), params: { id: id('X1') }, body: { name: 'Renamed' } })).status, 200);
    assert.equal(exam('X1').name, 'Renamed');
    for (const target of ['X2', 'X0'] as const) {
      const reply = await call(updateExam, { ...w.asInstitute1(), params: { id: id(target) }, body: { name: 'Hacked' } });
      assert.equal(reply.status, 403, target);
      assert.notEqual(exam(target).name, 'Hacked', target);
    }
  });

  test('update: cannot move its exam into a sibling / Mahallu-level class', async () => {
    for (const target of ['C2', 'C0', 'CX'] as const) {
      const reply = await call(updateExam, { ...w.asInstitute1(), params: { id: id('X1') }, body: { classId: id(target) } });
      assert.equal(reply.status, 400, target);
    }
    assert.equal(String(exam('X1').classId), id('C1'));
    assert.equal((await call(updateExam, { ...w.asInstitute1(), params: { id: id('X1') }, body: { classId: id('C1b') } })).status, 200);
  });

  test('delete: own exam goes; sibling / Mahallu-level exams are refused and kept', async () => {
    for (const target of ['X2', 'X0'] as const) {
      assert.equal((await call(deleteExam, { ...w.asInstitute1(), params: { id: id(target) } })).status, 403, target);
    }
    assert.equal(w.stores.exam.docs.length, 4);
    assert.equal((await call(deleteExam, { ...w.asInstitute1(), params: { id: id('X1') } })).status, 200);
    assert.equal(w.stores.exam.docs.length, 3);
  });

  test('results: own exam works; sibling / Mahallu-level exam results can be neither read nor replaced', async () => {
    const own = await call(updateExamResults, {
      ...w.asInstitute1(),
      params: { id: id('X1') },
      body: { results: [{ enrollmentId: id('EN1'), marks: 90 }] },
    });
    assert.equal(own.status, 200);
    assert.equal(exam('X1').results[0].marks, 90);
    for (const target of ['X2', 'X0'] as const) {
      const reply = await call(updateExamResults, {
        ...w.asInstitute1(),
        params: { id: id(target) },
        body: { results: [] },
      });
      assert.equal(reply.status, 403, target);
      assert.equal(exam(target).results.length, 1, `${target} results untouched`);
    }
  });

  test('results: an enrollment of another class is refused', async () => {
    const reply = await call(updateExamResults, {
      ...w.asInstitute1(),
      params: { id: id('X1') },
      body: { results: [{ enrollmentId: id('EN2'), marks: 10 }] },
    });
    assert.equal(reply.status, 400);
    assert.equal(exam('X1').results[0].marks, 80);
  });
});

describe('exams: super admin and Mahallu admin', () => {
  for (const [label, as] of [
    ['mahall', () => w.asMahall()],
    ['super admin viewing the Mahallu', () => w.asSuperAdmin({ tenantId: String(w.ids.tenantA) })],
  ] as const) {
    test(`${label}: lists every exam of the Mahallu (old class included), not other Mahallus`, async () => {
      assert.deepEqual(w.idsOf((await call(listExams, as())).body), w.ofIds(w.ids.X1, w.ids.X2, w.ids.X0));
      assert.deepEqual(w.idsOf((await call(listExams, { ...as(), query: { classId: id('C0') } })).body), w.ofIds(w.ids.X0));
    });

    test(`${label}: opens, updates, grades and deletes any exam of the Mahallu, an old class's too`, async () => {
      assert.equal((await call(getExamById, { ...as(), params: { id: id('X0') } })).status, 200);
      assert.equal((await call(getExamById, { ...as(), params: { id: id('XX') } })).status, 404);
      assert.equal((await call(updateExam, { ...as(), params: { id: id('X2') }, body: { name: 'Edited' } })).status, 200);
      assert.equal(exam('X2').name, 'Edited');
      const graded = await call(updateExamResults, { ...as(), params: { id: id('X0') }, body: { results: [{ enrollmentId: id('EN0'), marks: 99 }] } });
      assert.equal(graded.status, 200);
      assert.equal(exam('X0').results[0].marks, 99);
      assert.equal((await call(deleteExam, { ...as(), params: { id: id('X0') } })).status, 200);
      assert.equal((await call(deleteExam, { ...as(), params: { id: id('XX') } })).status, 404);
    });

    test(`${label}: creates an exam for any class of the Mahallu, old class included, but not another Mahallu's`, async () => {
      for (const target of ['C1', 'C2', 'C0'] as const) {
        assert.equal((await call(createExam, { ...as(), body: { ...NEW_EXAM, classId: id(target) } })).status, 201, target);
      }
      assert.equal((await call(createExam, { ...as(), body: { ...NEW_EXAM, classId: id('CX') } })).status, 400);
    });

    test(`${label}: cannot move an exam into another Mahallu's class`, async () => {
      const reply = await call(updateExam, { ...as(), params: { id: id('X1') }, body: { classId: id('CX') } });
      assert.equal(reply.status, 400);
      assert.equal(String(exam('X1').classId), id('C1'));
      assert.equal((await call(updateExam, { ...as(), params: { id: id('X1') }, body: { classId: id('C2') } })).status, 200);
    });
  }
});

describe('attendance: institute account', () => {
  test('list shows only sheets of its own classes; ?classId= can only select one of them', async () => {
    assert.deepEqual(w.idsOf((await call(listAttendance, w.asInstitute1())).body), w.ofIds(w.ids.A1));
    assert.deepEqual(w.idsOf((await call(listAttendance, { ...w.asInstitute1(), query: { classId: id('C1') } })).body), w.ofIds(w.ids.A1));
    for (const target of ['C2', 'C0', 'CX'] as const) {
      const reply = await call(listAttendance, { ...w.asInstitute1(), query: { classId: id(target) } });
      assert.equal(reply.status, 200, target);
      assert.deepEqual(reply.body.data, [], target);
    }
    assert.equal((await call(listAttendance, { ...w.asInstitute1(), query: { classId: 'nope' } })).status, 400);
    assert.deepEqual(w.idsOf((await call(listAttendance, w.asInstitute2())).body), w.ofIds(w.ids.A2));
  });

  test('get by id: own sheet 200; sibling / Mahallu-level sheet 403; other Mahallu 404', async () => {
    assert.equal((await call(getAttendanceById, { ...w.asInstitute1(), params: { id: id('A1') } })).status, 200);
    assert.equal((await call(getAttendanceById, { ...w.asInstitute1(), params: { id: id('A2') } })).status, 403);
    assert.equal((await call(getAttendanceById, { ...w.asInstitute1(), params: { id: id('A0') } })).status, 403);
    assert.equal((await call(getAttendanceById, { ...w.asInstitute1(), params: { id: id('AX') } })).status, 404);
  });

  test('marking: own class works; sibling, Mahallu-level and other-Mahallu classes refused, nothing written', async () => {
    const own = await call(upsertAttendance, {
      ...w.asInstitute1(),
      body: { classId: id('C1'), date: '2026-03-03', records: [{ enrollmentId: id('EN1'), present: false }] },
    });
    assert.equal(own.status, 200);
    assert.equal(w.stores.attendance.docs.length, 5);
    for (const [target, enrollment] of [['C2', 'EN2'], ['C0', 'EN0'], ['CX', 'ENX']] as const) {
      const reply = await call(upsertAttendance, {
        ...w.asInstitute1(),
        body: { classId: id(target), date: '2026-03-03', records: [{ enrollmentId: id(enrollment), present: true }] },
      });
      assert.equal(reply.status, 400, target);
    }
    assert.equal(w.stores.attendance.docs.length, 5);
  });

  test('marking: an enrollment of another class cannot be slipped into its own class sheet', async () => {
    const reply = await call(upsertAttendance, {
      ...w.asInstitute1(),
      body: { classId: id('C1'), date: '2026-03-04', records: [{ enrollmentId: id('EN2'), present: true }] },
    });
    assert.equal(reply.status, 400);
    assert.equal(w.stores.attendance.docs.length, 4);
  });

  test('re-marking the same day updates the sheet instead of adding a second one', async () => {
    await call(upsertAttendance, { ...w.asInstitute1(), body: { classId: id('C1'), date: '2026-03-02', records: [{ enrollmentId: id('EN1'), present: false }] } });
    assert.equal(w.stores.attendance.docs.length, 4);
    assert.equal(sheet('A1').records[0].present, false);
  });
});

describe('attendance: super admin and Mahallu admin', () => {
  for (const [label, as] of [
    ['mahall', () => w.asMahall()],
    ['super admin viewing the Mahallu', () => w.asSuperAdmin({ tenantId: String(w.ids.tenantA) })],
  ] as const) {
    test(`${label}: lists and opens every sheet of the Mahallu (old class included), not other Mahallus`, async () => {
      assert.deepEqual(w.idsOf((await call(listAttendance, as())).body), w.ofIds(w.ids.A1, w.ids.A2, w.ids.A0));
      for (const target of ['A1', 'A2', 'A0'] as const) {
        assert.equal((await call(getAttendanceById, { ...as(), params: { id: id(target) } })).status, 200, target);
      }
      assert.equal((await call(getAttendanceById, { ...as(), params: { id: id('AX') } })).status, 404);
    });

    test(`${label}: marks attendance for any class of the Mahallu, old class included, but not another Mahallu's`, async () => {
      for (const [target, enrollment] of [['C1', 'EN1'], ['C2', 'EN2'], ['C0', 'EN0']] as const) {
        const reply = await call(upsertAttendance, {
          ...as(),
          body: { classId: id(target), date: '2026-03-05', records: [{ enrollmentId: id(enrollment), present: true }] },
        });
        assert.equal(reply.status, 200, target);
      }
      const foreign = await call(upsertAttendance, {
        ...as(),
        body: { classId: id('CX'), date: '2026-03-05', records: [{ enrollmentId: id('ENX'), present: true }] },
      });
      assert.equal(foreign.status, 400);
    });
  }
});

describe('class progress', () => {
  test('institute account: own class 200; sibling / Mahallu-level class 403; other Mahallu 404', async () => {
    const own = await call(getClassProgress, { ...w.asInstitute1(), params: { id: id('C1') } });
    assert.equal(own.status, 200);
    assert.equal(own.body.data.totalStudents, 1);
    assert.equal(own.body.data.students[0].examAverage, 80);
    assert.equal((await call(getClassProgress, { ...w.asInstitute1(), params: { id: id('C2') } })).status, 403);
    assert.equal((await call(getClassProgress, { ...w.asInstitute1(), params: { id: id('C0') } })).status, 403);
    assert.equal((await call(getClassProgress, { ...w.asInstitute1(), params: { id: id('CX') } })).status, 404);
  });

  test('super admin and Mahallu admin: any class of the Mahallu, an old class too', async () => {
    for (const as of [w.asMahall(), w.asSuperAdmin({ tenantId: String(w.ids.tenantA) })]) {
      for (const target of ['C1', 'C2', 'C0'] as const) {
        assert.equal((await call(getClassProgress, { ...as, params: { id: id(target) } })).status, 200, target);
      }
      assert.equal((await call(getClassProgress, { ...as, params: { id: id('CX') } })).status, 404);
    }
  });

  test('an old class with no institute and no children does not crash any list or progress handler', async () => {
    w.stores.enrollment.docs = [];
    w.stores.attendance.docs = [];
    w.stores.exam.docs = [];
    for (const as of [w.asMahall(), w.asInstitute1()]) {
      assert.equal((await call(listExams, as)).status, 200);
      assert.equal((await call(listAttendance, as)).status, 200);
    }
    const progress = await call(getClassProgress, { ...w.asMahall(), params: { id: id('C0') } });
    assert.equal(progress.status, 200);
    assert.equal(progress.body.data.totalStudents, 0);
  });
});

});
