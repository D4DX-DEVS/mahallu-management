import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  MAX_IMPORT_ROWS,
  MAX_ROW_ERRORS_SHOWN,
  extractRowErrors,
  formatRowError,
  formatServerRowErrors,
  parseCsv,
  parseCsvLine,
  type ColumnSpec,
} from '../src/utils/csvImport.ts';
import { safeApiMessage } from '../src/utils/errors.ts';

const COLUMNS: ColumnSpec[] = [
  { key: 'name', label: 'Name', required: true },
  { key: 'gender', label: 'Gender', required: true, normalize: (v) => (/^(male|female)$/i.test(v.trim()) ? { value: v.trim().toLowerCase() } : { error: `Bad gender "${v}".` }) },
  { key: 'age', label: 'Age' },
];

/** A refused import as the API client surfaces it. */
const refused = (errors: unknown, message = 'Some details are missing or incorrect. Please check the form and try again.') =>
  ({ response: { status: 400, data: { success: false, message, errors } } });
const rowErrors = (count: number, start = 1) =>
  Array.from({ length: count }, (_, i) => ({ row: start + i, message: `Please enter the house name (${start + i}).` }));

describe('parseCsvLine', () => {
  test('splits on commas, trims cells, and keeps commas and escaped quotes inside quotes', () => {
    assert.deepEqual(parseCsvLine('a, b ,c'), ['a', 'b', 'c']);
    assert.deepEqual(parseCsvLine('"Smith, John",30,"say ""hi"""'), ['Smith, John', '30', 'say "hi"']);
    assert.deepEqual(parseCsvLine('a,,c'), ['a', '', 'c']);
    assert.deepEqual(parseCsvLine(''), ['']);
  });
});

describe('parseCsv', () => {
  test('reads records by header name, ignoring header case and spaces, and CRLF line ends', () => {
    const result = parseCsv('Name, GENDER ,Age\r\nAhmed Ali,Male,30\r\nFatima,female,\r\n', COLUMNS);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.rows, [
      { name: 'Ahmed Ali', gender: 'male', age: '30' },
      { name: 'Fatima', gender: 'female' },
    ]);
  });

  test('a file without a header and a record row is refused', () => {
    assert.deepEqual(parseCsv('', COLUMNS).errors, ['File needs a header row and at least one data row']);
    assert.deepEqual(parseCsv('name,gender\n', COLUMNS).errors, ['File needs a header row and at least one data row']);
  });

  test('a missing required column stops the whole file and names the column', () => {
    const result = parseCsv('name,age\nAhmed,30\n', COLUMNS);
    assert.deepEqual(result.rows, []);
    assert.deepEqual(result.errors, ['Missing required columns: Gender']);
  });

  test('rows are numbered like a spreadsheet: the header is row 1, so the first record is row 2', () => {
    const result = parseCsv('name,gender\nAhmed,male\n,female\nZainab,\n,\n', COLUMNS);
    assert.deepEqual(result.rows, [{ name: 'Ahmed', gender: 'male' }]);
    assert.deepEqual(result.errors, [
      'Row 3: missing required field(s) Name',
      'Row 4: missing required field(s) Gender',
      'Row 5: is empty',
    ]);
  });

  test('a cell the column refuses fails its row with the column\'s own message; accepted cells are cleaned', () => {
    const result = parseCsv('name,gender\nAhmed,  MALE \nFatima,F\n', COLUMNS);
    assert.deepEqual(result.rows, [{ name: 'Ahmed', gender: 'male' }]);
    assert.deepEqual(result.errors, ['Row 3: Bad gender "F".']);
  });

  test('more than the import limit is reported once, with the count', () => {
    const body = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `Person ${i},male`).join('\n');
    const result = parseCsv(`name,gender\n${body}`, COLUMNS);
    assert.equal(result.rows.length, MAX_IMPORT_ROWS + 1);
    assert.deepEqual(result.errors, [`Maximum ${MAX_IMPORT_ROWS} rows per import (found ${MAX_IMPORT_ROWS + 1})`]);
    assert.equal(parseCsv(`name,gender\n${body.split('\n').slice(0, MAX_IMPORT_ROWS).join('\n')}`, COLUMNS).errors.length, 0, 'exactly the limit is fine');
  });
});

