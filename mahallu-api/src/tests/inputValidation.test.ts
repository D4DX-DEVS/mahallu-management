import { test } from 'node:test';
import assert from 'assert/strict';
import { validationResult } from 'express-validator';
import { escapeRegex, regexLiteral, asFilterValue, asObjectId, asNumber, asDate } from '../utils/queryGuard';
import { sanitizeRequest } from '../middleware/sanitizeRequest';
import { detectContentType, safeFileName } from '../utils/fileGuard';
import { tenantMiddleware } from '../middleware/tenantMiddleware';
import mongoose from 'mongoose';
import { capStrings } from '../config/schemaGuards';
import { idParam, listQuery, dateOrder, amountField, phoneField, emailField } from '../validations/common';
import { updateOwnProfileValidation, varisangyaPaymentValidation } from '../validations/memberUserValidation';
import { createExamValidation } from '../validations/moduleValidation';

/**
 * The guards that stand between a request and the database.
 *
 * Each case here is a request that used to get further than it should have:
 * a search term that was a regex, a filter that was an operator, a file that
 * said it was a PNG, a tenant named by the caller.
 */

const OID_A = '507f1f77bcf86cd799439011';
const OID_B = '507f1f77bcf86cd799439012';

/** Runs a validation chain against a request double and returns the messages. */
const runChain = async (chains: any[], req: any): Promise<string[]> => {
  req.body = req.body ?? {};
  req.query = req.query ?? {};
  req.params = req.params ?? {};
  req.headers = req.headers ?? {};
  for (const chain of chains) {
    await chain.run(req);
  }
  return validationResult(req).array().map((e: any) => e.msg as string);
};

const fakeRes = () => {
  const out: any = { status: 200, body: null };
  const res: any = {
    status(code: number) {
      out.status = code;
      return res;
    },
    json(body: any) {
      out.body = body;
      return res;
    },
    __out: out,
  };
  return res;
};

/* ── search terms ──────────────────────────────────────────────────────── */

test('escapeRegex makes every metacharacter literal', () => {
  assert.equal(escapeRegex('a.b*c'), 'a\\.b\\*c');
  assert.equal(escapeRegex('(a+)+$'), '\\(a\\+\\)\\+\\$');
  assert.equal(escapeRegex('[unclosed'), '\\[unclosed');
});

test('an unbalanced bracket is a literal search, not an invalid pattern', () => {
  // `?search=(` used to reach MongoDB as a pattern and answer 500.
  const pattern = regexLiteral('(');
  assert.doesNotThrow(() => new RegExp(pattern));
  assert.equal(new RegExp(pattern).test('a(b'), true);
});

test('a backtracking bomb matches only itself', () => {
  const pattern = regexLiteral('(a+)+$');
  assert.equal(new RegExp(pattern).test('aaaaaaaaaaaaaaaaaaaaaaaa'), false);
  assert.equal(new RegExp(pattern).test('x(a+)+$y'), true);
});

test('a search term is capped, so a megabyte of input is not a megabyte of pattern', () => {
  assert.equal(regexLiteral('a'.repeat(5000)).length, 100);
});

test('a non-string search matches nothing rather than everything', () => {
  // `?search[$ne]=` arrives as an object; `String(obj)` would have been a pattern.
  assert.equal(regexLiteral({ $ne: '' }), '(?!)');
  assert.equal(new RegExp(regexLiteral(undefined)).test('anything'), false);
});

/* ── filter values ─────────────────────────────────────────────────────── */

test('asFilterValue refuses the shapes qs builds from operator syntax', () => {
  assert.equal(asFilterValue({ $ne: 'x' }), undefined);
  assert.equal(asFilterValue(['a', 'b']), undefined);
  assert.equal(asFilterValue('active'), 'active');
  assert.equal(asFilterValue('  active  '), 'active');
  assert.equal(asFilterValue(''), undefined);
  assert.equal(asFilterValue('x'.repeat(300)), undefined);
});

