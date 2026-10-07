import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { validationResult } from 'express-validator';
import { ifscField, IFSC_PATTERN } from '../validations/common';
import { createInstituteAccountValidation, updateInstituteAccountValidation } from '../validations/masterAccountValidation';
import { createEmployeeValidation, updateEmployeeValidation } from '../validations/employeeValidation';
import Employee from '../models/Employee';
import Institute from '../models/Institute';
import { createEmployee, updateEmployee, getAllEmployees } from '../controllers/employeeController';

/**
 * IFSC codes (four letters, a zero, six letters or digits) and the employee bank account: digits-only
 * account number on create AND update, a whitelist of writable fields, and no tenant / institute forgery.
 */

const OID = '507f1f77bcf86cd799439011';

const run = async (chains: any[], body: Record<string, unknown>, params: Record<string, string> = {}) => {
  const req: any = { body, params, query: {}, headers: {} };
  for (const chain of chains) await chain.run(req);
  return { req, errors: validationResult(req).array() as any[] };
};
const errorsFor = (errors: any[], path: string) => errors.filter((e) => e.path === path).map((e) => e.msg as string);

const VALID_IFSC = ['SBIN0001234', 'HDFC0ABC123', 'KARB0000001', 'ICIC0A1B2C3'];
const INVALID_IFSC = [
  'SBIN1001234', // fifth character must be 0
  'SBI0001234', // too short
  'SBIN00012345', // too long
  '1234ABC0000', // digits where letters belong
  'SBIN 001234', // space
  'SBIN0001-34', // dash
  'SB1N0001234', // digit in the bank code
  'SBIN0001234 5',
  'ÀBIN0001234',
];

describe('ifscField', () => {
  const chains = [ifscField('ifscCode')];

  test('accepts a real code and stores it trimmed and upper-cased', async () => {
    for (const code of VALID_IFSC) {
      const { req, errors } = await run(chains, { ifscCode: code });
      assert.deepEqual(errors, [], code);
      assert.equal(req.body.ifscCode, code);
    }
    const { req, errors } = await run(chains, { ifscCode: '  sbin0001234 ' });
    assert.deepEqual(errors, []);
    assert.equal(req.body.ifscCode, 'SBIN0001234');
  });

  test('rejects anything that is not shaped like one', async () => {
    for (const code of INVALID_IFSC) {
      const { errors } = await run(chains, { ifscCode: code });
      assert.equal(errors.length, 1, `"${code}" should be rejected`);
      assert.match(errors[0].msg, /valid IFSC code/);
    }
    for (const value of [12345678901, true, ['SBIN0001234'], { a: 1 }]) {
      assert.equal((await run(chains, { ifscCode: value })).errors.length, 1, JSON.stringify(value));
    }
  });

  test('an empty or absent code stays optional', async () => {
    assert.deepEqual((await run(chains, {})).errors, []);
    assert.deepEqual((await run(chains, { ifscCode: '' })).errors, []);
    assert.deepEqual((await run(chains, { ifscCode: null })).errors, []);
  });

  test('the exported pattern is the same rule', () => {
    assert.ok(IFSC_PATTERN.test('SBIN0001234'));
    assert.ok(!IFSC_PATTERN.test('sbin0001234'));
  });
});

describe('institute bank accounts', () => {
  const suites: Array<[string, any[], Record<string, unknown>, Record<string, string>]> = [
    ['create', createInstituteAccountValidation, { instituteId: OID, accountName: 'Main Account' }, {}],
    ['update', updateInstituteAccountValidation, {}, { id: OID }],
  ];
  for (const [name, chains, base, params] of suites) {
    test(`${name}: rejects a malformed IFSC and normalises a good one`, async () => {
      for (const ifscCode of INVALID_IFSC) {
        assert.equal(errorsFor((await run(chains, { ...base, ifscCode }, params)).errors, 'ifscCode').length, 1, ifscCode);
      }
      const { req, errors } = await run(chains, { ...base, ifscCode: ' hdfc0abc123' }, params);
      assert.deepEqual(errorsFor(errors, 'ifscCode'), []);
      assert.equal(req.body.ifscCode, 'HDFC0ABC123');
      assert.deepEqual(errorsFor((await run(chains, { ...base, ifscCode: '' }, params)).errors, 'ifscCode'), []);
    });
  }
});