describe('formatServerRowErrors', () => {
  test('lists each refused row, numbered to match the file (the server counts records from 1, the header is row 1)', () => {
    const lines = formatServerRowErrors(refused([{ row: 1, message: 'Please enter a name.' }, { row: 4, message: 'Please choose the gender (male or female).' }]));
    assert.deepEqual(lines, ['Row 2: Please enter a name.', 'Row 5: Please choose the gender (male or female).']);
    assert.equal(formatRowError({ row: 3, message: 'x' }), 'Row 4: x');
  });

  test('puts rows in order even when the server sent them out of order', () => {
    assert.deepEqual(formatServerRowErrors(refused([{ row: 7, message: 'Seven.' }, { row: 2, message: 'Two.' }])), ['Row 3: Two.', 'Row 8: Seven.']);
  });

  test('shows up to 10 errors with no summary line at all when there are exactly 10', () => {
    assert.equal(MAX_ROW_ERRORS_SHOWN, 10);
    const lines = formatServerRowErrors(refused(rowErrors(10)));
    assert.equal(lines.length, 10);
    assert.ok(lines.every((line) => line.startsWith('Row ')), 'no "+N more" line');
  });

  test('11 errors: the first 10 and "+1 more"; 25 errors: the first 10 and "+15 more"', () => {
    const eleven = formatServerRowErrors(refused(rowErrors(11)));
    assert.equal(eleven.length, 11);
    assert.equal(eleven[9], 'Row 11: Please enter the house name (10).');
    assert.equal(eleven[10], '+1 more');

    const twentyFive = formatServerRowErrors(refused(rowErrors(25)));
    assert.equal(twentyFive.length, 11);
    assert.equal(twentyFive[10], '+15 more');
  });

  test('the "+N more" count only includes rows that were usable', () => {
    const mixed = [...rowErrors(12), { row: 'x', message: 'bad row number' }, null, { row: 20 }];
    assert.equal(formatServerRowErrors(refused(mixed)).at(-1), '+2 more');
  });

  test('a caller can ask for a different cap; 0 shows only the count', () => {
    assert.deepEqual(formatServerRowErrors(refused(rowErrors(3)), 2), ['Row 2: Please enter the house name (1).', 'Row 3: Please enter the house name (2).', '+1 more']);
    assert.deepEqual(formatServerRowErrors(refused(rowErrors(3)), 0), ['+3 more']);
  });

  test('an empty error list, or no list at all, gives nothing, so the caller keeps its friendly general message', () => {
    assert.deepEqual(formatServerRowErrors(refused([])), []);
    assert.deepEqual(formatServerRowErrors({ response: { data: { success: false, message: 'Nope.' } } }), []);
    assert.deepEqual(formatServerRowErrors({ response: { data: {} } }), []);
    assert.deepEqual(formatServerRowErrors({ response: {} }), []);
    assert.deepEqual(formatServerRowErrors({}), []);
  });

  test('unexpected payloads never throw and give nothing', () => {
    for (const bad of [undefined, null, 'boom', 42, true, [], new Error('network down'), { response: null }, { response: { data: null } }, { response: { data: 'html page' } }]) {
      assert.deepEqual(formatServerRowErrors(bad), [], String(bad));
    }
    for (const notAList of ['Row 1 is wrong', 5, { row: 1, message: 'x' }, null, true]) {
      assert.deepEqual(formatServerRowErrors(refused(notAList)), [], JSON.stringify(notAList));
    }
  });

  test('malformed entries are skipped one by one while good ones are kept', () => {
    const entries = [
      'just a string', null, 7, [], undefined,
      { row: 1, message: 'Kept one.' },
      { row: '2', message: 'row is a string' },
      { row: 0, message: 'row below 1' },
      { row: -3, message: 'negative row' },
      { row: 2.5, message: 'fractional row' },
      { row: MAX_IMPORT_ROWS + 1, message: 'row beyond the import limit' },
      { row: NaN, message: 'NaN row' },
      { row: 3 },
      { row: 4, message: 99 },
      { row: 5, message: '   ' },
      { row: MAX_IMPORT_ROWS, message: 'Kept two.' },
    ];
    assert.deepEqual(formatServerRowErrors(refused(entries)), ['Row 2: Kept one.', `Row ${MAX_IMPORT_ROWS + 1}: Kept two.`]);
  });

  test('messages that read like developer output or are too long are not shown', () => {
    const unsafe = [
      'ValidationError: members[0].name is required',
      'Cast to ObjectId failed for value "abc"',
      'MongoServerError: E11000 duplicate key',
      'connect ECONNREFUSED 127.0.0.1:27017',
      '{"field":"name"}',
      'see https://internal.example/debug',
      'x'.repeat(161),
      'two\nlines',
    ];
    assert.deepEqual(formatServerRowErrors(refused(unsafe.map((message, i) => ({ row: i + 1, message })))), []);
    assert.deepEqual(formatServerRowErrors(refused([{ row: 1, message: 'x'.repeat(160) }])).length, 1, '160 characters is still fine');
  });

  test('when every entry is unusable the result is empty, so the dialog falls back to the general message', () => {
    assert.deepEqual(formatServerRowErrors(refused([{ row: 'a', message: 'b' }, { msg: 'express-validator style', path: 'members' }])), []);
  });

  test('extractRowErrors trims the message and returns plain { row, message } records', () => {
    assert.deepEqual(extractRowErrors(refused([{ row: 2, message: '  Please enter a name.  ', extra: 'ignored' }])), [{ row: 2, message: 'Please enter a name.' }]);
  });
});