test('asObjectId accepts only a real id', () => {
  assert.equal(asObjectId(OID_A), OID_A);
  assert.equal(asObjectId('not-an-id'), undefined);
  assert.equal(asObjectId({ $ne: null }), undefined);
});

test('asNumber keeps NaN, Infinity and empty strings out of a Number field', () => {
  assert.equal(asNumber('42'), 42);
  assert.equal(asNumber(''), undefined);
  assert.equal(asNumber('abc'), undefined);
  assert.equal(asNumber(Infinity), undefined);
  assert.equal(asNumber('1e999'), undefined);
  assert.equal(asNumber(150, { min: 0, max: 100 }), undefined);
});

test('asDate never returns an Invalid Date', () => {
  assert.equal(asDate('2024-02-30')?.getTime() !== undefined, true); // JS rolls this to Mar 1
  assert.equal(asDate('not a date'), undefined);
  assert.equal(asDate({}), undefined);
});

/* ── operator stripping ────────────────────────────────────────────────── */

test('sanitizeRequest removes operator keys from body, query and params', () => {
  const req: any = {
    method: 'POST',
    originalUrl: '/api/x',
    body: { phone: { $ne: null }, name: 'Aisha' },
    query: { status: { $ne: 'deleted' }, page: '2' },
    params: {},
  };
  sanitizeRequest(req, {} as any, () => undefined);
  assert.deepEqual(req.body, { phone: {}, name: 'Aisha' });
  assert.deepEqual(req.query, { status: {}, page: '2' });
});

test('sanitizeRequest removes dotted keys that reach into a subdocument', () => {
  const req: any = {
    method: 'PUT',
    originalUrl: '/api/x',
    body: { 'permissions.delete': true, name: 'Aisha' },
    query: {},
    params: {},
  };
  sanitizeRequest(req, {} as any, () => undefined);
  assert.deepEqual(req.body, { name: 'Aisha' });
});

test('sanitizeRequest reaches operators nested inside arrays and objects', () => {
  const req: any = {
    method: 'POST',
    originalUrl: '/api/x',
    body: { items: [{ $where: 'sleep(1000)', id: OID_A }], nested: { deep: { $gt: '' } } },
    query: {},
    params: {},
  };
  sanitizeRequest(req, {} as any, () => undefined);
  assert.deepEqual(req.body, { items: [{ id: OID_A }], nested: { deep: {} } });
});

test('sanitizeRequest leaves an ordinary body untouched and calls next', () => {
  let called = false;
  const body = { name: 'Aisha', age: 30, tags: ['a', 'b'], when: new Date(0) };
  const req: any = { method: 'POST', originalUrl: '/api/x', body, query: {}, params: {} };
  sanitizeRequest(req, {} as any, () => {
    called = true;
  });
  assert.equal(called, true);
  assert.deepEqual(req.body, { name: 'Aisha', age: 30, tags: ['a', 'b'], when: new Date(0) });
});

/* ── tenant scope ──────────────────────────────────────────────────────── */

test('a tenantless non-super-admin cannot name a tenant through a header', async () => {
  const req: any = {
    user: { isSuperAdmin: false, tenantId: null },
    headers: { 'x-tenant-id': OID_B },
    query: {},
    body: {},
  };
  await tenantMiddleware(req, fakeRes(), () => undefined);
  assert.equal(req.tenantId, undefined, 'scope must come from the user record, never the request');
});

test('a tenantless non-super-admin cannot name a tenant through query or body', async () => {
  const req: any = {
    user: { isSuperAdmin: false, tenantId: null },
    headers: {},
    query: { tenantId: OID_B },
    body: { tenantId: OID_B },
  };
  await tenantMiddleware(req, fakeRes(), () => undefined);
  assert.equal(req.tenantId, undefined);
});

test('a super admin may still view as a tenant', async () => {
  const req: any = {
    user: { isSuperAdmin: true, tenantId: null },
    headers: { 'x-tenant-id': OID_B },
    query: {},
    body: {},
  };
  await tenantMiddleware(req, fakeRes(), () => undefined);
  assert.equal(req.tenantId, OID_B);
});