describe('employee bank account validators', () => {
  const suites: Array<[string, any[], Record<string, unknown>, Record<string, string>]> = [
    ['create', createEmployeeValidation, { name: 'Ali', instituteId: OID, designation: 'Imam', salary: 100 }, {}],
    ['update', updateEmployeeValidation, {}, { id: OID }],
  ];
  const INVALID_ACCOUNTS = ['dsssss', '123ABC', '123-456', '123 456', '@123', '12.34', '12\n34'];

  for (const [name, chains, base, params] of suites) {
    test(`${name}: the account number is digits only`, async () => {
      for (const accountNumber of INVALID_ACCOUNTS) {
        const { errors } = await run(chains, { ...base, bankAccount: { accountNumber } }, params);
        assert.deepEqual(
          errorsFor(errors, 'bankAccount.accountNumber'),
          ['Please enter the account number using digits only.'],
          `"${accountNumber}"`
        );
      }
      // a JSON number has already lost its leading zeros
      assert.equal(errorsFor((await run(chains, { ...base, bankAccount: { accountNumber: 12345678 } }, params)).errors, 'bankAccount.accountNumber').length, 1);
    });

    test(`${name}: digits are accepted and keep their leading zeros as text`, async () => {
      for (const accountNumber of ['123456789', '0012345678', '65443456787']) {
        const { req, errors } = await run(chains, { ...base, bankAccount: { accountNumber } }, params);
        assert.deepEqual(errorsFor(errors, 'bankAccount.accountNumber'), []);
        assert.equal(req.body.bankAccount.accountNumber, accountNumber);
      }
      assert.deepEqual(errorsFor((await run(chains, { ...base, bankAccount: { accountNumber: '' } }, params)).errors, 'bankAccount.accountNumber'), []);
      assert.deepEqual(errorsFor((await run(chains, base, params)).errors, 'bankAccount.accountNumber'), []);
    });

    test(`${name}: the account number has a 34 character ceiling`, async () => {
      const { errors } = await run(chains, { ...base, bankAccount: { accountNumber: '1'.repeat(35) } }, params);
      assert.equal(errorsFor(errors, 'bankAccount.accountNumber').length, 1);
      assert.deepEqual(errorsFor((await run(chains, { ...base, bankAccount: { accountNumber: '1'.repeat(34) } }, params)).errors, 'bankAccount.accountNumber'), []);
    });

    test(`${name}: the IFSC code is checked and upper-cased`, async () => {
      assert.equal(errorsFor((await run(chains, { ...base, bankAccount: { ifscCode: 'nope' } }, params)).errors, 'bankAccount.ifscCode').length, 1);
      const { req, errors } = await run(chains, { ...base, bankAccount: { ifscCode: 'sbin0001234' } }, params);
      assert.deepEqual(errorsFor(errors, 'bankAccount.ifscCode'), []);
      assert.equal(req.body.bankAccount.ifscCode, 'SBIN0001234');
    });
  }
});

describe('Employee model', () => {
  test('refuses a non-digit account number, keeps leading zeros, and skips an empty one', () => {
    const base = { tenantId: new mongoose.Types.ObjectId(), instituteId: new mongoose.Types.ObjectId(), name: 'A', designation: 'D', salary: 1 };
    assert.ok(new Employee({ ...base, bankAccount: { accountNumber: 'dsssss' } }).validateSync()?.errors['bankAccount.accountNumber']);
    const good = new Employee({ ...base, bankAccount: { accountNumber: '0012345678' } });
    assert.equal(good.validateSync()?.errors['bankAccount.accountNumber'], undefined);
    assert.equal(good.bankAccount?.accountNumber, '0012345678');
    assert.equal(new Employee({ ...base, bankAccount: { accountNumber: '' } }).validateSync()?.errors['bankAccount.accountNumber'], undefined);
  });

  test('refuses a salary above the maximum or below zero', () => {
    const base = { tenantId: new mongoose.Types.ObjectId(), instituteId: new mongoose.Types.ObjectId(), name: 'A', designation: 'D' };
    assert.ok(new Employee({ ...base, salary: 1e300 }).validateSync()?.errors.salary);
    assert.ok(new Employee({ ...base, salary: -1 }).validateSync()?.errors.salary);
    assert.equal(new Employee({ ...base, salary: 0 }).validateSync()?.errors.salary, undefined);
  });
});

