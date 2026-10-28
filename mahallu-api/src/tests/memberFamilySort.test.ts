import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Member from '../models/Member';
import { getAllMembers } from '../controllers/memberController';
import { call, installFake, oid, Installed } from './support/fakeMongo';

/**
 * `GET /members?sortBy=family`: members grouped by family, in the order they joined it.
 *
 * The family is identified by its own id (`familyId`), not by the denormalised `familyName`: renaming a family
 * does not update its members' `familyName`, so sorting on the name could split one family into two groups.
 */
describe('[isolated] memberFamilySort', () => {
  const TENANT = oid();
  const OTHER_TENANT = oid();
  // Created in this order, so the ids ascend: F1 < F2 < F3 (ObjectIds are time-ordered).
  const F1 = oid();
  const F2 = oid();
  const F3 = oid();
  const at = (minute: number) => new Date(Date.UTC(2026, 0, 1, 10, minute));
  // Esha and Hamza joined F1 at the same moment. Esha's id is the lower one, but Hamza is stored FIRST, so only an
  // explicit _id tie-breaker (not the order the rows happen to be stored in) can put Esha before Hamza.
  const ESHA_ID = oid();
  const HAMZA_ID = oid();

  // The seed order is NOT the family order, and the family order is NOT the newest-first order.
  const member = (name: string, familyId: unknown, createdAt: Date, extra: Record<string, unknown> = {}) => ({
    _id: oid(),
    tenantId: TENANT,
    name,
    familyId,
    familyName: 'House',
    gender: 'male',
    status: 'active',
    createdAt,
    ...extra,
  });
  const seed = () => [
    member('Ayisha', F2, at(1), { gender: 'female', familyName: 'Old House', mahallId: 'FID2-1' }), // F2, joined first; stale family name
    member('Bilal', F1, at(2), { mahallId: 'FID1-1' }),
    member('Chandni', F2, at(3), { gender: 'female', familyName: 'New House', mahallId: 'FID2-2' }), // F2 after a rename
    member('Dawood', F3, at(4), { mahallId: 'FID3-1' }),
    member('Hamza', F1, at(5), { _id: HAMZA_ID, mahallId: 'FID1-3' }),
    member('Esha', F1, at(5), { _id: ESHA_ID, gender: 'female', mahallId: 'FID1-2' }),
    member('Farook', F2, at(6), { familyName: 'New House', mahallId: 'FID2-3' }),
    member('Ghazala', F3, at(7), { gender: 'female', mahallId: 'FID3-2' }),
    member('Gone', F1, at(0), { status: 'deleted', mahallId: 'FID1-9' }),
    member('OtherTenantMember', F1, at(3), { tenantId: OTHER_TENANT, mahallId: 'FID1-1' }),
  ];

  let members: Installed;
  beforeEach(() => {
    members = installFake(Member, seed());
  });
  afterEach(() => members.restore());

  const admin = (query: Record<string, unknown>) => ({
    user: { _id: oid(), role: 'mahall', tenantId: TENANT },
    tenantId: String(TENANT),
    isSuperAdmin: false,
    query,
  });
  const namesOf = (reply: { body: { data: Array<{ name: string }> } }) => reply.body.data.map((m) => m.name);
  const list = async (query: Record<string, unknown>) => {
    const reply = await call(getAllMembers, admin(query));
    assert.equal(reply.status, 200, JSON.stringify(reply.body));
    return reply;
  };

  const FAMILY_ORDER = ['Bilal', 'Esha', 'Hamza', 'Ayisha', 'Chandni', 'Farook', 'Dawood', 'Ghazala'];

  test('members of several families are grouped family by family, in the order the family ids ascend', async () => {
    const reply = await list({ sortBy: 'family', limit: 100 });
    assert.deepEqual(namesOf(reply), FAMILY_ORDER);
    assert.equal(reply.body.pagination.total, 8);
  });

  test('within one family members come in the order they joined; the same moment is settled by _id', async () => {
    const names = namesOf(await list({ sortBy: 'family', limit: 100 }));
    assert.deepEqual(names.slice(0, 3), ['Bilal', 'Esha', 'Hamza'], 'F1: Bilal (minute 2), then Esha and Hamza (both minute 5, Esha has the lower _id)');
    assert.deepEqual(names.slice(3, 6), ['Ayisha', 'Chandni', 'Farook'], 'F2 by join time');
    assert.deepEqual(names.slice(6), ['Dawood', 'Ghazala'], 'F3 by join time');
  });

  test('a family stays in one piece even when its members carry different (stale) family names', async () => {
    // Ayisha says "Old House", Chandni and Farook say "New House": sorting on the name would put Chandni and Farook
    // first and Ayisha last. The family id keeps all three together, in join order.
    const names = namesOf(await list({ sortBy: 'family', limit: 100 }));
    assert.deepEqual(names.slice(3, 6), ['Ayisha', 'Chandni', 'Farook']);
  });

  test('the order is the same on every page: pages joined together equal the whole list, with no repeats or gaps', async () => {
    const pages: string[][] = [];
    let totalPages = 1;
    for (let page = 1; page <= totalPages; page++) {
      const reply = await list({ sortBy: 'family', page, limit: 2 });
      totalPages = reply.body.pagination.totalPages;
      assert.ok(namesOf(reply).length <= 2);
      pages.push(namesOf(reply));
    }
    assert.equal(pages.length, 4, '8 members at 2 per page');
    assert.deepEqual(pages.flat(), FAMILY_ORDER);
    assert.equal(new Set(pages.flat()).size, 8, 'no member appears twice');
    assert.deepEqual(pages[1], ['Hamza', 'Ayisha'], 'family F1 continues onto page 2 (Hamza), where family F2 begins');
  });

  test('it is sorted by the server across the whole list, not within one page of another order', async () => {
    // Page 1 of the default (newest first) order holds Ghazala, Farook, ...; page 1 of the family order holds F1.
    const newest = namesOf(await list({ limit: 3 }));
    const family = namesOf(await list({ sortBy: 'family', limit: 3 }));
    assert.deepEqual(newest.slice(0, 2), ['Ghazala', 'Farook']);
    assert.deepEqual(family, ['Bilal', 'Esha', 'Hamza']);
  });

  test('filters and search still apply, and the family order is kept inside the result', async () => {
    assert.deepEqual(namesOf(await list({ sortBy: 'family', gender: 'female', limit: 100 })), ['Esha', 'Ayisha', 'Chandni', 'Ghazala']);
    assert.deepEqual(namesOf(await list({ sortBy: 'family', search: 'sha', limit: 100 })), ['Esha', 'Ayisha']);
    const deleted = await list({ sortBy: 'family', status: 'deleted', limit: 100 });
    assert.deepEqual(namesOf(deleted), ['Gone']);
    assert.equal(deleted.body.pagination.total, 1);
  });

  test('deleted members and another Mahallu\'s members never appear', async () => {
    const names = namesOf(await list({ sortBy: 'family', limit: 100 }));
    assert.ok(!names.includes('Gone'));
    assert.ok(!names.includes('OtherTenantMember'));
  });

  test('the other sort options are unchanged', async () => {
    assert.deepEqual(namesOf(await list({ sortBy: 'name', limit: 100 })), ['Ayisha', 'Bilal', 'Chandni', 'Dawood', 'Esha', 'Farook', 'Ghazala', 'Hamza']);
    assert.deepEqual(namesOf(await list({ sortBy: 'mahallId', limit: 100 })), ['Bilal', 'Esha', 'Hamza', 'Ayisha', 'Chandni', 'Farook', 'Dawood', 'Ghazala']);
    const newest = namesOf(await list({ limit: 100 }));
    assert.deepEqual(newest.slice(0, 2), ['Ghazala', 'Farook']);
    assert.deepEqual(newest.slice(-2), ['Bilal', 'Ayisha']);
    assert.notDeepEqual(newest, FAMILY_ORDER);
  });

  test('an unknown sortBy falls back to newest first, as before', async () => {
    assert.deepEqual(namesOf(await list({ sortBy: 'bogus', limit: 100 })), namesOf(await list({ limit: 100 })));
    assert.deepEqual(namesOf(await list({ sortBy: 'FAMILY', limit: 100 })), namesOf(await list({ limit: 100 })), 'the value is case-sensitive, like the other options');
  });
});