/*
 * csvImport.ts repeats the "safe to show" rule from utils/errors.ts (it cannot import it and stay dependency-free).
 * This keeps the two in step: both rules see the same messages, and csvImport must accept exactly what
 * safeApiMessage accepts, except that it also refuses control characters (so one message stays one line).
 */
describe('the safe-message rule stays in step with utils/errors.ts', () => {
  const sharedAccepts = (message: unknown) => safeApiMessage({ response: { data: { message } } }, '') !== '';
  const csvImportAccepts = (message: unknown) => extractRowErrors(refused([{ row: 1, message }])).length === 1;
  // eslint-disable-next-line no-control-regex
  const hasControlCharacter = (message: unknown) => typeof message === 'string' && /[\u0000-\u001f\u007f]/.test(message.trim());

  const sharedCorpus: unknown[] = [
    // ordinary sentences, including the server's own wording, other scripts, apostrophes and digits
    'Please enter the house name.', 'Please choose the gender (male or female).', 'Please enter a name.', 'Row 3 is wrong',
    'We couldn’t read that file. Please check the columns and try again.', "We couldn't find that family.", 'അഹമ്മദ് എന്ന പേര് നൽകുക.', 'Use 4 to 30 characters.',
    // one message for each pattern the rule rejects, in lower, mixed and upper case
    'Cast to ObjectId failed', 'CAST TO number failed', 'bad ObjectId value', 'ValidationError: name is required', 'connect ECONNREFUSED 127.0.0.1:27017',
    'getaddrinfo ENOTFOUND db.example', 'MongoServerError: E11000', 'a mongo problem', 'prisma client failed', 'value is undefined', 'value is null', 'Annulled record',
    'at Object.run (file.js:1:1)', 'at Module._compile', '{"a":1}', 'has } in it', 'list [1,2]', 'has ] in it', '<b>bold</b>', 'a > b', 'see http://x.example', 'see HTTPS://x.example',
    'Error: boom', 'TypeError: x is not a function', 'ERROR: shouting',
    // length and whitespace edges
    'x'.repeat(159), 'x'.repeat(160), 'x'.repeat(161), ` ${'x'.repeat(160)} `, ` ${'x'.repeat(161)} `, '', ' ', '   \t  ', '  padded  ',
    // values that are not strings at all
    42, 0, true, false, null, undefined, {}, [], ['Please enter a name.'], () => 'Please enter a name.',
  ];
  const controlCharacterCorpus: unknown[] = [
    'two\nlines', 'carriage\rreturn', 'tab\tinside', 'nul\u0000byte', 'bell\u0007', 'escape\u001b[0m', 'delete\u007f', 'a\u0008b',
    'trailing newline\n', '\ttrailing tab', 'Please enter the house name.\r\n',
  ];

  test('on every message, csvImport accepts exactly what safeApiMessage accepts, except control characters', () => {
    for (const message of [...sharedCorpus, ...controlCharacterCorpus]) {
      const expected = sharedAccepts(message) && !hasControlCharacter(message);
      assert.equal(csvImportAccepts(message), expected, `message ${JSON.stringify(message)}`);
    }
  });

  test('the corpus really exercises both outcomes (so the comparison above cannot pass by accident)', () => {
    const accepted = sharedCorpus.filter(sharedAccepts).length;
    const refused = sharedCorpus.length - accepted;
    assert.ok(accepted >= 10, `only ${accepted} messages are accepted`);
    assert.ok(refused >= 25, `only ${refused} messages are refused`);
  });

  test('the one deliberate difference: a control character inside a message that safeApiMessage would allow', () => {
    for (const message of ['two\nlines', 'tab\tinside', 'bell\u0007', 'delete\u007f']) {
      assert.equal(sharedAccepts(message), true, `safeApiMessage still allows ${JSON.stringify(message)}`);
      assert.equal(csvImportAccepts(message), false, `csvImport refuses ${JSON.stringify(message)}`);
    }
    // control characters only at the edges are trimmed away by both, so they do not count
    assert.equal(csvImportAccepts('Please enter a name.\n'), true);
  });

  // A message corpus cannot notice a NEW forbidden word that none of its messages contains, so the two
  // rejection patterns are also compared as text.
  test('the rejection pattern in csvImport.ts is the same text as the one in utils/errors.ts', () => {
    const patternIn = (relative: string) => {
      const source = fs.readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
      return /return !\/(.+?)\/i\.test\(/s.exec(source)?.[1];
    };
    const shared = patternIn('../src/utils/errors.ts');
    const csvImport = patternIn('../src/utils/csvImport.ts');
    assert.ok(shared && shared.length > 50, 'found the pattern in utils/errors.ts');
    assert.ok(csvImport && csvImport.length > 50, 'found the pattern in utils/csvImport.ts');
    assert.equal(csvImport, shared);
  });
});
