import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import Notification from '../models/Notification';
import User from '../models/User';
import Member from '../models/Member';
import Family from '../models/Family';
import Committee from '../models/Committee';
import { createNotification, getAllNotifications } from '../controllers/notificationController';
import { registerDevice } from '../controllers/authController';
import { ONESIGNAL_URL, sendPushToUsers } from '../services/oneSignalService';
import { installFake, oid, Installed } from './support/fakeMongo';

/**
 * POST /notifications saves the record, then pushes it through OneSignal to the people it targets
 * (inside the same Mahallu), addressed by user id (external_id, set by OneSignal.login on the device),
 * falling back to the device id saved by PUT /auth/register-device. The push outcome is stored on the
 * record and a failed push never fails the request.
 */

const T1 = oid();
const T2 = oid();
const FAMILY = oid();
const COMMITTEE = oid();
const ADMIN = { _id: oid(), phone: '9000000001', role: 'mahall', tenantId: T1, status: 'active' };
const M_A = oid();
const M_B = oid();
const M_C = oid();
const U_A = { _id: oid(), phone: '9000000002', role: 'member', tenantId: T1, memberId: M_A, status: 'active', oneSignalPlayerId: 'player-a' };
const U_B = { _id: oid(), phone: '9000000003', role: 'member', tenantId: T1, memberId: M_B, status: 'active' };
const U_C = { _id: oid(), phone: '9000000004', role: 'member', tenantId: T1, memberId: M_C, status: 'active' };
const U_FOREIGN = { _id: oid(), phone: '9000000005', role: 'member', tenantId: T2, status: 'active', oneSignalPlayerId: 'player-x' };

const call = async (fn: any, req: Record<string, any>) => {
  const out: any = { status: 200, body: undefined };
  const res: any = { status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; return res; } };
  await fn({ params: {}, query: {}, body: {}, user: ADMIN, tenantId: String(T1), isSuperAdmin: false, ...req }, res);
  return out;
};

