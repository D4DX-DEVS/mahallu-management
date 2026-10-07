import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import SalaryPayment from '../models/SalaryPayment';
import { getAllSalaryPayments } from '../controllers/salaryController';

/**
 * The Salary list's "Total Paid" / "Total Pending" cards used to add up the 10 rows on the page.
 * The list response now carries a `summary` aggregated over the WHOLE filtered set, for the caller's
 * Mahallu (and institute, for an institute account) only.
 */
describe('[isolated] salaryListSummary', () => {
  const oid = () => new mongoose.Types.ObjectId();
  const TENANT = String(oid());
  const INSTITUTE = String(oid());
  const restore: Array<() => void> = [];
  const aggregates: any[] = [];
  const finds: any[] = [];

  before(() => {
    const stub = (key: string, impl: any) => {
      const original = (SalaryPayment as any)[key];
      (SalaryPayment as any)[key] = impl;
      restore.push(() => {
        (SalaryPayment as any)[key] = original;
      });
    };
    const chain = (): any => {
      const c: any = { populate: () => c, sort: () => c, skip: () => c, limit: () => c, then: (r: any) => r([]) };
      return c;
    };
    stub('find', (q: any) => {
      finds.push(q);
      return chain();
    });
    stub('countDocuments', async () => 37);
    stub('aggregate', async (pipeline: any[]) => {
      aggregates.push(pipeline);
      return [
        { _id: 'paid', count: 20, netAmount: 100000.456 },
        { _id: 'pending', count: 15, netAmount: 45000 },
        { _id: 'cancelled', count: 2, netAmount: 3000 },
      ];
    });
  });
  after(() => restore.reverse().forEach((r) => r()));

  const run = async (req: any) => {
    aggregates.length = 0;
    finds.length = 0;
    const out: any = { status: 200, body: undefined };
    const res: any = {
      status(c: number) {
        out.status = c;
        return res;
      },
      json(b: any) {
        out.body = b;
        return res;
      },
    };
    await getAllSalaryPayments({ query: {}, params: {}, body: {}, tenantId: TENANT, isSuperAdmin: false, user: { role: 'mahall' }, ...req }, res);
    return out;
  };

  test('the summary covers the whole filtered set, not the page', async () => {
    const out = await run({ query: { page: '2', limit: '10' } });
    assert.equal(out.status, 200);
    assert.deepEqual(out.body.summary, {
      count: 37,
      paidAmount: 100000.46,
      pendingAmount: 45000,
      cancelledAmount: 3000,
      paidCount: 20,
      pendingCount: 15,
      cancelledCount: 2,
    });
    // Same tenant filter as the list, cast to an ObjectId because aggregate() does not cast.
    const match = aggregates[0][0].$match;
    assert.equal(String(match.tenantId), TENANT);
    assert.ok(match.tenantId instanceof mongoose.Types.ObjectId);
    assert.equal(out.body.pagination.total, 37);
  });

  test('an institute account is summarised for its own institute only, whatever the query says', async () => {
    const other = String(oid());
    await run({ user: { role: 'institute', instituteId: INSTITUTE }, query: { instituteId: other } });
    const match = aggregates[0][0].$match;
    assert.equal(String(match.instituteId), INSTITUTE);
    assert.equal(String(finds[0].instituteId), INSTITUTE);
  });

  test('the status filter applies to the summary as well as the list', async () => {
    await run({ query: { status: 'paid' } });
    assert.equal(aggregates[0][0].$match.status, 'paid');
    assert.equal(finds[0].status, 'paid');
  });
});
