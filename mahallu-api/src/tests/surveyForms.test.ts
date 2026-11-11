import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  SurveyFormContent,
  applyAutoSums,
  buildAutoFillUpdates,
  formatAnswer,
  maxIds,
  normalizeAnswers,
  normalizeFormContent,
  sanitizeAnswers,
  tableTotals,
  validateAnswers,
  validateFieldValue,
  validateFormStructure,
  visibleFieldIds,
} from '../shared/surveyFormEngine';
import { fillStateOf } from '../controllers/surveyFormController';

/**
 * The survey form engine, without a database: the rules every consumer (builder, fill wizard,
 * server submit pipeline, CSV export) relies on.
 */

const form = (): SurveyFormContent => ({
  instructions: ['Keep the ration card ready.'],
  pages: [
    {
      id: 1,
      title: 'Household',
      fields: [
        { id: 1, type: 'heading', label: 'About the house', required: false },
        {
          id: 2,
          type: 'radio',
          label: 'Housing',
          required: true,
          options: [
            { value: 'own', label: 'Own house' },
            { value: 'rent', label: 'Rented' },
          ],
        },
        {
          id: 3,
          type: 'number',
          label: 'Monthly rent',
          required: true,
          validation: { min: 0 },
          condition: { fieldId: 2, operator: 'equals', value: 'rent', action: 'show' },
        },
        { id: 4, type: 'phone', label: 'Contact', required: false, autoFill: 'family.contactNo' },
      ],
    },
    {
      id: 2,
      title: 'Income',
      fields: [
        { id: 5, type: 'number', label: 'Father income', required: false },
        { id: 6, type: 'number', label: 'Mother income', required: false },
        { id: 7, type: 'auto_sum', label: 'Total income', required: false, sumFields: [5, 6] },
        {
          id: 8,
          type: 'table',
          label: 'Expenses',
          required: false,
          table: { columns: [{ title: 'Amount', type: 'number' }], rows: ['Food', 'Rent'], allowAddRows: false, showTotals: true },
        },
        {
          id: 9,
          type: 'multiselect',
          label: 'Needs',
          required: false,
          options: [
            { value: 'edu', label: 'Education' },
            { value: 'med', label: 'Medical' },
          ],
        },
        { id: 10, type: 'checkbox', label: 'Consent given', required: true },
      ],
    },
  ],
});

describe('survey form engine: conditional logic', () => {
  test('a field shows only when its condition matches', () => {
    assert.equal(visibleFieldIds(form(), { field_2: 'own' }).has(3), false);
    assert.equal(visibleFieldIds(form(), { field_2: 'rent' }).has(3), true);
  });

  test('a hidden required field does not block submit, and its stale answer is dropped', () => {
    const answers = sanitizeAnswers(form(), { field_2: 'own', field_3: '9000', field_10: true }, { dropHidden: true });
    assert.equal('field_3' in answers, false);
    assert.deepEqual(validateAnswers(form(), answers), {});
  });

  test('a visible required field is enforced', () => {
    const errors = validateAnswers(form(), { field_2: 'rent', field_10: true });
    assert.ok(errors.field_3);
  });

  test('a draft keeps answers behind a condition, since the respondent may still change it', () => {
    const answers = sanitizeAnswers(form(), { field_2: 'own', field_3: '9000' }, { dropHidden: false });
    assert.equal(answers.field_3, '9000');
  });
});

describe('survey form engine: answers', () => {
  test('a tampered auto-sum is recomputed, commas tolerated', () => {
    const answers = sanitizeAnswers(form(), { field_5: '25,000', field_6: '4500.5', field_7: 1 }, { dropHidden: true });
    assert.equal(answers.field_7, 29500.5);
    assert.equal(applyAutoSums(form(), { field_5: '0.1', field_6: '0.2' }).field_7, 0.3);
  });

  test('unknown keys and wrong shapes never reach the record', () => {
    const answers = sanitizeAnswers(form(), { field_99: 'x', $where: '1', field_9: ['edu', 5, 'edu'], field_10: 'true' }, { dropHidden: false });
    assert.deepEqual(Object.keys(answers).sort(), ['field_10', 'field_7', 'field_9']);
    assert.deepEqual(answers.field_9, ['edu']);
    assert.equal(answers.field_10, true);
  });

  test('choice answers must be one of the options', () => {
    const radio = form().pages[0].fields[1];
    assert.equal(validateFieldValue(radio, 'own'), null);
    assert.ok(validateFieldValue(radio, 'Own house'));
  });

  test('min 0 is enforced (not skipped as falsy)', () => {
    const rent = form().pages[0].fields[2];
    assert.ok(validateFieldValue(rent, '-1'));
    assert.equal(validateFieldValue(rent, '0'), null);
  });

  test('a required checkbox must be ticked', () => {
    const consent = form().pages[1].fields[5];
    assert.ok(validateFieldValue(consent, false));
    assert.equal(validateFieldValue(consent, true), null);
  });

  test('number columns of a table accept numbers only, and totals are computed, never stored', () => {
    const table = form().pages[1].fields[3];
    assert.ok(validateFieldValue(table, [['abc'], ['']]));
    assert.equal(validateFieldValue(table, [['1,200'], ['300']]), null);
    assert.equal(tableTotals(table.table, [['1,200'], ['300']]).grandTotal, 1500);
  });

  test('numbers are stored as numbers after validation', () => {
    assert.equal(normalizeAnswers(form(), { field_5: '25,000' }).field_5, 25000);
  });

  test('answers read as words: option labels, Yes/No, table rows', () => {
    const [, , , , needs, consent] = form().pages[1].fields;
    assert.equal(formatAnswer(needs, ['edu', 'med']), 'Education, Medical');
    assert.equal(formatAnswer(consent, false), 'No');
    assert.equal(formatAnswer(form().pages[1].fields[3], [['10'], ['']]), 'Food: 10');
  });

  test('auto-fill fills only empty answers', () => {
    const record = { family: { contactNo: '9876543210' } };
    assert.deepEqual(buildAutoFillUpdates(form(), record, {}), { field_4: '9876543210' });
    assert.deepEqual(buildAutoFillUpdates(form(), record, { field_4: '9000000000' }), {});
  });
});