describe('notification push', () => {
  const fakes: Installed[] = [];
  let posts: Array<{ url: string; body: any; config: any }> = [];
  let reply: (body: any) => any;
  const realPost = axios.post;
  const env = { id: process.env.ONESIGNAL_APP_ID, key: process.env.ONESIGNAL_REST_API_KEY };

  beforeEach(() => {
    process.env.ONESIGNAL_APP_ID = 'app-1';
    process.env.ONESIGNAL_REST_API_KEY = 'os_v2_app_secret';
    posts = [];
    reply = () => ({ data: { id: 'os-1' } });
    (axios as any).post = async (url: string, body: any, config: any) => {
      posts.push({ url, body, config });
      return reply(body);
    };
    fakes.push(
      installFake(User, [ADMIN, U_A, U_B, U_C, U_FOREIGN]),
      installFake(Member, [
        { _id: M_A, tenantId: T1, familyId: FAMILY, status: 'active' },
        { _id: M_B, tenantId: T1, familyId: FAMILY, status: 'active' },
        { _id: M_C, tenantId: T1, familyId: oid(), status: 'active' },
      ]),
      installFake(Family, [{ _id: FAMILY, tenantId: T1 }]),
      installFake(Committee, [{ _id: COMMITTEE, tenantId: T1, members: [M_C] }]),
      installFake(Notification, [])
    );
  });
  afterEach(() => {
    fakes.splice(0).forEach((f) => f.restore());
    (axios as any).post = realPost;
    if (env.id === undefined) delete process.env.ONESIGNAL_APP_ID; else process.env.ONESIGNAL_APP_ID = env.id;
    if (env.key === undefined) delete process.env.ONESIGNAL_REST_API_KEY; else process.env.ONESIGNAL_REST_API_KEY = env.key;
  });

  const stored = () => (fakes[4] as Installed).store.docs[0];
  const targeted = () => posts.flatMap((p) => p.body.include_aliases?.external_id ?? []).sort();

  test('a broadcast pushes to every active user of the Mahallu (never another Mahallu) by external_id', async () => {
    const out = await call(createNotification, { body: { recipientType: 'all', title: 'Eid', message: 'Eid Mubarak', imageUrl: 'https://cdn/x.png' } });
    assert.equal(out.status, 201);
    assert.equal(posts.length, 1);
    const { url, body, config } = posts[0];
    assert.equal(url, ONESIGNAL_URL);
    assert.equal(config.headers.Authorization, 'Key os_v2_app_secret');
    assert.equal(body.app_id, 'app-1');
    assert.deepEqual(targeted(), [ADMIN, U_A, U_B, U_C].map((u) => String(u._id)).sort());
    assert.deepEqual(body.headings, { en: 'Eid' });
    assert.deepEqual(body.contents, { en: 'Eid Mubarak' });
    assert.equal(body.big_picture, 'https://cdn/x.png');
    assert.deepEqual(body.data, { type: 'notification', notificationId: String(stored()._id), notificationType: 'info' });

    assert.equal(stored().pushStatus, 'sent');
    assert.deepEqual(stored().pushIds, ['os-1']);
    assert.equal(stored().pushRecipients, 4);
    assert.equal(out.body.data.pushStatus, 'sent');
  });

  test('a house (family) reaches the users of its members; the notification lands in their inboxes', async () => {
    const out = await call(createNotification, { body: { recipientType: 'family', recipientId: String(FAMILY), title: 'House', message: 'm' } });
    assert.equal(out.status, 201);
    assert.deepEqual(targeted(), [U_A, U_B].map((u) => String(u._id)).sort());

    const inbox = await call(getAllNotifications, { user: U_B });
    assert.equal(inbox.body.data.length, 1);
    assert.equal(inbox.body.data[0].recipientIds, undefined, 'the audience list is never exposed');
    const outsider = await call(getAllNotifications, { user: U_C });
    assert.equal(outsider.body.data.length, 0);
  });

  test('a committee reaches its members; specific users reach exactly those users', async () => {
    await call(createNotification, { body: { recipientType: 'committee', recipientId: String(COMMITTEE), title: 'Meeting', message: 'm' } });
    assert.deepEqual(targeted(), [String(U_C._id)]);

    posts = [];
    await call(createNotification, { body: { recipientType: 'user', recipientIds: [String(U_A._id), String(U_C._id)], title: 'Hi', message: 'm' } });
    assert.deepEqual(targeted(), [U_A, U_C].map((u) => String(u._id)).sort());
  });

  test("a target in another Mahallu (or unknown) is a 404 and nothing is saved or pushed", async () => {
    for (const body of [
      { recipientType: 'user', recipientId: String(U_FOREIGN._id) },
      { recipientType: 'user', recipientIds: [String(U_A._id), String(U_FOREIGN._id)] },
      { recipientType: 'family', recipientId: String(oid()) },
      { recipientType: 'committee', recipientId: String(oid()) },
    ]) {
      const out = await call(createNotification, { body: { ...body, title: 'x', message: 'm' } });
      assert.equal(out.status, 404, JSON.stringify(body));
    }
    assert.equal(posts.length, 0);
    assert.equal((fakes[4] as Installed).store.docs.length, 0);
  });

  test('a user OneSignal does not know by external_id is retried by their registered device id', async () => {
    reply = (body) =>
      body.include_aliases
        ? { data: { id: 'os-1', errors: { invalid_aliases: { external_id: [String(U_A._id), String(U_B._id)] } } } }
        : { data: { id: 'os-2' } };
    await call(createNotification, { body: { recipientType: 'member', recipientIds: [String(M_A), String(M_B)], title: 'x', message: 'm' } });
    assert.equal(posts.length, 2);
    assert.deepEqual(posts[1].body.include_subscription_ids, ['player-a']); // U_B has no device id
    assert.equal(stored().pushStatus, 'partial');
    assert.equal(stored().pushRecipients, 1);
    assert.deepEqual(stored().pushIds, ['os-1', 'os-2']);
  });

  test('a provider failure is stored on the record and the request still succeeds', async () => {
    reply = () => { throw Object.assign(new Error('Request failed'), { response: { status: 401 } }); };
    const out = await call(createNotification, { body: { recipientType: 'all', title: 'x', message: 'm' } });
    assert.equal(out.status, 201);
    assert.equal(stored().pushStatus, 'failed');
    assert.equal(stored().pushError, '401');
    assert.equal(stored().pushRecipients, 0);
  });

  test('more than 2,000 users are sent in batches of at most 2,000', async () => {
    const many = Array.from({ length: 4500 }, () => ({ _id: oid() }));
    const result = await sendPushToUsers(many, { title: 't', message: 'm' });
    assert.deepEqual(posts.map((p) => p.body.include_aliases.external_id.length), [2000, 2000, 500]);
    assert.equal(result.status, 'sent');
    assert.equal(result.recipients, 4500);
  });

  test('without credentials nothing is sent and the record says skipped', async () => {
    delete process.env.ONESIGNAL_REST_API_KEY;
    const out = await call(createNotification, { body: { recipientType: 'all', title: 'x', message: 'm' } });
    assert.equal(out.status, 201);
    assert.equal(posts.length, 0);
    assert.equal(stored().pushStatus, 'skipped');
  });

  test('register-device saves the id on the signed-in account and releases it from any other account', async () => {
    const users = fakes[0] as Installed;
    const out = await call(registerDevice, { user: U_C, body: { oneSignalPlayerId: 'player-a' } });
    assert.equal(out.status, 200);
    const byId = (u: any) => users.store.docs.find((d: any) => String(d._id) === String(u._id));
    assert.equal(byId(U_C).oneSignalPlayerId, 'player-a');
    assert.equal(byId(U_A).oneSignalPlayerId, null);
  });
});
