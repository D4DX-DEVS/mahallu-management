import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Announcement from '../models/Announcement';
import Notification from '../models/Notification';
import Family from '../models/Family';
import * as oneSignal from '../services/oneSignalService';
import * as dxing from '../services/dxingService';
import { sendAnnouncement, maxRecipients } from '../controllers/announcementController';

/**
 * Sending an announcement:
 *   - one send at a time (atomic claim draft -> sending), a second one gets 409;
 *   - 'sent' only if something was really delivered, otherwise the claim goes back to 'draft' and the
 *     answer is a 422 with the per-channel results stored;
 *   - an audience that cannot be honoured sends NOTHING (no fallback to a wider audience);
 *   - the WhatsApp fan-out is capped and runs with bounded concurrency;
 *   - provider error text never reaches the results or the response.
 */

const oid = () => new mongoose.Types.ObjectId();
const TENANT = oid();
const OTHER_TENANT = oid();
const ID = oid();

let doc: any;
let familyQueries: any[] = [];
let families: Array<{ contactNo?: string }> = [];
let pushCalls = 0;
let pushImpl: () => Promise<number> = async () => 3;
let whatsappImpl: (phone: string) => Promise<void> = async () => undefined;
let whatsappCalls: string[] = [];
let inFlight = 0;
let maxInFlight = 0;
let notifications = 0;

const matches = (d: any, f: any): boolean => {
  if (f._id !== undefined && String(f._id) !== String(d._id)) return false;
  if (f.tenantId !== undefined && String(f.tenantId) !== String(d.tenantId)) return false;
  if (f.status !== undefined && f.status !== d.status) return false;
  if (f.$or && !f.$or.some((alt: any) => matches(d, alt))) return false;
  if (f.sendingStartedAt?.$lt && !(d.sendingStartedAt && d.sendingStartedAt < f.sendingStartedAt.$lt)) return false;
  return true;
};

const saved: Array<[any, string, any]> = [];
const stub = (target: any, key: string, impl: any) => {
  saved.push([target, key, target[key]]);
  target[key] = impl;
};

const newDoc = (over: Record<string, any> = {}) => ({
  _id: ID,
  tenantId: TENANT,
  title: 'Eid prayer',
  body: 'Prayer at 8 am',
  category: 'announcement',
  audience: 'all',
  audienceRefIds: [],
  channels: ['push'],
  status: 'draft',
  ...over,
});

const send = async (req: Record<string, any> = {}) => {
  const out: any = { status: 200, body: undefined };
  const res: any = { status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; return res; } };
  await sendAnnouncement(
    { params: { id: String(ID) }, query: {}, body: {}, tenantId: String(TENANT), isSuperAdmin: false, user: { role: 'mahall', _id: oid() }, ...req } as any,
    res
  );
  return out;
};