describe('survey form engine: form definition', () => {
  test('a complete form is publishable', () => {
    assert.deepEqual(validateFormStructure(form(), { forPublish: true, respondentType: 'family' }), []);
  });

  test('auto-fill needs a survey linked to a family or member', () => {
    const problems = validateFormStructure(form(), { forPublish: true, respondentType: 'none' });
    assert.ok(problems.some((p) => p.includes('auto-fill')));
  });

  test('a condition must point at an earlier field', () => {
    const content = form();
    content.pages[0].fields[1].condition = { fieldId: 3, operator: 'is_not_empty', action: 'show' };
    const problems = validateFormStructure(content, { forPublish: true, respondentType: 'family' });
    assert.ok(problems.some((p) => p.includes('comes before it')));
  });

  test('duplicate field ids are refused even on a draft save', () => {
    const content = form();
    content.pages[1].fields[0].id = 2;
    assert.ok(validateFormStructure(content, { forPublish: false }).length > 0);
  });

  test('an empty choice list and an auto-sum with no sources cannot be published', () => {
    const content = form();
    content.pages[0].fields[1].options = [];
    content.pages[1].fields[2].sumFields = [];
    const problems = validateFormStructure(content, { forPublish: true, respondentType: 'family' });
    assert.ok(problems.some((p) => p.includes('at least one option')));
    assert.ok(problems.some((p) => p.includes('number field to add up')));
  });

  test('normalising drops unknown properties and invalid fields, and reports the ids in use', () => {
    const raw = { pages: [{ id: 3, title: 'P', extra: 1, fields: [{ id: 12, type: 'text', label: 'A', hack: true }, { id: 'x', type: 'text' }, { id: 13, type: 'nope' }] }] };
    const content = normalizeFormContent(raw);
    assert.equal(content.pages[0].fields.length, 1);
    assert.equal('hack' in content.pages[0].fields[0], false);
    assert.deepEqual(maxIds(content), { field: 12, page: 3 });
  });
});

describe('survey fill window', () => {
  const day = (offset: number) => new Date(Date.now() + offset * 24 * 60 * 60 * 1000);
  test('draft, scheduled, open, ended and closed', () => {
    assert.equal(fillStateOf({ status: 'draft', startDate: day(-1), endDate: null, publishedVersion: 0 }), 'draft');
    assert.equal(fillStateOf({ status: 'published', startDate: day(3), endDate: null, publishedVersion: 1 }), 'scheduled');
    assert.equal(fillStateOf({ status: 'published', startDate: day(-3), endDate: day(3), publishedVersion: 1 }), 'open');
    assert.equal(fillStateOf({ status: 'published', startDate: day(-9), endDate: day(-3), publishedVersion: 1 }), 'ended');
    assert.equal(fillStateOf({ status: 'closed', startDate: day(-3), endDate: null, publishedVersion: 1 }), 'closed');
  });
});

describe('survey form engine copies', () => {
  test('the CMS copy is identical to the API copy', () => {
    const api = path.join(__dirname, '..', 'shared', 'surveyFormEngine.ts');
    const cms = path.join(__dirname, '..', '..', '..', 'mahallu-cms', 'src', 'features', 'survey', 'formEngine.ts');
    if (!fs.existsSync(cms)) return; // the API deployed on its own has no CMS beside it
    assert.equal(
      fs.readFileSync(cms, 'utf8'),
      fs.readFileSync(api, 'utf8'),
      'mahallu-cms/src/features/survey/formEngine.ts differs from mahallu-api/src/shared/surveyFormEngine.ts: copy the edited one over the other'
    );
  });
});
