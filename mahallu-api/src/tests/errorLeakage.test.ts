import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { looksHumanReadable, toUserMessage, UserFacingError, MESSAGES } from '../utils/userMessages';
import { queryAssistant, MODEL_TIMEOUT_MS } from '../controllers/assistantController';
import { issueCertificateHandler } from '../controllers/certificateController';
import * as certificateService from '../services/certificateService';
import axios from 'axios';
import { PUSH_TIMEOUT_MS, sendPushNotification, sendPushSilent } from '../services/oneSignalService';

/**
 * Error text written for engineers (driver, BSON, runtime, provider, bucket) must never be shown to a
 * person; short plain sentences written as business rules still are.
 */

const LEAKS = [
  // BSON / ObjectId
  'input must be a 24 character hex string, 12 byte Uint8Array, or an integer',
  'BSONError: input must be a 24 character hex string',
  'BSONTypeError: Argument passed in must be a string of 12 bytes',
  'Cast to ObjectId failed for value "abc" (type string) at path "_id" for model "Member"',
  'Argument passed in must be a string of 12 bytes or a string of 24 hex characters',
  // Mongoose / driver
  'Member validation failed: name: Path `name` is required.',
  'E11000 duplicate key error collection: mahallu.members index: tenantId_1_mahallId_1',
  'Cannot populate path `familyId` because it is not in your schema',
  'unknown top level operator: $where',
  'MongoServerError: Authentication failed.',
  'connect ECONNREFUSED 127.0.0.1:27017',
  // JS runtime
  'tool.run is not a function',
  'x is not defined',
  "Cannot read properties of undefined (reading 'map')",
  'Cannot destructure property \'name\' of \'req.body\' as it is undefined.',
  'req.user.memberId is not iterable',
  'Unexpected token < in JSON at position 0',
  'Unexpected end of JSON input',
  'TypeError: fetch failed',
  'RangeError: Invalid time value',
  // HTTP / DNS / abort
  'Request failed with status code 502',
  'timeout of 10000ms exceeded',
  'getaddrinfo ENOTFOUND onesignal.com',
  'socket hang up',
  'The operation was aborted due to timeout',
  'AbortError: This operation was aborted',
  'self-signed certificate in certificate chain',
  'Network Error',
  // providers / storage
  'AI provider error (401): {"error":"invalid key"}',
  'NoSuchBucket: The specified bucket does not exist',
  'AccessDenied: Access Denied',
  'SignatureDoesNotMatch',
  'InvalidAccessKeyId: The AWS Access Key Id you provided does not exist',
  'Failed to upload document to object storage: connect timeout',
  'Missing object storage env vars: DO_SPACES_KEY',
  'S3 putObject failed',
  'Failed to connect to the endpoint',
  // existing guarantees
  'JWT_SECRET is not configured',
  'DXING_SECRET appears to be too short. Check your .env file.',
  'at Object.<anonymous> (C:\\app\\src\\x.ts:10:5)',
  'undefined',
  '',
  'x'.repeat(250),
];

const FRIENDLY = [
  'Please enter the house name.',
  'Registration must be approved before issuing a certificate',
  "We couldn't find that nikah registration. It may have been removed.",
  'Invalid Indian phone number. Provide a 10-digit number with optional +91.',
  'The passwords do not match. Please enter the same password twice.',
  'Date of birth cannot be in the future',
  'A ledger entry needs a valid amount.',
  'Deductions cannot be more than the base salary plus allowances.',
  'Please enter a whole number between 1 and 12 for the month.',
  'This family already has a family head (Ali). A family can only have one head.',
  'You can import up to 500 families at a time. Please split the file.',
  'Maintenance date must be a valid date',
  'The wallet could not be credited.',
];

