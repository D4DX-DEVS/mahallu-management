import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Notification, { isReadBy, notificationForViewer } from '../models/Notification';
import { getAllNotifications, markAsRead, markAllAsRead } from '../controllers/notificationController';

/**
 * Notifications:
 *   - a broadcast (recipientType 'all') is read PER USER (readBy + $addToSet): one member reading it,
 *     or pressing "mark all as read", must not mark it read for everybody else;
 *   - the list exposes a per-requester `isRead`, so the CMS / mobile contract is unchanged;
 *   - only admin roles (super_admin, mahall) may list the whole Mahallu's notifications; survey,
 *     institute and member users see their own plus broadcasts;
 *   - marking is limited to the caller's own inbox in the caller's own Mahallu.
 *
 * The collection is an in-memory list with a small evaluator for exactly the query operators the
 * controller uses ($and, $or, $in, $ne, equality, array contains), so these tests exercise the real
 * queries, not just their shape.
 */

const oid = () => new mongoose.Types.ObjectId();
const TENANT = oid();
const OTHER_TENANT = oid();

const ADMIN = { _id: oid(), role: 'mahall', name: 'Admin' };
const SUPER = { _id: oid(), role: 'super_admin', name: 'Root' };
const MEMBER_A = { _id: oid(), role: 'member', memberId: oid(), name: 'A' };
const MEMBER_B = { _id: oid(), role: 'member', memberId: oid(), name: 'B' };
const SURVEY = { _id: oid(), role: 'survey', name: 'Surveyor' };
const INSTITUTE = { _id: oid(), role: 'institute', instituteId: oid(), name: 'Institute' };

let rows: any[] = [];

const same = (a: any, b: any) => String(a) === String(b);
const contains = (docVal: any, v: any): boolean =>
  Array.isArray(docVal) ? docVal.some((x) => same(x, v)) : docVal === undefined || docVal === null ? v === undefined || v === null : same(docVal, v);

const matchField = (docVal: any, cond: any): boolean => {
  if (cond && typeof cond === 'object' && !(cond instanceof mongoose.Types.ObjectId) && !(cond instanceof Date)) {
    if ('$in' in cond) return cond.$in.some((v: any) => contains(docVal, v));
    if ('$ne' in cond) return !contains(docVal, cond.$ne);
    throw new Error('unsupported operator in test evaluator: ' + Object.keys(cond).join(','));
  }
  return contains(docVal, cond);
};

const matches = (doc: any, filter: any): boolean =>
  Object.entries(filter).every(([key, cond]: [string, any]) => {
    if (key === '$and') return cond.every((f: any) => matches(doc, f));
    if (key === '$or') return cond.some((f: any) => matches(doc, f));
    return matchField(doc[key], cond);
  });

const make = (over: Record<string, any>) => {
  const doc: any = {
    _id: oid(), tenantId: TENANT, recipientType: 'all', title: 't', message: 'm', isRead: false, createdAt: new Date(), ...over,
  };
  doc.toJSON = () => { const { toJSON, ...rest } = doc; return { ...rest, id: String(doc._id) }; };
  return doc;
};

const applyUpdate = (doc: any, update: any) => {
  if (update.$addToSet) {
    for (const [k, v] of Object.entries(update.$addToSet)) {
      doc[k] = doc[k] ?? [];
      if (!doc[k].some((x: any) => same(x, v))) doc[k].push(v);
    }
  }
  const plain = Object.fromEntries(Object.entries(update).filter(([k]) => !k.startsWith('$')));
  Object.assign(doc, plain);
};

const saved: Array<[any, string, any]> = [];
const stub = (target: any, key: string, impl: any) => { saved.push([target, key, target[key]]); target[key] = impl; };

const call = async (fn: any, user: any, req: Record<string, any> = {}) => {
  const out: any = { status: 200, body: undefined };
  const res: any = { status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; return res; } };
  const isSuperAdmin = user.role === 'super_admin';
  await fn(
    { params: {}, query: {}, body: {}, user, tenantId: isSuperAdmin ? undefined : String(TENANT), isSuperAdmin, ...req } as any,
    res
  );
  return out;
};

