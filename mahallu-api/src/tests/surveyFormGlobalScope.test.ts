import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import SurveyForm from '../models/SurveyForm';
import SurveyFormVersion from '../models/SurveyFormVersion';
import SurveySubmission from '../models/SurveySubmission';
import Family from '../models/Family';
import Member from '../models/Member';
import DocumentFile from '../models/DocumentFile';
import {
  createSubmission,
  createSurvey,
  deleteSubmission,
  deleteSurvey,
  exportSubmissions,
  getBuilder,
  getSubmission,
  getSubmissionFileUrl,
  getSurvey,
  listMySubmissions,
  listSubmissions,
  listSurveys,
  publishSurvey,
  reviewSubmission,
  saveBuilder,
  setSurveyStatus,
  shareSurveyWithAllMahallus,
  updateSubmission,
  updateSurvey,
} from '../controllers/surveyFormController';
import { call, installFake, oid, Installed } from './support/fakeMongo';

// Wrapped in one root suite so the stubs installed by this file's hooks only apply to its own tests
// when every suite is imported into the single `npm test` process.
describe('[isolated] surveyFormGlobalScope', () => {

/**
 * A global survey is ONE form shared with every Mahallu. Each response is stored under the Mahallu
 * that filled it, and nothing about another Mahallu's responses - rows, counts, surveyors, files,
 * CSV lines, the review decision - may reach a Mahallu admin or survey worker. Only the Super Admin
 * changes a global survey.
 */

const A = oid();
const B = oid();
const ADMIN_A = oid();
const ADMIN_B = oid();
const WORKER_A = oid();
const WORKER_B = oid();
const SUPER = oid();

const GLOBAL = oid();
const GLOBAL_V1 = oid();
const GLOBAL_DRAFT = oid();
const FAMILY_SURVEY = oid();
const FAMILY_SURVEY_V1 = oid();
const LOCAL_A = oid();
const LOCAL_A_V1 = oid();
const LOCAL_B = oid();

const SUB_A = oid();
const SUB_B = oid();
const SUB_LOCAL_A = oid();
const DRAFT_B = oid();
const DOC_B = oid();
const FAMILY_A = oid();
const FAMILY_B = oid();

const content = {
  instructions: [],
  pages: [
    {
      id: 1,
      title: 'Page 1',
      fields: [
        { id: 1, type: 'text', label: 'Remarks', required: false },
        { id: 2, type: 'file', label: 'Ration card', required: false },
      ],
    },
  ],
};

const published = { status: 'published', publishedVersion: 1, startDate: new Date('2026-01-01'), endDate: null, revision: 3 };
const surveyRow = (over: Record<string, unknown>) => ({
  type: 'household',
  respondentType: 'none',
  nextFieldId: 3,
  nextPageId: 2,
  hasUnpublishedChanges: false,
  draft: content,
  ...published,
  ...over,
});

const submissionRow = (over: Record<string, unknown>) => ({
  versionId: GLOBAL_V1,
  version: 1,
  status: 'pending',
  answers: { field_1: 'ok' },
  submittedAt: new Date('2026-11-01'),
  history: [],
  attachments: [],
  ...over,
});

let fakes: Installed[] = [];
const store = (i: number) => fakes[i].store.docs;
const surveys = () => store(0);
const versions = () => store(1);
const submissions = () => store(2);

beforeEach(() => {
  fakes = [
    installFake(SurveyForm, [
      surveyRow({ _id: GLOBAL, scope: 'global', tenantId: null, title: 'Zakat Survey', publishedVersionId: GLOBAL_V1 }),
      surveyRow({ _id: GLOBAL_DRAFT, scope: 'global', tenantId: null, title: 'Next year', status: 'draft', publishedVersion: 0 }),
      surveyRow({
        _id: FAMILY_SURVEY,
        scope: 'global',
        tenantId: null,
        title: 'Housing',
        respondentType: 'family',
        publishedVersionId: FAMILY_SURVEY_V1,
      }),
      surveyRow({ _id: LOCAL_A, scope: 'mahallu', tenantId: A, title: 'Only A', publishedVersionId: LOCAL_A_V1 }),
      surveyRow({ _id: LOCAL_B, scope: 'mahallu', tenantId: B, title: 'Only B' }),
    ]),
    installFake(SurveyFormVersion, [
      { _id: GLOBAL_V1, tenantId: null, surveyId: GLOBAL, version: 1, content, respondentType: 'none', publishedAt: new Date() },
      { _id: FAMILY_SURVEY_V1, tenantId: null, surveyId: FAMILY_SURVEY, version: 1, content, respondentType: 'family', publishedAt: new Date() },
      { _id: LOCAL_A_V1, tenantId: A, surveyId: LOCAL_A, version: 1, content, respondentType: 'none', publishedAt: new Date() },
    ]),
    installFake(SurveySubmission, [
      submissionRow({ _id: SUB_A, tenantId: A, surveyId: GLOBAL, submittedBy: WORKER_A, submittedByName: 'Worker A', respondentName: 'House A' }),
      submissionRow({
        _id: SUB_B,
        tenantId: B,
        surveyId: GLOBAL,
        submittedBy: WORKER_B,
        submittedByName: 'Worker B',
        respondentName: 'House B',
        answers: { field_1: 'secret of B', field_2: { documentId: String(DOC_B), fileName: 'b.pdf' } },
        attachments: [DOC_B],
      }),
      submissionRow({ _id: DRAFT_B, tenantId: B, surveyId: GLOBAL, submittedBy: WORKER_B, status: 'draft', submittedAt: null }),
      submissionRow({ _id: SUB_LOCAL_A, tenantId: A, surveyId: LOCAL_A, versionId: LOCAL_A_V1, submittedBy: WORKER_A }),
    ]),
    installFake(Family, [
      { _id: FAMILY_A, tenantId: A, houseName: 'House A', familyHead: 'Head A' },
      { _id: FAMILY_B, tenantId: B, houseName: 'House B', familyHead: 'Head B' },
    ]),
    installFake(Member, []),
    installFake(DocumentFile, [
      { _id: DOC_B, tenantId: B, ownerType: 'survey', ownerId: SUB_B, uploadedByUserId: WORKER_B, fileKey: 'k', fileName: 'b.pdf' },
    ]),
  ];
});
afterEach(() => fakes.forEach((f) => f.restore()));

const mahallAdmin = (tenant: typeof A, id = tenant === A ? ADMIN_A : ADMIN_B) => ({
  user: { _id: id, role: 'mahall', tenantId: tenant, name: 'Admin' },
  tenantId: String(tenant),
  isSuperAdmin: false,
});
const worker = (tenant: typeof A, id = tenant === A ? WORKER_A : WORKER_B) => ({
  user: { _id: id, role: 'survey', tenantId: tenant, name: tenant === A ? 'Worker A' : 'Worker B' },
  tenantId: String(tenant),
  isSuperAdmin: false,
});
const superAdmin = (tenant?: typeof A) => ({
  user: { _id: SUPER, role: 'super_admin', isSuperAdmin: true, name: 'Super' },
  isSuperAdmin: true,
  ...(tenant ? { tenantId: String(tenant) } : {}),
});

const ids = (rows: any[] | undefined) => (rows || []).map((r) => String(r._id)).sort();
const row = (list: any[], id: unknown) => list.find((d) => String(d._id) === String(id));

describe('seeing surveys', () => {
  test('a Mahallu admin sees the published global surveys and their own, never a global draft or another Mahallu\'s', async () => {
    const reply = await call(listSurveys, mahallAdmin(A));
    assert.equal(reply.status, 200);
    assert.deepEqual(ids(reply.body.data), ids([{ _id: GLOBAL }, { _id: FAMILY_SURVEY }, { _id: LOCAL_A }]));
    assert.equal((await call(getSurvey, { ...mahallAdmin(A), params: { id: String(GLOBAL_DRAFT) } })).status, 404);
    assert.equal((await call(getSurvey, { ...mahallAdmin(A), params: { id: String(LOCAL_B) } })).status, 404);
  });

  test('the Super Admin sees every survey, global drafts included', async () => {
    const reply = await call(listSurveys, superAdmin());
    assert.equal(reply.body.data.length, 5);
    const global = await call(listSurveys, { ...superAdmin(), query: { scope: 'global' } });
    assert.deepEqual(ids(global.body.data), ids([{ _id: GLOBAL }, { _id: GLOBAL_DRAFT }, { _id: FAMILY_SURVEY }]));
  });

  test('response counts on a global survey are the caller\'s own Mahallu only', async () => {
    const a = await call(getSurvey, { ...mahallAdmin(A), params: { id: String(GLOBAL) } });
    assert.equal(a.body.data.counts.pending, 1);
    assert.equal(a.body.data.counts.draft, 0);
    const b = await call(getSurvey, { ...mahallAdmin(B), params: { id: String(GLOBAL) } });
    assert.equal(b.body.data.counts.pending, 1);
    assert.equal(b.body.data.counts.draft, 1);
    const list = await call(listSurveys, mahallAdmin(A));
    assert.equal(row(list.body.data, GLOBAL).counts.responses, 1);
    const everyone = await call(getSurvey, { ...superAdmin(), params: { id: String(GLOBAL) } });
    assert.equal(everyone.body.data.counts.pending, 2);
  });

  test('only the Super Admin is told it can manage a global survey', async () => {
    const asAdmin = await call(getSurvey, { ...mahallAdmin(A), params: { id: String(GLOBAL) } });
    assert.equal(asAdmin.body.data.canManage, false);
    assert.equal(asAdmin.body.data.scope, 'global');
    const own = await call(getSurvey, { ...mahallAdmin(A), params: { id: String(LOCAL_A) } });
    assert.equal(own.body.data.canManage, true);
    const asSuper = await call(getSurvey, { ...superAdmin(A), params: { id: String(GLOBAL) } });
    assert.equal(asSuper.body.data.canManage, true);
  });
});

describe('reading responses of a global survey', () => {
  test('a Mahallu admin\'s list, status counts and surveyor filter hold only their Mahallu', async () => {
    for (const [tenant, mine, surveyor] of [
      [A, SUB_A, 'Worker A'],
      [B, SUB_B, 'Worker B'],
    ] as const) {
      const reply = await call(listSubmissions, { ...mahallAdmin(tenant), params: { id: String(GLOBAL) }, query: { status: '' } });
      assert.equal(reply.status, 200);
      assert.deepEqual(ids(reply.body.data), [String(mine)]);
      assert.equal(reply.body.meta.statusCounts.all, 1);
      assert.deepEqual(reply.body.meta.surveyors.map((s: any) => s.name), [surveyor]);
    }
  });

  test('naming the other Mahallu\'s surveyor or family in the filters returns nothing', async () => {
    const bySurveyor = await call(listSubmissions, {
      ...mahallAdmin(A),
      params: { id: String(GLOBAL) },
      query: { submittedBy: String(WORKER_B) },
    });
    assert.deepEqual(bySurveyor.body.data, []);
    assert.equal(bySurveyor.body.meta.statusCounts.all, 0);
  });

  test('the CSV export holds only the caller\'s Mahallu', async () => {
    const reply = await call(exportSubmissions, { ...mahallAdmin(A), params: { id: String(GLOBAL) } });
    assert.equal(reply.status, 200);
    const csv = String(reply.body);
    assert.match(csv, /House A/);
    assert.doesNotMatch(csv, /House B|secret of B/);
    assert.doesNotMatch(csv, /Mahallu/);
  });

  test('the Super Admin reads every Mahallu with none selected, and one Mahallu with one selected', async () => {
    const all = await call(listSubmissions, { ...superAdmin(), params: { id: String(GLOBAL) }, query: { status: '' } });
    assert.deepEqual(ids(all.body.data), ids([{ _id: SUB_A }, { _id: SUB_B }]));
    const csv = await call(exportSubmissions, { ...superAdmin(), params: { id: String(GLOBAL) } });
    assert.match(String(csv.body), /Mahallu/);
    const onlyB = await call(listSubmissions, { ...superAdmin(B), params: { id: String(GLOBAL) }, query: { status: '' } });
    assert.deepEqual(ids(onlyB.body.data), [String(SUB_B)]);
  });

  test('another Mahallu\'s response cannot be opened, reviewed, deleted or have its file read', async () => {
    const admin = mahallAdmin(A);
    assert.equal((await call(getSubmission, { ...admin, params: { subId: String(SUB_B) } })).status, 404);
    assert.equal(
      (await call(reviewSubmission, { ...admin, params: { subId: String(SUB_B) }, body: { decision: 'accepted' } })).status,
      404
    );
    assert.equal((await call(deleteSubmission, { ...admin, params: { subId: String(SUB_B) } })).status, 404);
    assert.equal(
      (await call(getSubmissionFileUrl, { ...admin, params: { subId: String(SUB_B), docId: String(DOC_B) } })).status,
      404
    );
    assert.equal(row(submissions(), SUB_B).status, 'pending');
    assert.equal(submissions().length, 4);
  });

  test('a Mahallu admin reviews their own Mahallu\'s response to a global survey', async () => {
    const reply = await call(reviewSubmission, {
      ...mahallAdmin(A),
      params: { subId: String(SUB_A) },
      body: { decision: 'accepted' },
    });
    assert.equal(reply.status, 200);
    assert.equal(row(submissions(), SUB_A).status, 'accepted');
    assert.equal(row(submissions(), SUB_B).status, 'pending');
  });

  test('a survey worker\'s own list never holds a colleague\'s or another Mahallu\'s responses', async () => {
    const reply = await call(listMySubmissions, { ...worker(B), params: { id: String(GLOBAL) } });
    assert.deepEqual(ids(reply.body.data), ids([{ _id: SUB_B }, { _id: DRAFT_B }]));
    const other = await call(listMySubmissions, { ...worker(A), params: { id: String(GLOBAL) } });
    assert.deepEqual(ids(other.body.data), [String(SUB_A)]);
  });
});

describe('filling a global survey', () => {
  test('a response is stored under the filler\'s Mahallu', async () => {
    const reply = await call(createSubmission, {
      ...worker(A),
      params: { id: String(GLOBAL) },
      body: { submit: true, answers: { field_1: 'new' } },
    });
    assert.equal(reply.status, 201);
    const created = row(submissions(), reply.body.data._id);
    assert.equal(String(created.tenantId), String(A));
    assert.equal(String(created.versionId), String(GLOBAL_V1));
  });

  test('a family from another Mahallu cannot be linked', async () => {
    const reply = await call(createSubmission, {
      ...worker(A),
      params: { id: String(FAMILY_SURVEY) },
      body: { submit: true, familyId: String(FAMILY_B), answers: {} },
    });
    assert.equal(reply.status, 400);
    const own = await call(createSubmission, {
      ...worker(A),
      params: { id: String(FAMILY_SURVEY) },
      body: { submit: true, familyId: String(FAMILY_A), answers: {} },
    });
    assert.equal(own.status, 201);
    assert.equal(String(row(submissions(), own.body.data._id).tenantId), String(A));
  });

  test('another Mahallu\'s uploaded file cannot be attached', async () => {
    const reply = await call(createSubmission, {
      ...worker(A),
      params: { id: String(GLOBAL) },
      body: { submit: true, answers: { field_2: { documentId: String(DOC_B), fileName: 'b.pdf' } } },
    });
    assert.equal(reply.status, 400);
    assert.equal(String(row(store(5), DOC_B).ownerId), String(SUB_B));
  });

  test('a Super Admin with no Mahallu selected is asked to pick one', async () => {
    const reply = await call(createSubmission, { ...superAdmin(), params: { id: String(GLOBAL) }, body: { submit: true, answers: {} } });
    assert.equal(reply.status, 400);
    assert.equal(submissions().length, 4);
  });

  test('another Mahallu\'s draft cannot be continued', async () => {
    const reply = await call(updateSubmission, {
      ...worker(A),
      params: { subId: String(DRAFT_B) },
      body: { submit: true, answers: { field_1: 'taken over' } },
    });
    assert.equal(reply.status, 404);
    assert.equal(row(submissions(), DRAFT_B).status, 'draft');
  });
});

describe('changing a global survey', () => {
  test('a Mahallu admin cannot change, build, publish, close or delete it', async () => {
    const admin = { ...mahallAdmin(A), params: { id: String(GLOBAL) } };
    const before = JSON.stringify(row(surveys(), GLOBAL));
    const replies = await Promise.all([
      call(updateSurvey, { ...admin, body: { title: 'Mine now' } }),
      call(getBuilder, admin),
      call(saveBuilder, { ...admin, body: { draft: content, revision: 3 } }),
      call(publishSurvey, { ...admin, body: { revision: 3 } }),
      call(setSurveyStatus, { ...admin, body: { status: 'closed' } }),
      call(deleteSurvey, admin),
    ]);
    assert.deepEqual(replies.map((r) => r.status), [403, 403, 403, 403, 403, 403]);
    assert.equal(JSON.stringify(row(surveys(), GLOBAL)), before);
    assert.equal(versions().length, 3);
  });

  test('only the Super Admin can create one, with or without a Mahallu selected', async () => {
    const body = { title: 'Census', type: 'household', startDate: '2026-11-01', scope: 'global' };
    assert.equal((await call(createSurvey, { ...mahallAdmin(A), body })).status, 403);
    const created = await call(createSurvey, { ...superAdmin(), body });
    assert.equal(created.status, 201);
    const stored = row(surveys(), created.body.data._id);
    assert.equal(stored.scope, 'global');
    assert.equal(stored.tenantId, null);
  });

  test('the Super Admin changes it while a Mahallu is selected', async () => {
    const reply = await call(updateSurvey, { ...superAdmin(A), params: { id: String(GLOBAL) }, body: { title: 'Zakat Survey 2026' } });
    assert.equal(reply.status, 200);
    assert.equal(row(surveys(), GLOBAL).title, 'Zakat Survey 2026');
  });
});

describe('sharing a Mahallu survey with all Mahallus', () => {
  test('keeps the same survey, form and versions, and its responses stay with their Mahallu', async () => {
    const reply = await call(shareSurveyWithAllMahallus, { ...superAdmin(A), params: { id: String(LOCAL_A) } });
    assert.equal(reply.status, 200);
    const survey = row(surveys(), LOCAL_A);
    assert.equal(survey.scope, 'global');
    assert.equal(survey.tenantId, null);
    assert.equal(survey.title, 'Only A');
    assert.equal(row(versions(), LOCAL_A_V1).tenantId, null);
    assert.equal(String(row(submissions(), SUB_LOCAL_A).tenantId), String(A));

    // Mahallu B now sees and can fill it, but not Mahallu A's response
    const seen = await call(getSurvey, { ...mahallAdmin(B), params: { id: String(LOCAL_A) } });
    assert.equal(seen.status, 200);
    const list = await call(listSubmissions, { ...mahallAdmin(B), params: { id: String(LOCAL_A) }, query: { status: '' } });
    assert.deepEqual(list.body.data, []);
    const mine = await call(listSubmissions, { ...mahallAdmin(A), params: { id: String(LOCAL_A) }, query: { status: '' } });
    assert.deepEqual(ids(mine.body.data), [String(SUB_LOCAL_A)]);
    // and Mahallu A's admin can no longer change it
    assert.equal((await call(updateSurvey, { ...mahallAdmin(A), params: { id: String(LOCAL_A) }, body: { title: 'x' } })).status, 403);
  });

  test('cannot be done twice', async () => {
    const reply = await call(shareSurveyWithAllMahallus, { ...superAdmin(), params: { id: String(GLOBAL) } });
    assert.equal(reply.status, 409);
  });
});

});