describe('employee controller', () => {
  const oid = () => new mongoose.Types.ObjectId();
  const T_A = String(oid());
  const T_B = String(oid());
  const INST_1 = String(oid());
  const INST_2 = String(oid());
  const INST_X = String(oid());

  const calls: Array<{ op: string; [k: string]: any }> = [];
  const store: Record<string, any[]> = { Employee: [], Institute: [] };
  const restore: Array<() => void> = [];
  const stub = (target: any, key: string, impl: any) => {
    const original = target[key];
    target[key] = impl;
    restore.push(() => { target[key] = original; });
  };
  const plain = (v: any) => JSON.parse(JSON.stringify(v));
  const chain = (result: any): any => {
    const c: any = {
      populate: () => c, select: () => c, sort: () => c, skip: () => c, limit: () => c, lean: () => c,
      then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    };
    return c;
  };

  before(() => {
    stub(Employee, 'findById', (id: any) => chain(store.Employee.find((d) => String(d._id) === String(id)) || null));
    stub(Employee, 'find', (filter: any) => { calls.push({ op: 'find', filter: plain(filter) }); return chain([]); });
    stub(Employee, 'countDocuments', () => chain(0));
    stub(Employee, 'findByIdAndUpdate', (id: any, data: any) => { calls.push({ op: 'update', id: String(id), data: plain(data) }); return chain({ _id: id, ...data }); });
    stub(Employee.prototype, 'save', async function (this: any) { calls.push({ op: 'save', doc: plain(this.toObject()) }); return this; });
    stub(Institute, 'findById', (id: any) => chain(store.Institute.find((d) => String(d._id) === String(id)) || null));
  });
  after(() => restore.reverse().forEach((r) => r()));

  const send = async (fn: any, req: Record<string, any>) => {
    calls.length = 0;
    const out: any = { status: 200, body: undefined };
    const res: any = { status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; return res; } };
    await fn({ params: {}, query: {}, body: {}, headers: {}, ...req }, res);
    return out;
  };
  const asInstitute = { tenantId: T_A, isSuperAdmin: false, user: { role: 'institute', instituteId: INST_1 } };
  const asMahall = { tenantId: T_A, isSuperAdmin: false, user: { role: 'mahall' } };

  test('create takes a whitelist: tenantId, _id, an extra field and a foreign institute never land', async () => {
    store.Institute = [{ _id: INST_2, tenantId: T_A }];
    const out = await send(createEmployee, {
      ...asMahall,
      body: {
        name: 'Ali', designation: 'Imam', salary: '12000.50', instituteId: INST_2, tenantId: T_B,
        isAdmin: true, role: 'super_admin', _id: String(oid()),
        bankAccount: { accountNumber: '0012345678', bankName: 'Bank', ifscCode: 'SBIN0001234', extra: 'x' },
      },
    });
    assert.equal(out.status, 201, JSON.stringify(out.body));
    const saved = calls.find((c) => c.op === 'save')!.doc;
    assert.equal(saved.tenantId, T_A);
    assert.equal(saved.instituteId, INST_2);
    assert.equal(saved.salary, 12000.5);
    assert.equal(saved.isAdmin, undefined);
    assert.equal(saved.role, undefined);
    assert.deepEqual(saved.bankAccount, { accountNumber: '0012345678', bankName: 'Bank', ifscCode: 'SBIN0001234' });
  });

  test("create: a Mahallu admin cannot name another Mahallu's institute; an institute admin is forced into their own", async () => {
    store.Institute = [{ _id: INST_X, tenantId: T_B }];
    let out = await send(createEmployee, { ...asMahall, body: { name: 'Ali', designation: 'Imam', salary: 1, instituteId: INST_X } });
    assert.equal(out.status, 400);
    assert.equal(calls.filter((c) => c.op === 'save').length, 0);

    out = await send(createEmployee, { ...asInstitute, body: { name: 'Ali', designation: 'Imam', salary: 1, instituteId: INST_2, tenantId: T_B } });
    assert.equal(out.status, 201);
    const saved = calls.find((c) => c.op === 'save')!.doc;
    assert.equal(saved.instituteId, INST_1);
    assert.equal(saved.tenantId, T_A);
  });

  test('create: a bad salary or a non-object bankAccount is a 400 and nothing is saved', async () => {
    store.Institute = [{ _id: INST_2, tenantId: T_A }];
    for (const body of [
      { salary: -1 }, { salary: 'abc' }, { salary: 1e300 }, { salary: 10.999 }, {},
      { salary: 1, bankAccount: 'x' }, { salary: 1, bankAccount: { accountNumber: 123 } },
    ]) {
      const out = await send(createEmployee, { ...asMahall, body: { name: 'Ali', designation: 'Imam', instituteId: INST_2, ...body } });
      assert.equal(out.status, 400, JSON.stringify(body));
    }
    assert.equal(calls.filter((c) => c.op === 'save').length, 0);
  });

  test('update takes a whitelist: tenantId, instituteId (institute admin), extra fields and bank sub-fields it does not know are dropped', async () => {
    const own = { _id: oid(), tenantId: T_A, instituteId: INST_1 };
    store.Employee = [own];
    const out = await send(updateEmployee, {
      ...asInstitute,
      params: { id: String(own._id) },
      body: {
        name: 'New', salary: 500, tenantId: T_B, instituteId: INST_2, status: 'inactive', role: 'x',
        bankAccount: { ifscCode: 'SBIN0001234', accountNumber: '123', other: 'y' },
      },
    });
    assert.equal(out.status, 200, JSON.stringify(out.body));
    assert.deepEqual(calls.find((c) => c.op === 'update')!.data, {
      name: 'New', salary: 500, status: 'inactive', 'bankAccount.ifscCode': 'SBIN0001234', 'bankAccount.accountNumber': '123',
    });
  });

  test("update: another institute's / another Mahallu's employee is refused and nothing is written", async () => {
    const sibling = { _id: oid(), tenantId: T_A, instituteId: INST_2 };
    const foreign = { _id: oid(), tenantId: T_B, instituteId: INST_X };
    store.Employee = [sibling, foreign];
    assert.equal((await send(updateEmployee, { ...asInstitute, params: { id: String(sibling._id) }, body: { name: 'x' } })).status, 403);
    assert.equal((await send(updateEmployee, { ...asMahall, params: { id: String(foreign._id) }, body: { name: 'x' } })).status, 403);
    assert.equal(calls.filter((c) => c.op === 'update').length, 0);
  });

  test('update: a Mahallu admin may move an employee only to an institute of their own Mahallu', async () => {
    const own = { _id: oid(), tenantId: T_A, instituteId: INST_1 };
    store.Employee = [own];
    store.Institute = [{ _id: INST_X, tenantId: T_B }, { _id: INST_2, tenantId: T_A }];
    assert.equal((await send(updateEmployee, { ...asMahall, params: { id: String(own._id) }, body: { instituteId: INST_X } })).status, 400);
    assert.equal(calls.filter((c) => c.op === 'update').length, 0);
    const out = await send(updateEmployee, { ...asMahall, params: { id: String(own._id) }, body: { instituteId: INST_2 } });
    assert.equal(out.status, 200);
    assert.equal(calls.find((c) => c.op === 'update')!.data.instituteId, INST_2);
  });

  test('update: a salary that is not an amount is a 400', async () => {
    const own = { _id: oid(), tenantId: T_A, instituteId: INST_1 };
    store.Employee = [own];
    for (const salary of [-1, 'abc', 1e300, 0.001, null]) {
      const out = await send(updateEmployee, { ...asMahall, params: { id: String(own._id) }, body: { salary } });
      assert.equal(out.status, 400, JSON.stringify(salary));
    }
  });

  test('the list is pinned to the caller: an institute admin ignores ?instituteId, a Mahallu admin may narrow, no Mahallu is refused', async () => {
    await send(getAllEmployees, { ...asInstitute, query: { instituteId: INST_2, tenantId: T_B } });
    assert.deepEqual(calls.find((c) => c.op === 'find')!.filter, { tenantId: T_A, instituteId: INST_1 });
    await send(getAllEmployees, { ...asMahall, query: { instituteId: INST_2, tenantId: T_B } });
    assert.deepEqual(calls.find((c) => c.op === 'find')!.filter, { tenantId: T_A, instituteId: INST_2 });
    assert.equal((await send(getAllEmployees, { ...asMahall, query: { instituteId: 'zzz' } })).status, 400);
    const none = await send(getAllEmployees, { tenantId: undefined, isSuperAdmin: false, user: { role: 'mahall' } });
    assert.equal(none.status, 403);
    assert.equal(calls.length, 0);
    // an operator object in ?status= is not a filter value
    await send(getAllEmployees, { ...asMahall, query: { status: { $ne: 'x' } } });
    assert.equal(calls.find((c) => c.op === 'find')!.filter.status, undefined);
  });
});