describe('announcement send', () => {
  beforeEach(() => {
    stub(Announcement, 'findOneAndUpdate', async (filter: any, update: any) => {
      await Promise.resolve();
      if (!doc || !matches(doc, filter)) return null;
      const set = update.$set ?? update;
      Object.assign(doc, set);
      for (const key of Object.keys(update.$unset ?? {})) delete doc[key];
      return { ...doc };
    });
    stub(Announcement, 'findOne', (filter: any) => {
      const found = doc && matches(doc, filter) ? { ...doc } : null;
      return Object.assign(Promise.resolve(found), { select: async () => found });
    });
    stub(Family, 'find', (query: any) => {
      familyQueries.push(query);
      const chain: any = { select: () => chain, sort: () => chain, limit: (n: number) => { chain.n = n; return chain; }, lean: async () => families.slice(0, chain.n) };
      return chain;
    });
    stub(Notification, 'create', async () => { notifications += 1; return {}; });
    stub(oneSignal, 'getTenantPlayerIds', async () => ['p1', 'p2', 'p3']);
    stub(oneSignal, 'sendPushNotification', async () => { pushCalls += 1; return pushImpl(); });
    stub(dxing, 'sendWhatsAppMessage', async (phone: string) => {
      whatsappCalls.push(phone);
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      try {
        await new Promise((r) => setTimeout(r, 2));
        await whatsappImpl(phone);
      } finally {
        inFlight -= 1;
      }
    });
  });
  afterEach(() => {
    for (const [target, key, value] of saved.reverse()) target[key] = value;
    delete process.env.ANNOUNCEMENT_MAX_RECIPIENTS;
    saved.length = 0;
  });
  beforeEach(() => {
    doc = newDoc();
    familyQueries = [];
    families = [{ contactNo: '9876543210' }, { contactNo: '9876543211' }, { contactNo: '9876543212' }];
    pushCalls = 0;
    pushImpl = async () => 3;
    whatsappImpl = async () => undefined;
    whatsappCalls = [];
    inFlight = 0;
    maxInFlight = 0;
    notifications = 0;
    delete process.env.ANNOUNCEMENT_MAX_RECIPIENTS;
  });

  test('a single send delivers, marks the announcement sent and keeps the response shape', async () => {
    const out = await send();
    assert.equal(out.status, 200);
    assert.equal(out.body.success, true);
    assert.equal(out.body.data.status, 'sent');
    assert.ok(out.body.data.sentAt);
    assert.equal(out.body.data.deliveryResults.push, 'sent');
    assert.equal(doc.sendingStartedAt, undefined, 'the claim marker is cleared');
    assert.equal(notifications, 1);
  });

  test('double send: two sends at once deliver ONCE, the other gets 409', async () => {
    const [a, b] = await Promise.all([send(), send()]);
    const statuses = [a.status, b.status].sort();
    assert.deepEqual(statuses, [200, 409]);
    assert.equal(pushCalls, 1);
    const loser = a.status === 409 ? a : b;
    assert.match(loser.body.message, /already being sent|already been sent/i);
  });

  test('sending an announcement that was already sent answers 409 and sends nothing', async () => {
    doc.status = 'sent';
    const out = await send();
    assert.equal(out.status, 409);
    assert.match(out.body.message, /already been sent/i);
    assert.equal(pushCalls, 0);
  });

  test('an announcement of another Mahallu is not found and is never claimed', async () => {
    doc.tenantId = OTHER_TENANT;
    const out = await send();
    assert.equal(out.status, 404);
    assert.equal(doc.status, 'draft');
    assert.equal(pushCalls, 0);
  });

  test('every channel failed: 422, the claim goes back to draft, results are stored without provider text', async () => {
    doc.channels = ['push', 'whatsapp'];
    pushImpl = async () => { throw new Error('OneSignal 401 invalid app key sk_live_SECRET'); };
    whatsappImpl = async () => { throw new Error('DXING secret=abc rejected 9876543210'); };
    const out = await send();
    assert.equal(out.status, 422);
    assert.equal(out.body.success, false);
    assert.equal(doc.status, 'draft', 'released so it can be sent again');
    assert.equal(doc.sentAt, undefined);
    assert.deepEqual(doc.deliveryResults, { push: 'failed', whatsapp: 'failed' });
    assert.ok(!/secret|sk_live|OneSignal|DXING|9876543210/i.test(JSON.stringify(out.body)));
    assert.match(out.body.message, /draft/i);
  });

  test('a released draft can be sent again', async () => {
    pushImpl = async () => { throw new Error('boom'); };
    assert.equal((await send()).status, 422);
    pushImpl = async () => 3;
    const again = await send();
    assert.equal(again.status, 200);
    assert.equal(doc.status, 'sent');
  });

  test('nobody to reach (no registered devices, no phone numbers) is not a successful send either', async () => {
    doc.channels = ['push', 'whatsapp'];
    pushImpl = async () => 0;
    families = [];
    const out = await send();
    assert.equal(out.status, 422);
    assert.equal(doc.status, 'draft');
    assert.deepEqual(doc.deliveryResults, { push: 'no_recipients', whatsapp: 'no_recipients' });
  });

  test('partial success: one channel delivered, the other failed -> sent, with honest per-channel results', async () => {
    doc.channels = ['push', 'whatsapp'];
    pushImpl = async () => { throw new Error('provider down'); };
    whatsappImpl = async (phone) => { if (phone.endsWith('2')) throw new Error('bad number'); };
    const out = await send();
    assert.equal(out.status, 200);
    assert.equal(doc.status, 'sent');
    assert.equal(doc.deliveryResults.push, 'failed');
    assert.equal(doc.deliveryResults.whatsapp, 'sent to 2/3');
    assert.equal(notifications, 0, 'no in-app broadcast when the push did not go out');
  });

  test('sms / email stay not_configured and alone deliver nothing', async () => {
    doc.channels = ['sms', 'email'];
    const out = await send();
    assert.equal(out.status, 422);
    assert.deepEqual(doc.deliveryResults, { sms: 'not_configured', email: 'not_configured' });
  });

  for (const audience of ['committee', 'custom'] as const) {
    test(`audience "${audience}" sends nothing on push or WhatsApp and is not marked sent`, async () => {
      doc.audience = audience;
      doc.channels = ['push', 'whatsapp'];
      const out = await send();
      assert.equal(out.status, 422);
      assert.equal(pushCalls, 0);
      assert.deepEqual(whatsappCalls, []);
      assert.deepEqual(familyQueries, [], 'no family list is even read');
      assert.deepEqual(doc.deliveryResults, { push: 'not_supported', whatsapp: 'not_supported' });
      assert.equal(doc.status, 'draft');
      assert.match(out.body.message, /can't reach this audience/i);
    });
  }

  test('cluster audience with NO clusters chosen does not fall back to every family', async () => {
    doc.audience = 'cluster';
    doc.audienceRefIds = [];
    doc.channels = ['push', 'whatsapp'];
    const out = await send();
    assert.equal(out.status, 422);
    assert.deepEqual(whatsappCalls, []);
    assert.deepEqual(familyQueries, []);
    assert.equal(pushCalls, 0);
    assert.deepEqual(doc.deliveryResults, { push: 'not_supported', whatsapp: 'not_supported' });
  });

  test('cluster audience with clusters: WhatsApp reaches only those clusters of this Mahallu; push (tenant-wide) is not supported', async () => {
    const cluster = oid();
    doc.audience = 'cluster';
    doc.audienceRefIds = [cluster];
    doc.channels = ['push', 'whatsapp'];
    const out = await send();
    assert.equal(out.status, 200);
    assert.equal(familyQueries.length, 1);
    assert.equal(String(familyQueries[0].tenantId), String(TENANT));
    assert.deepEqual(familyQueries[0].clusterId.$in.map(String), [String(cluster)]);
    assert.equal(pushCalls, 0);
    assert.equal(doc.deliveryResults.push, 'not_supported');
    assert.equal(doc.deliveryResults.whatsapp, 'sent to 3/3');
  });

  test('audience "families" reaches every family of the Mahallu, de-duplicating shared numbers', async () => {
    doc.audience = 'families';
    doc.channels = ['whatsapp'];
    families = [{ contactNo: '98765 43210' }, { contactNo: '+91 9876543210' }, { contactNo: '9876543211' }, { contactNo: '' }, {}];
    const out = await send();
    assert.equal(out.status, 200);
    assert.equal(whatsappCalls.length, 2);
    assert.equal(doc.deliveryResults.whatsapp, 'sent to 2/2');
    assert.equal(familyQueries[0].clusterId, undefined);
  });

  test('the recipient cap is respected (ANNOUNCEMENT_MAX_RECIPIENTS) and the result says so', async () => {
    process.env.ANNOUNCEMENT_MAX_RECIPIENTS = '4';
    doc.channels = ['whatsapp'];
    families = Array.from({ length: 12 }, (_, i) => ({ contactNo: `98765432${String(i).padStart(2, '0')}` }));
    const out = await send();
    assert.equal(out.status, 200);
    assert.equal(whatsappCalls.length, 4);
    assert.match(doc.deliveryResults.whatsapp, /^sent to 4\/4 \(limited to 4 recipients per send\)$/);
  });

  test('the default cap is 500 and a bad ANNOUNCEMENT_MAX_RECIPIENTS falls back to it', () => {
    assert.equal(maxRecipients({}), 500);
    assert.equal(maxRecipients({ ANNOUNCEMENT_MAX_RECIPIENTS: 'abc' }), 500);
    assert.equal(maxRecipients({ ANNOUNCEMENT_MAX_RECIPIENTS: '0' }), 500);
    assert.equal(maxRecipients({ ANNOUNCEMENT_MAX_RECIPIENTS: '-3' }), 500);
    assert.equal(maxRecipients({ ANNOUNCEMENT_MAX_RECIPIENTS: '25' }), 25);
  });

  test('WhatsApp goes out with small bounded concurrency, not strictly one by one and not all at once', async () => {
    doc.channels = ['whatsapp'];
    families = Array.from({ length: 30 }, (_, i) => ({ contactNo: `98765432${String(i).padStart(2, '0')}` }));
    const out = await send();
    assert.equal(out.status, 200);
    assert.equal(whatsappCalls.length, 30);
    assert.ok(maxInFlight > 1, `expected overlap, saw ${maxInFlight}`);
    assert.ok(maxInFlight <= 5, `expected at most 5 at a time, saw ${maxInFlight}`);
  });

  test('a stale claim (crashed send) can be taken over; a fresh one cannot', async () => {
    doc.status = 'sending';
    doc.sendingStartedAt = new Date();
    assert.equal((await send()).status, 409);
    doc.sendingStartedAt = new Date(Date.now() - 60 * 60 * 1000);
    assert.equal((await send()).status, 200);
  });

  test('an unexpected failure while sending releases the claim instead of leaving it stuck', async () => {
    doc.channels = ['whatsapp'];
    (Family as any).find = () => { throw new Error('mongo exploded: mongodb://user:pw@host'); };
    try {
      const out = await send();
      // the channel catches it and reports a failed channel
      assert.equal(out.status, 422);
      assert.equal(doc.status, 'draft');
      assert.equal(doc.deliveryResults.whatsapp, 'failed');
      assert.ok(!/mongodb:|pw@/.test(JSON.stringify(out.body)));
    } finally {
      stub(Family, 'find', (query: any) => {
        familyQueries.push(query);
        const chain: any = { select: () => chain, sort: () => chain, limit: () => chain, lean: async () => families };
        return chain;
      });
    }
  });
});