describe('error text that reaches people', () => {
  test('driver, BSON, runtime, provider and bucket text is never treated as human readable', () => {
    for (const text of LEAKS) assert.equal(looksHumanReadable(text), false, `leaked: ${text.slice(0, 80)}`);
  });

  test('plain business-rule sentences still pass through unchanged', () => {
    for (const text of FRIENDLY) assert.equal(looksHumanReadable(text), true, `blocked: ${text}`);
  });

  test('toUserMessage answers with the action copy for leaky text and keeps the friendly text', () => {
    const fallback = "We couldn't save that. Please try again.";
    for (const text of LEAKS) {
      const shown = toUserMessage(new Error(text), fallback);
      assert.equal(shown, fallback, `shown: ${text.slice(0, 80)}`);
    }
    for (const text of FRIENDLY) assert.equal(toUserMessage(new Error(text), fallback), text);
    assert.equal(toUserMessage(new UserFacingError('Choose a date.'), fallback), 'Choose a date.');
    assert.equal(toUserMessage('plain string', fallback), fallback);
    assert.equal(toUserMessage(undefined, fallback), fallback);
  });

  test('the messages the UI already shows are unchanged', () => {
    assert.equal(MESSAGES.server, 'Something went wrong on our side. Please try again in a moment.');
    assert.equal(MESSAGES.duplicate, 'A record with these details already exists. Please check for a duplicate.');
    const dup = Object.assign(new Error('E11000'), { code: 11000, keyPattern: { phone: 1 } });
    assert.equal(toUserMessage(dup), 'A record with this phone number already exists. Please use a different phone number.');
    assert.equal(
      toUserMessage(new mongoose.Error.CastError('ObjectId', 'x', '_id')),
      "We couldn't find what you were looking for. It may have been removed."
    );
  });
});