test('a malformed tenant header is a 400, not a cast failure downstream', async () => {
  const res = fakeRes();
  const req: any = {
    user: { isSuperAdmin: true, tenantId: null },
    headers: { 'x-tenant-id': 'not-an-id' },
    query: {},
    body: {},
  };
  let nextCalled = false;
  await tenantMiddleware(req, res, () => {
    nextCalled = true;
  });
  assert.equal(res.__out.status, 400);
  assert.equal(nextCalled, false);
});

/* ── uploaded files ────────────────────────────────────────────────────── */

test('detectContentType reads the signature, not the claim', () => {
  assert.equal(detectContentType(Buffer.from([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0])), 'image/jpeg');
  assert.equal(
    detectContentType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])),
    'image/png'
  );
  assert.equal(detectContentType(Buffer.from('%PDF-1.7 rest of file')), 'application/pdf');
  assert.equal(detectContentType(Buffer.from('GIF89a' + 'x'.repeat(20))), 'image/gif');
  assert.equal(
    detectContentType(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')])),
    'image/webp'
  );
});

test('an executable renamed as a PNG is not a PNG', () => {
  // MZ header — a Windows executable sent as image/png.
  assert.equal(detectContentType(Buffer.from('MZ' + 'x'.repeat(30))), null);
});

test('HTML sent as an image is not an image', () => {
  assert.equal(detectContentType(Buffer.from('<html><script>alert(1)</script>')), null);
});

test('an empty or truncated file detects as nothing', () => {
  assert.equal(detectContentType(Buffer.alloc(0)), null);
  assert.equal(detectContentType(Buffer.from([0xff, 0xd8])), null);
});

test('safeFileName strips path traversal down to the filename', () => {
  assert.equal(safeFileName('../../etc/passwd'), 'passwd');
  assert.equal(safeFileName('..\\..\\windows\\system32\\cmd.exe'), 'cmd.exe');
});

test('safeFileName removes markup and control characters', () => {
  assert.equal(safeFileName('<img src=x onerror=alert(1)>.pdf'), 'img src=x onerror=alert(1).pdf');
  assert.equal(safeFileName('re port.pdf'), 'report.pdf');
});

test('safeFileName keeps a double extension visible rather than hiding it', () => {
  assert.equal(safeFileName('invoice.pdf.exe'), 'invoice.pdf.exe');
});

test('safeFileName caps the length and keeps the extension', () => {
  const name = safeFileName('a'.repeat(500) + '.pdf');
  assert.equal(name.length <= 120, true);
  assert.equal(name.endsWith('.pdf'), true);
});

test('safeFileName falls back when there is nothing usable left', () => {
  assert.equal(safeFileName('...'), 'upload');
  assert.equal(safeFileName(undefined), 'upload');
  assert.equal(safeFileName({ toString: () => 'x' } as any), 'upload');
});

/* ── shared field chains ───────────────────────────────────────────────── */

test('idParam rejects a malformed id with copy a person can read', async () => {
  const messages = await runChain([idParam('id', 'family')], { params: { id: 'abc' } });
  assert.deepEqual(messages, ["We couldn't find that family. It may have been removed."]);
});

test('listQuery clamps the page and the page size', async () => {
  assert.deepEqual(await runChain(listQuery(), { query: { page: '2', limit: '50' } }), []);
  const tooBig = await runChain(listQuery(), { query: { limit: '100000' } });
  assert.deepEqual(tooBig, ['Please request between 1 and 100 items at a time.']);
  const negative = await runChain(listQuery(), { query: { page: '-1' } });
  assert.deepEqual(negative, ['Please choose a valid page.']);
});

test('listQuery leaves an absent page and limit alone', async () => {
  assert.deepEqual(await runChain(listQuery(), { query: {} }), []);
  assert.deepEqual(await runChain(listQuery(), { query: { page: '', limit: '' } }), []);
});

