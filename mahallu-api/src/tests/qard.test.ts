/**
 * B2 tests: repayment schedule generation, repayment allocation and the two
 * new workflow state machines. Pure functions only - no database.
 *
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addMonths,
  buildRepaymentSchedule,
  applyRepayment,
  markOverdue,
  QARD_TRANSITIONS,
  QARD_STATUSES,
  QardStatus,
  IInstallment,
} from '../models/QardLoan';
import { RELIEF_TRANSITIONS, RELIEF_STATUSES, ReliefStatus } from '../models/ReliefCase';

const sum = (values: number[]) => Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;
const JAN_15 = new Date(2026, 0, 15);

// --- date arithmetic -------------------------------------------------------

test('addMonths clamps a 31st to the last day of a shorter month', () => {
  const jan31 = new Date(2026, 0, 31);
  assert.equal(addMonths(jan31, 1).getMonth(), 1, 'must land in February, not roll into March');
  assert.equal(addMonths(jan31, 1).getDate(), 28);
  assert.equal(addMonths(jan31, 3).getDate(), 30, 'April has 30 days');
});

test('addMonths handles a leap February and a year boundary', () => {
  assert.equal(addMonths(new Date(2024, 0, 31), 1).getDate(), 29);
  const crossed = addMonths(new Date(2026, 11, 15), 1);
  assert.equal(crossed.getFullYear(), 2027);
  assert.equal(crossed.getMonth(), 0);
});

// --- schedule generation ---------------------------------------------------

test('a schedule has one installment per month, starting a month after disbursement', () => {
  const schedule = buildRepaymentSchedule(12000, 12, JAN_15);
  assert.equal(schedule.length, 12);
  assert.equal(schedule[0].dueDate.getMonth(), 1, 'first due date is February');
  assert.equal(schedule[0].dueDate.getDate(), 15);
  assert.equal(schedule[11].dueDate.getFullYear(), 2027);
});

test('an evenly divisible principal splits into equal installments', () => {
  const schedule = buildRepaymentSchedule(12000, 12, JAN_15);
  schedule.forEach((installment) => assert.equal(installment.amount, 1000));
  assert.equal(sum(schedule.map((i) => i.amount)), 12000);
});

test('a rounding remainder lands on the final installment, never lost', () => {
  const schedule = buildRepaymentSchedule(10000, 3, JAN_15);
  assert.equal(schedule[0].amount, 3333.33);
  assert.equal(schedule[1].amount, 3333.33);
  assert.equal(schedule[2].amount, 3333.34, 'last installment absorbs the remainder');
  assert.equal(sum(schedule.map((i) => i.amount)), 10000);
});

test('awkward principals still sum back exactly', () => {
  const cases: Array<[number, number]> = [
    [1, 3],
    [99.99, 7],
    [50000, 18],
    [7, 6],
  ];
  cases.forEach(([principal, months]) => {
    const schedule = buildRepaymentSchedule(principal, months, JAN_15);
    assert.equal(sum(schedule.map((i) => i.amount)), principal, `${principal} over ${months}`);
  });
});

test('a schedule starts entirely unpaid', () => {
  buildRepaymentSchedule(1200, 3, JAN_15).forEach((installment) => {
    assert.equal(installment.paidAmount, 0);
    assert.equal(installment.status, 'due');
  });
});

test('a nonsensical schedule request yields nothing rather than a bad schedule', () => {
  assert.deepEqual(buildRepaymentSchedule(0, 12, JAN_15), []);
  assert.deepEqual(buildRepaymentSchedule(-500, 12, JAN_15), []);
  assert.deepEqual(buildRepaymentSchedule(1000, 0, JAN_15), []);
  assert.deepEqual(buildRepaymentSchedule(1000, 1.5, JAN_15), []);
});

// --- repayment allocation --------------------------------------------------

const freshSchedule = () => buildRepaymentSchedule(3000, 3, JAN_15);
const LATER = new Date(2026, 1, 20); // after the first due date of 15 Feb

test('a payment clears the oldest installment first', () => {
  const { schedule, applied, unapplied } = applyRepayment(freshSchedule(), 1000, JAN_15);
  assert.equal(applied, 1000);
  assert.equal(unapplied, 0);
  assert.equal(schedule[0].status, 'paid');
  assert.equal(schedule[1].status, 'due');
  assert.equal(schedule[1].paidAmount, 0);
});

test('a payment spills over into later installments', () => {
  const { schedule } = applyRepayment(freshSchedule(), 2500, JAN_15);
  assert.equal(schedule[0].status, 'paid');
  assert.equal(schedule[1].status, 'paid');
  assert.equal(schedule[2].paidAmount, 500);
  assert.equal(schedule[2].status, 'partial');
});

test('a part payment marks the installment partial, not paid', () => {
  const { schedule, applied } = applyRepayment(freshSchedule(), 400, JAN_15);
  assert.equal(applied, 400);
  assert.equal(schedule[0].paidAmount, 400);
  assert.equal(schedule[0].status, 'partial');
});

test('a part payment on an already-late installment reads overdue', () => {
  const { schedule } = applyRepayment(freshSchedule(), 400, LATER);
  assert.equal(schedule[0].status, 'overdue');
});

test('successive payments accumulate on the same installment', () => {
  const first = applyRepayment(freshSchedule(), 400, JAN_15);
  const second = applyRepayment(first.schedule, 600, JAN_15);
  assert.equal(second.schedule[0].paidAmount, 1000);
  assert.equal(second.schedule[0].status, 'paid');
});

test('money beyond the schedule is reported unapplied, never silently absorbed', () => {
  const { applied, unapplied } = applyRepayment(freshSchedule(), 3500, JAN_15);
  assert.equal(applied, 3000);
  assert.equal(unapplied, 500);
});

test('applyRepayment does not mutate the schedule it was given', () => {
  const original = freshSchedule();
  applyRepayment(original, 1000, JAN_15);
  assert.equal(original[0].paidAmount, 0);
  assert.equal(original[0].status, 'due');
});

test('paying off a whole schedule leaves nothing owed', () => {
  const { schedule, unapplied } = applyRepayment(freshSchedule(), 3000, JAN_15);
  assert.equal(unapplied, 0);
  schedule.forEach((installment) => assert.equal(installment.status, 'paid'));
  assert.equal(sum(schedule.map((i) => i.paidAmount)), 3000);
});

// --- overdue stamping ------------------------------------------------------

test('markOverdue flags past-due unpaid installments and spares paid ones', () => {
  const paidFirst = applyRepayment(freshSchedule(), 1000, JAN_15).schedule;
  const stamped = markOverdue(paidFirst, new Date(2026, 2, 20)); // past Feb and Mar dues
  assert.equal(stamped[0].status, 'paid', 'a settled installment never becomes overdue');
  assert.equal(stamped[1].status, 'overdue');
  assert.equal(stamped[2].status, 'due', 'April is not due yet');
});

test('markOverdue leaves a fresh schedule alone', () => {
  markOverdue(freshSchedule(), JAN_15).forEach((installment) => {
    assert.equal(installment.status, 'due');
  });
});

// --- loan workflow ---------------------------------------------------------

const canMoveLoan = (from: QardStatus, to: QardStatus) => QARD_TRANSITIONS[from].includes(to);

test('the loan workflow permits the documented forward path', () => {
  assert.ok(canMoveLoan('applied', 'under_review'));
  assert.ok(canMoveLoan('under_review', 'approved'));
  assert.ok(canMoveLoan('approved', 'disbursed'));
  assert.ok(canMoveLoan('disbursed', 'repaying'));
  assert.ok(canMoveLoan('repaying', 'closed'));
});

test('the loan workflow refuses skipped stages', () => {
  assert.equal(canMoveLoan('applied', 'approved'), false);
  assert.equal(canMoveLoan('applied', 'disbursed'), false);
  assert.equal(canMoveLoan('under_review', 'disbursed'), false);
});

test('a loan can be rejected only before disbursement', () => {
  assert.ok(canMoveLoan('applied', 'rejected'));
  assert.ok(canMoveLoan('under_review', 'rejected'));
  assert.ok(canMoveLoan('approved', 'rejected'));
  assert.equal(canMoveLoan('disbursed', 'rejected'), false);
  assert.equal(canMoveLoan('repaying', 'rejected'), false);
});

test('a defaulted loan can only be written off, and closed is final', () => {
  assert.ok(canMoveLoan('disbursed', 'defaulted'));
  assert.ok(canMoveLoan('repaying', 'defaulted'));
  assert.deepEqual(QARD_TRANSITIONS.defaulted, ['closed']);
  assert.deepEqual(QARD_TRANSITIONS.closed, []);
  assert.deepEqual(QARD_TRANSITIONS.rejected, []);
});

test('the loan workflow defines a transition list for every status', () => {
  QARD_STATUSES.forEach((status) => {
    assert.ok(Array.isArray(QARD_TRANSITIONS[status]), `missing transitions for ${status}`);
  });
});

// --- relief workflow -------------------------------------------------------

const canMoveRelief = (from: ReliefStatus, to: ReliefStatus) =>
  RELIEF_TRANSITIONS[from].includes(to);

test('the relief workflow permits the documented forward path', () => {
  assert.ok(canMoveRelief('reported', 'verified'));
  assert.ok(canMoveRelief('verified', 'approved'));
  assert.ok(canMoveRelief('approved', 'assisted'));
  assert.ok(canMoveRelief('assisted', 'closed'));
});

test('a relief case can be closed from any open stage but never skips ahead', () => {
  assert.ok(canMoveRelief('reported', 'closed'));
  assert.ok(canMoveRelief('verified', 'closed'));
  assert.equal(canMoveRelief('reported', 'assisted'), false);
  assert.equal(canMoveRelief('reported', 'approved'), false);
  assert.deepEqual(RELIEF_TRANSITIONS.closed, []);
});

test('the relief workflow defines a transition list for every status', () => {
  RELIEF_STATUSES.forEach((status) => {
    assert.ok(Array.isArray(RELIEF_TRANSITIONS[status]), `missing transitions for ${status}`);
  });
});

// --- end-to-end money walk -------------------------------------------------

test('a full disburse-then-repay cycle settles to zero with nothing lost', () => {
  const principal = 25000;
  const schedule = buildRepaymentSchedule(principal, 7, JAN_15);
  let current: IInstallment[] = schedule;
  let outstanding = principal;

  // Pay each installment its exact amount, in order.
  schedule.forEach((installment) => {
    const result = applyRepayment(current, installment.amount, JAN_15);
    current = result.schedule;
    outstanding = Math.round((outstanding - result.applied) * 100) / 100;
    assert.equal(result.unapplied, 0);
  });

  assert.equal(outstanding, 0);
  current.forEach((installment) => assert.equal(installment.status, 'paid'));
});