describe('controllers do not echo exception text', () => {
  const run = async (fn: any, req: Record<string, any>) => {
    const out: any = { status: 200, body: undefined };
    const res: any = { status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; return res; } };
    await fn({ query: {}, params: {}, body: {}, user: { _id: new mongoose.Types.ObjectId(), name: 'Admin' }, ...req }, res);
    return out;
  };

  const realFetch = globalThis.fetch;
  const realIssue = (certificateService as any).issueCertificate;
  const realError = console.error;
  const oldKey = process.env.OPENROUTER_API_KEY;
  let lastFetchInit: any;

  before(() => {
    process.env.OPENROUTER_API_KEY = 'test-key-not-real';
    console.error = () => undefined; // the real detail is logged on the server; keep the test output clean
  });
  after(() => {
    globalThis.fetch = realFetch;
    (certificateService as any).issueCertificate = realIssue;
    console.error = realError;
    if (oldKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = oldKey;
  });

  const assistantReq = () => ({ tenantId: String(new mongoose.Types.ObjectId()), isSuperAdmin: false, body: { question: 'How many families?' }, user: { _id: new mongoose.Types.ObjectId() } });

  test('assistant: an unexpected failure answers with plain copy, not error.message', async () => {
    for (const text of ['input must be a 24 character hex string', 'x is not a function', 'BSONError: boom']) {
      globalThis.fetch = (async () => { throw new Error(text); }) as any;
      const out = await run(queryAssistant, assistantReq());
      assert.equal(out.status, 500);
      assert.equal(out.body.success, false);
      assert.ok(!out.body.message.includes(text), out.body.message);
      assert.equal(out.body.message, "The assistant couldn't answer that. Please try again.");
    }
  });

  test('assistant: every call to the provider carries a timeout signal, and a timeout answers 504 with plain copy', async () => {
    globalThis.fetch = (async (_url: any, init: any) => {
      lastFetchInit = init;
      throw Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
    }) as any;
    const out = await run(queryAssistant, assistantReq());
    assert.ok(lastFetchInit.signal instanceof AbortSignal, 'fetch is given an AbortSignal');
    assert.equal(MODEL_TIMEOUT_MS, 30_000);
    assert.equal(out.status, 504);
    assert.equal(out.body.code, 'provider_timeout');
    assert.ok(!/abort|timeout of|TimeoutError/i.test(out.body.message), out.body.message);
  });

  test('assistant: a provider error body is logged, never returned', async () => {
    globalThis.fetch = (async () => ({ ok: false, status: 401, text: async () => '{"error":"invalid key sk-or-SECRET"}' })) as any;
    const out = await run(queryAssistant, assistantReq());
    assert.equal(out.status, 502);
    assert.ok(!/sk-or|invalid key|401/.test(JSON.stringify(out.body)));
  });

  test('assistant: a malformed Mahallu id is a 400, not a BSON error leak', async () => {
    const out = await run(queryAssistant, { tenantId: undefined, isSuperAdmin: true, query: { tenantId: 'not-an-id' }, body: { question: 'hi' } });
    assert.equal(out.status, 400);
    assert.ok(!/BSON|hex|24/i.test(out.body.message), out.body.message);
  });

  test('certificate issue: storage / driver failures are plain copy, rule violations keep their words', async () => {
    const req = { tenantId: String(new mongoose.Types.ObjectId()), isSuperAdmin: false, body: { type: 'nikah', registrationId: String(new mongoose.Types.ObjectId()) } };

    (certificateService as any).issueCertificate = async () => { throw new Error('NoSuchBucket: The specified bucket does not exist'); };
    const broken = await run(issueCertificateHandler, req);
    assert.equal(broken.status, 500);
    assert.equal(broken.body.message, "We couldn't issue the certificate. Please try again.");

    (certificateService as any).issueCertificate = async () => { throw new UserFacingError('Registration must be approved before issuing a certificate', 400); };
    const rule = await run(issueCertificateHandler, req);
    assert.equal(rule.status, 400);
    assert.equal(rule.body.message, 'Registration must be approved before issuing a certificate');
  });

  test('certificate issue: a malformed registration id is a 400 before anything runs', async () => {
    (certificateService as any).issueCertificate = async () => { throw new Error('must not be called'); };
    const out = await run(issueCertificateHandler, { tenantId: String(new mongoose.Types.ObjectId()), isSuperAdmin: false, body: { type: 'nikah', registrationId: '{"$ne":null}' } });
    assert.equal(out.status, 400);
  });

  test('the push provider call is bounded by a 10 second timeout and a failure never blocks the caller', async () => {
    assert.equal(PUSH_TIMEOUT_MS, 10_000);
    const realPost = axios.post;
    const oldId = process.env.ONESIGNAL_APP_ID;
    const oldKey = process.env.ONESIGNAL_REST_API_KEY;
    process.env.ONESIGNAL_APP_ID = 'app';
    process.env.ONESIGNAL_REST_API_KEY = 'key';
    const calls: any[] = [];
    try {
      (axios as any).post = async (_url: string, body: any, config: any) => { calls.push({ body, config }); return {}; };
      const accepted = await sendPushNotification({ title: 't', message: 'm', playerIds: ['a', 'b'] });
      assert.equal(accepted, 2);
      assert.equal(calls[0].config.timeout, 10_000);
      assert.deepEqual(calls[0].body.include_subscription_ids, ['a', 'b']);

      // nobody to send to: nothing is sent, and nothing claims it was
      calls.length = 0;
      assert.equal(await sendPushNotification({ title: 't', message: 'm', playerIds: [] }), 0);
      assert.equal(calls.length, 0);

      // a provider failure rejects an awaiting caller (so it can report 'failed') but never the fire-and-forget one
      (axios as any).post = async () => { throw Object.assign(new Error('timeout of 10000ms exceeded'), { code: 'ECONNABORTED' }); };
      await assert.rejects(() => sendPushNotification({ title: 't', message: 'm', playerIds: ['a'] }));
      assert.doesNotThrow(() => sendPushSilent({ title: 't', message: 'm', playerIds: ['a'] }));
      await new Promise((r) => setTimeout(r, 10));
    } finally {
      (axios as any).post = realPost;
      if (oldId === undefined) delete process.env.ONESIGNAL_APP_ID; else process.env.ONESIGNAL_APP_ID = oldId;
      if (oldKey === undefined) delete process.env.ONESIGNAL_REST_API_KEY; else process.env.ONESIGNAL_REST_API_KEY = oldKey;
    }
  });
});