test('an amount cannot be negative, absurd, or a word', async () => {
  const chain = [amountField('amount', 'amount', { required: true, min: 1 })];
  assert.deepEqual(await runChain(chain, { body: { amount: 500 } }), []);
  assert.deepEqual(await runChain(chain, { body: { amount: -5 } }), ['Please enter a valid amount.']);
  assert.deepEqual(await runChain(chain, { body: { amount: 1e308 } }), ['Please enter a valid amount.']);
  assert.deepEqual(await runChain(chain, { body: { amount: 'lots' } }), ['Please enter a valid amount.']);
  assert.deepEqual(await runChain(chain, { body: {} }), ['Please enter the amount.']);
});

test('an end date before a start date is refused', async () => {
  const chain = [dateOrder('startDate', 'endDate', 'The end date cannot be before the start date.')];
  assert.deepEqual(
    await runChain(chain, { body: { startDate: '2024-06-01', endDate: '2024-05-01' } }),
    ['The end date cannot be before the start date.']
  );
  assert.deepEqual(await runChain(chain, { body: { startDate: '2024-06-01', endDate: '2024-06-01' } }), []);
  assert.deepEqual(await runChain(chain, { body: { endDate: '2024-06-01' } }), []);
});

test('a phone number is ten digits, not a formatted string', async () => {
  const chain = [phoneField('phone')];
  assert.deepEqual(await runChain(chain, { body: { phone: '9876543210' } }), []);
  assert.deepEqual(await runChain(chain, { body: { phone: '98765 43210' } }), ['Please enter a 10-digit phone number.']);
  assert.deepEqual(await runChain(chain, { body: { phone: '+919876543210' } }), ['Please enter a 10-digit phone number.']);
  assert.deepEqual(await runChain(chain, { body: { phone: '-987654321' } }), ['Please enter a 10-digit phone number.']);
  assert.deepEqual(await runChain(chain, { body: {} }), []);
});

test('an email must be an address, and a short one', async () => {
  const chain = [emailField()];
  assert.deepEqual(await runChain(chain, { body: { email: 'aisha@example.com' } }), []);
  assert.deepEqual(await runChain(chain, { body: { email: 'aisha@@example.com' } }), ['Please enter a valid email address.']);
  assert.deepEqual(await runChain(chain, { body: { email: 'no-at-sign' } }), ['Please enter a valid email address.']);
  assert.deepEqual(
    await runChain(chain, { body: { email: 'a'.repeat(300) + '@example.com' } }),
    ['Please enter a shorter email address.']
  );
});

/* ── member portal ─────────────────────────────────────────────────────── */

test('a member cannot store a phone number that is not one', async () => {
  const messages = await runChain(updateOwnProfileValidation, { body: { phone: 'call me' } });
  assert.deepEqual(messages, ['Please enter a 10-digit phone number.']);
});

test('a member clearing their email is not an error', async () => {
  assert.deepEqual(await runChain(updateOwnProfileValidation, { body: { phone: '', email: '' } }), []);
});

test('a payment cannot be back-dated to the future or sized at 1e308', async () => {
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const messages = await runChain(varisangyaPaymentValidation, {
    body: { amount: 100, paymentDate: future },
  });
  assert.deepEqual(messages, ['The payment date cannot be in the future.']);

  const huge = await runChain(varisangyaPaymentValidation, {
    body: { amount: 1e308, paymentDate: '2024-05-01' },
  });
  assert.equal(huge.length, 1);
  assert.match(huge[0], /^Please enter an amount between/);
});

test('a valid payment passes untouched', async () => {
  assert.deepEqual(
    await runChain(varisangyaPaymentValidation, {
      body: { amount: 250, paymentDate: '2024-05-01', paymentMethod: 'upi', remarks: 'May' },
    }),
    []
  );
});

/* ── cross-field rules ─────────────────────────────────────────────────── */

test('exam marks above the maximum for that exam are refused', async () => {
  const messages = await runChain(createExamValidation, {
    body: {
      classId: OID_A,
      name: 'Term 1',
      examDate: '2024-05-01',
      maxMarks: 50,
      results: [{ enrollmentId: OID_B, marks: 80 }],
    },
  });
  assert.deepEqual(messages, ['Please enter marks between 0 and the maximum for each student.']);
});

