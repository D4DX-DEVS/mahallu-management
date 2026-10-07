import { Varisangya, Zakat, Wallet, Transaction } from '../../models/Collectible';
import { LedgerItem, Ledger, MahalluAccount, InstituteAccount } from '../../models/MasterAccount';
import { ZakatBeneficiary, ZakatDistribution } from '../../models/Zakat';
import Counter from '../../models/Counter';
import Member from '../../models/Member';
import Family from '../../models/Family';
import { FakeStore, Installed, installFake, oid } from './fakeMongo';

/**
 * A tenant (A) with a family, two members and a Mahallu bank account, a second tenant (B) with its own,
 * and every collections model replaced by a stateful in-memory fake (see fakeMongo.ts).
 */
export function makeWorld() {
  const installs: Installed[] = [];
  const fake = (Model: any, seed: any[] = []): FakeStore => {
    const installed = installFake(Model, seed);
    installs.push(installed);
    return installed.store;
  };

  const tenantA = oid();
  const tenantB = oid();
  const familyA = oid();
  const familyB = oid();
  const memberA1 = oid();
  const memberA2 = oid();
  const memberB1 = oid();
  const accountA = oid();
  const accountB = oid();
  const adminA = oid();

  const stores = {
    varisangya: fake(Varisangya),
    zakat: fake(Zakat),
    wallet: fake(Wallet),
    txn: fake(Transaction),
    ledger: fake(Ledger),
    ledgerItem: fake(LedgerItem),
    mahalluAccount: fake(MahalluAccount, [
      { _id: accountA, tenantId: tenantA, accountName: 'Main A', status: 'active', balance: 0 },
      { _id: accountB, tenantId: tenantB, accountName: 'Main B', status: 'active', balance: 0 },
    ]),
    instituteAccount: fake(InstituteAccount),
    beneficiary: fake(ZakatBeneficiary),
    distribution: fake(ZakatDistribution),
    counter: fake(Counter),
    family: fake(Family, [
      { _id: familyA, tenantId: tenantA, houseName: 'House A', status: 'approved' },
      { _id: familyB, tenantId: tenantB, houseName: 'House B', status: 'approved' },
    ]),
    member: fake(Member, [
      { _id: memberA1, tenantId: tenantA, familyId: familyA, name: 'Member One' },
      { _id: memberA2, tenantId: tenantA, familyId: familyA, name: 'Member Two' },
      { _id: memberB1, tenantId: tenantB, familyId: familyB, name: 'Member B' },
    ]),
  };

  const asAdmin = (extra: Record<string, any> = {}) => ({
    tenantId: String(tenantA),
    user: { _id: adminA, role: 'mahall' },
    ...extra,
  });
  const asAdminB = (extra: Record<string, any> = {}) => ({
    tenantId: String(tenantB),
    user: { _id: oid(), role: 'mahall' },
    ...extra,
  });

  const balanceOf = (id: any) => stores.mahalluAccount.docs.find((d) => String(d._id) === String(id))?.balance;

  return {
    ids: { tenantA, tenantB, familyA, familyB, memberA1, memberA2, memberB1, accountA, accountB, adminA },
    stores,
    asAdmin,
    asAdminB,
    accountABalance: () => balanceOf(accountA),
    restore: () => installs.forEach((i) => i.restore()),
  };
}

export type World = ReturnType<typeof makeWorld>;

/** Every wallet document of a tenant's owner (family or member). */
export const walletsOf = (world: World, owner: { memberId?: any; familyId?: any }) =>
  world.stores.wallet.docs.filter(
    (w) =>
      (owner.memberId ? String(w.memberId) === String(owner.memberId) : !w.memberId) &&
      (owner.familyId ? String(w.familyId) === String(owner.familyId) : true)
  );