describe('notification visibility', () => {
  let broadcast: any;
  let forA: any;
  let forB: any;
  let forAdmin: any;
  let foreign: any;

  beforeEach(() => {
    stub(Notification, 'find', (query: any) => {
      let list = rows.filter((r) => matches(r, query));
      const chain: any = {
        select: () => chain,
        sort: () => chain,
        skip: (n: number) => { list = list.slice(n); return chain; },
        limit: (n: number) => { list = list.slice(0, n); return chain; },
        then: (resolve: any, reject: any) => Promise.resolve(list).then(resolve, reject),
      };
      return chain;
    });
    stub(Notification, 'countDocuments', async (query: any) => rows.filter((r) => matches(r, query)).length);
    stub(Notification, 'findOne', (filter: any) => {
      const found = rows.find((r) => matches(r, filter)) ?? null;
      return { select: async () => found };
    });
    stub(Notification, 'findOneAndUpdate', (filter: any, update: any) => {
      const found = rows.find((r) => matches(r, filter));
      if (found) applyUpdate(found, update);
      return { select: async () => found ?? null };
    });
    stub(Notification, 'updateMany', async (filter: any, update: any) => {
      rows.filter((r) => matches(r, filter)).forEach((r) => applyUpdate(r, update));
      return {};
    });
  });
  afterEach(() => { for (const [t, k, v] of saved.reverse()) t[k] = v; saved.length = 0; });

  beforeEach(() => {
    broadcast = make({ title: 'Eid' });
    forA = make({ recipientType: 'member', recipientId: MEMBER_A.memberId });
    forB = make({ recipientType: 'member', recipientId: MEMBER_B._id });
    forAdmin = make({ recipientType: 'user', recipientId: ADMIN._id });
    foreign = make({ tenantId: OTHER_TENANT });
    rows = [broadcast, forA, forB, forAdmin, foreign];
    
  });

  const idsOf = (out: any) => out.body.data.map((n: any) => String(n.id)).sort();
  const sortIds = (...docs: any[]) => docs.map((d) => String(d._id)).sort();
  const byId = (out: any, doc: any) => out.body.data.find((n: any) => String(n.id) === String(doc._id));

  test('one member marking a broadcast read does not mark it read for the others', async () => {
    const out = await call(markAsRead, MEMBER_A, { params: { id: String(broadcast._id) } });
    assert.equal(out.status, 200);
    assert.equal(out.body.data.isRead, true);

    const asA = await call(getAllNotifications, MEMBER_A);
    const asB = await call(getAllNotifications, MEMBER_B);
    assert.equal(byId(asA, broadcast).isRead, true);
    assert.equal(byId(asB, broadcast).isRead, false);
    assert.equal(broadcast.isRead, false, 'the shared flag is never touched');
  });

  test('the unread badge query (isRead=false&limit=1&recipientType=individual) is per user', async () => {
    const badge = (user: any) =>
      call(getAllNotifications, user, { query: { isRead: 'false', limit: '1', recipientType: 'individual' } });

    assert.equal((await badge(MEMBER_A)).body.pagination.total, 2); // broadcast + own
    assert.equal((await badge(MEMBER_B)).body.pagination.total, 2);
    await call(markAsRead, MEMBER_A, { params: { id: String(broadcast._id) } });
    assert.equal((await badge(MEMBER_A)).body.pagination.total, 1);
    assert.equal((await badge(MEMBER_B)).body.pagination.total, 2, "B's badge is unchanged");
  });

  test('mark-all-as-read marks only the caller\'s inbox: broadcasts per user, own individual ones by flag', async () => {
    const out = await call(markAllAsRead, MEMBER_A);
    assert.equal(out.status, 200);
    const asA = await call(getAllNotifications, MEMBER_A);
    assert.ok(asA.body.data.every((n: any) => n.isRead === true));
    assert.equal(forA.isRead, true);
    assert.equal(forB.isRead, false, "another user's individual notification is untouched");
    assert.equal(forAdmin.isRead, false);
    assert.equal(foreign.isRead, false, 'other Mahallus are untouched');
    const asB = await call(getAllNotifications, MEMBER_B);
    assert.equal(byId(asB, broadcast).isRead, false, 'B still has the broadcast unread');
    assert.equal(byId(asB, forB).isRead, false);
  });

  test('marking a broadcast twice does not duplicate the reader', async () => {
    await call(markAsRead, MEMBER_A, { params: { id: String(broadcast._id) } });
    await call(markAsRead, MEMBER_A, { params: { id: String(broadcast._id) } });
    await call(markAllAsRead, MEMBER_A);
    assert.equal(broadcast.readBy.length, 1);
  });

  test('member, survey and institute users see their own notifications plus broadcasts, never others\'', async () => {
    assert.deepEqual(idsOf(await call(getAllNotifications, MEMBER_A)), sortIds(broadcast, forA));
    assert.deepEqual(idsOf(await call(getAllNotifications, MEMBER_B)), sortIds(broadcast, forB));
    for (const user of [SURVEY, INSTITUTE]) {
      assert.deepEqual(idsOf(await call(getAllNotifications, user)), sortIds(broadcast), user.role);
    }
  });

  test('a non-admin cannot widen the list through the query string', async () => {
    for (const query of [{ recipientType: 'all' }, { recipientType: 'user' }, { tenantId: String(OTHER_TENANT) }, { recipientType: 'collection' }]) {
      const out = await call(getAllNotifications, SURVEY, { query });
      assert.deepEqual(idsOf(out), sortIds(broadcast), JSON.stringify(query));
    }
  });

  test('only an admin lists the whole Mahallu; recipientType=individual narrows an admin to their own inbox', async () => {
    const all = await call(getAllNotifications, ADMIN);
    assert.deepEqual(idsOf(all), sortIds(broadcast, forA, forB, forAdmin));
    assert.ok(!idsOf(all).includes(String(foreign._id)), 'never another Mahallu');
    const own = await call(getAllNotifications, ADMIN, { query: { recipientType: 'individual' } });
    assert.deepEqual(idsOf(own), sortIds(broadcast, forAdmin));
  });

  test('a super admin who picked a Mahallu lists it; with none picked they must name one', async () => {
    const picked = await call(getAllNotifications, SUPER, { tenantId: String(TENANT) });
    assert.deepEqual(idsOf(picked), sortIds(broadcast, forA, forB, forAdmin));
    const named = await call(getAllNotifications, SUPER, { query: { tenantId: String(OTHER_TENANT) } });
    assert.deepEqual(idsOf(named), sortIds(foreign));
  });

  test("somebody else's individual notification, a foreign Mahallu's notification and a made-up id are all 'not found'", async () => {
    for (const target of [forB, foreign]) {
      const out = await call(markAsRead, MEMBER_A, { params: { id: String(target._id) } });
      assert.equal(out.status, 404, String(target._id));
      assert.equal(target.isRead, false);
      assert.equal(target.readBy, undefined);
    }
    assert.equal((await call(markAsRead, MEMBER_A, { params: { id: String(oid()) } })).status, 404);
    // not even an admin marks another user's individual notification on their behalf
    assert.equal((await call(markAsRead, ADMIN, { params: { id: String(forA._id) } })).status, 404);
  });

  test('an individual notification is marked by its own flag, for its own recipient only', async () => {
    const out = await call(markAsRead, MEMBER_A, { params: { id: String(forA._id) } });
    assert.equal(out.status, 200);
    assert.equal(forA.isRead, true);
    assert.equal(forA.readBy, undefined);
  });

  test('no Mahallu, no scope: a user without one is refused and a query tenantId is not a fallback', async () => {
    const orphan = { _id: oid(), role: 'survey' };
    assert.equal((await call(getAllNotifications, orphan, { tenantId: undefined })).status, 403);
    assert.equal((await call(markAsRead, orphan, { tenantId: undefined, params: { id: String(broadcast._id) } })).status, 403);
    const all = await call(markAllAsRead, orphan, { tenantId: undefined, query: { tenantId: String(TENANT) } });
    assert.equal(all.status, 403);
    assert.equal(broadcast.readBy, undefined);
  });

  test('the response carries the requester\'s isRead and never the list of other readers', async () => {
    await call(markAsRead, MEMBER_B, { params: { id: String(broadcast._id) } });
    const asA = await call(getAllNotifications, MEMBER_A);
    const item = byId(asA, broadcast);
    assert.equal(item.isRead, false);
    assert.equal('readBy' in item, false);
    assert.ok(!JSON.stringify(asA.body).includes(String(MEMBER_B._id)));
  });

  test('a broadcast read for everybody before per-user tracking existed stays read', () => {
    const legacy = make({ isRead: true });
    assert.equal(isReadBy(legacy, MEMBER_A._id), true);
    assert.equal(notificationForViewer(legacy, MEMBER_B._id).isRead, true);
    const fresh = make({ readBy: [MEMBER_A._id] });
    assert.equal(isReadBy(fresh, MEMBER_A._id), true);
    assert.equal(isReadBy(fresh, MEMBER_B._id), false);
    assert.equal(isReadBy(fresh, undefined), false);
  });

  test('the model keeps readBy out of default reads', () => {
    const path: any = Notification.schema.path('readBy');
    assert.equal(path.options.select, false);
  });
});