test('exam marks within the maximum pass', async () => {
  const messages = await runChain(createExamValidation, {
    body: {
      classId: OID_A,
      name: 'Term 1',
      examDate: '2024-05-01',
      maxMarks: 50,
      results: [{ enrollmentId: OID_B, marks: 45 }],
    },
  });
  assert.deepEqual(messages, []);
});

test('an exam result carrying a malformed enrollment id is refused', async () => {
  const messages = await runChain(createExamValidation, {
    body: {
      classId: OID_A,
      name: 'Term 1',
      examDate: '2024-05-01',
      maxMarks: 50,
      results: [{ enrollmentId: 'oops', marks: 10 }],
    },
  });
  assert.deepEqual(messages, ['Please enter marks between 0 and the maximum for each student.']);
});

/* ── error copy ────────────────────────────────────────────────────────── */

test('no validation message carries developer vocabulary', async () => {
  const cases: Array<[any[], any]> = [
    [[idParam('id', 'member')], { params: { id: 'x' } }],
    [listQuery(), { query: { page: 'abc', limit: '9999' } }],
    [updateOwnProfileValidation, { body: { phone: 'x', email: 'y' } }],
    [varisangyaPaymentValidation, { body: {} }],
    [createExamValidation, { body: {} }],
  ];
  const technical = /objectid|cast to|validationerror|mongo|undefined|\bnull\b|\bNaN\b|[{}[\]<>]/i;
  for (const [chains, req] of cases) {
    const messages = await runChain(chains, req);
    assert.equal(messages.length > 0, true, 'expected this case to fail validation');
    for (const message of messages) {
      assert.equal(technical.test(message), false, `technical copy reached the user: "${message}"`);
      assert.equal(/^[A-Z]/.test(message), true, `message should read as a sentence: "${message}"`);
    }
  }
});

/* -- database floor --------------------------------------------------- */

test('capStrings puts a ceiling on a String path that declares none', () => {
  const schema = new mongoose.Schema({ name: String, notes: { type: String, trim: true } });
  capStrings(schema);
  const doc = new (mongoose.model('CapTestA', schema))({ name: 'x'.repeat(20000), notes: 'ok' });
  const error = doc.validateSync();
  assert.equal(!!error?.errors?.name, true, 'an unbounded String must not stay unbounded');
  assert.equal(error?.errors?.name?.message, 'That entry is too long. Please shorten it and try again.');
});

test('capStrings leaves a field that states its own limit alone', () => {
  const schema = new mongoose.Schema({ code: { type: String, maxlength: [4, 'Please use 4 characters.'] } });
  capStrings(schema);
  const Model = mongoose.model('CapTestB', schema);
  assert.equal(new Model({ code: 'abcd' }).validateSync(), undefined);
  assert.equal(new Model({ code: 'abcde' }).validateSync()?.errors?.code?.message, 'Please use 4 characters.');
});

test('capStrings gives a long-text field more room than a name', () => {
  const schema = new mongoose.Schema({ name: String, description: String });
  capStrings(schema);
  const Model = mongoose.model('CapTestC', schema);
  const long = 'x'.repeat(20000);
  assert.equal(!!new Model({ name: long }).validateSync()?.errors?.name, true);
  assert.equal(new Model({ description: long }).validateSync(), undefined);
});

test('capStrings reaches strings inside a subdocument array', () => {
  const schema = new mongoose.Schema({
    heirs: [new mongoose.Schema({ relation: String })],
  });
  capStrings(schema);
  const doc = new (mongoose.model('CapTestD', schema))({ heirs: [{ relation: 'y'.repeat(20000) }] });
  assert.equal(!!doc.validateSync(), true);
});

test('capStrings accepts an ordinary value untouched', () => {
  const schema = new mongoose.Schema({ name: String });
  capStrings(schema);
  assert.equal(new (mongoose.model('CapTestE', schema))({ name: 'Aisha' }).validateSync(), undefined);
});
