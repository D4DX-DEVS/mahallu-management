import { Response } from 'express';
import SalaryPayment from '../models/SalaryPayment';
import Employee from '../models/Employee';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import Institute from '../models/Institute';
import mongoose from 'mongoose';
import {
  requireScope,
  requireWriteScope,
  tenantFilterFor,
  parseIdParam,
  verifyRecordAccess,
  cleanBody,
  instituteForWrite,
  refsInScope,
  sendForeignRef,
  sendBadRequest,
  MSG,
  CallerScope,
} from '../utils/scope';
import { postLedgerEntry, reverseLedgerEntry } from '../services/ledgerPostingService';
import { MAX_AMOUNT, parseAmountInRange, round2 } from '../utils/money';

import { sendFailure } from '../utils/userMessages';
import { ReconciliationRequiredError, reportReconciliationRequired, runUndos, sendReconciliationRequired } from '../utils/reconciliation';

/**
 * Access control for salary payments.
 *  - Lists/summary: tenant-scoped, fail closed; an institute account is pinned to its OWN institute
 *    and any instituteId/employeeId in the query can only narrow within it.
 *  - By id (get/update/delete/employee history): tenant + (institute role) own-institute ownership.
 *  - Create/update: tenantId never taken from the body; an institute account's instituteId is forced
 *    to its own; employeeId / instituteId must belong to the same Mahallu (and institute).
 * Money: netAmount is computed on the server only (base + allowances - deductions, 2 decimals,
 *    never negative) and a client value is ignored. Status moves pending -> paid -> cancelled; the
 *    ledger entry is posted on the way to paid and reversed on cancel / delete / amount change, and a
 *    ledger failure undoes the change and answers an error instead of reporting success.
 */

/** A whole-number month/year filter. */
const parseIntFilter = (value: unknown): { ok: true; value?: number } | { ok: false } => {
  if (value === undefined || value === '') return { ok: true };
  if (typeof value !== 'string' || !/^\d{1,4}$/.test(value)) return { ok: false };
  return { ok: true, value: parseInt(value, 10) };
};

/** Filters shared by the list and the summary. null = a response was already sent. */
const salaryFilters = (req: AuthRequest, res: Response, caller: CallerScope): Record<string, any> | null => {
  const tenant = tenantFilterFor(req, res);
  if (!tenant) return null;
  const inst = parseIdParam(req.query.instituteId);
  const emp = parseIdParam(req.query.employeeId);
  const month = parseIntFilter(req.query.month);
  const year = parseIntFilter(req.query.year);
  if (!inst.ok || !emp.ok || !month.ok || !year.ok) {
    sendBadRequest(res, MSG.badId);
    return null;
  }
  const query: Record<string, any> = { ...tenant };
  // Institute account: always its own institute, whatever the query said.
  if (caller.isInstitute) query.instituteId = caller.instituteId;
  else if (inst.value) query.instituteId = inst.value;
  if (emp.value) query.employeeId = emp.value;
  if (month.value !== undefined) query.month = month.value;
  if (year.value !== undefined) query.year = year.value;
  return query;
};

/** The ids a salary body links to must live in the same Mahallu (and institute, for an institute account). */
const salaryRefsOk = async (
  res: Response,
  caller: CallerScope,
  tenantId: string,
  body: Record<string, any>
): Promise<boolean> => {
  const refs: any[] = [{ model: Employee, id: body.employeeId }];
  if (!caller.isInstitute) refs.push({ model: Institute, id: body.instituteId, kind: 'institute' });
  if (!(await refsInScope(caller, tenantId, refs))) {
    sendForeignRef(res);
    return false;
  }
  return true;
};

export const getAllSalaryPayments = async (req: AuthRequest, res: Response) => {
  try {
    const caller = requireScope(req, res);
    if (!caller) return;
    const query = salaryFilters(req, res, caller);
    if (!query) return;
    const { page, limit, skip } = getPaginationParams(req);
    if (typeof req.query.status === 'string' && req.query.status) query.status = req.query.status;

    // aggregate() does not cast like find() does, so ids must be real ObjectIds to match anything.
    const match: Record<string, any> = { ...query };
    for (const key of ['tenantId', 'instituteId', 'employeeId']) {
      if (match[key]) match[key] = new mongoose.Types.ObjectId(String(match[key]));
    }

    const [payments, total, byStatus] = await Promise.all([
      SalaryPayment.find(query)
        .populate('instituteId', 'name type')
        .populate('employeeId', 'name designation')
        .sort({ year: -1, month: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      SalaryPayment.countDocuments(query),
      SalaryPayment.aggregate([
        { $match: match },
        { $group: { _id: '$status', count: { $sum: 1 }, netAmount: { $sum: '$netAmount' } } },
      ]),
    ]);

    // Whole filtered set (not just this page), so the Total Paid / Total Pending cards are right on any page.
    const bucket = (status: string) => byStatus.find((row: any) => row._id === status);
    const summary = {
      count: total,
      paidAmount: round2(Number(bucket('paid')?.netAmount ?? 0)),
      pendingAmount: round2(Number(bucket('pending')?.netAmount ?? 0)),
      cancelledAmount: round2(Number(bucket('cancelled')?.netAmount ?? 0)),
      paidCount: Number(bucket('paid')?.count ?? 0),
      pendingCount: Number(bucket('pending')?.count ?? 0),
      cancelledCount: Number(bucket('cancelled')?.count ?? 0),
    };

    res.json({ ...createPaginationResponse(payments, total, page, limit), summary });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the salary payments right now. Please try again.');
  }
};

export const getSalaryPaymentById = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireScope(req, res)) return;
    const payment = await SalaryPayment.findById(req.params.id)
      .populate('instituteId', 'name type')
      .populate('employeeId', 'name designation salary');
    if (!payment) {
      return res.status(404).json({ success: false, message: "We couldn't find that salary payment. It may have been removed." });
    }

    if (!verifyRecordAccess(req, res, payment, 'SalaryPayment')) {
      return;
    }

    res.json({ success: true, data: payment });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the salary payment right now. Please try again.');
  }
};

/** The only fields a client may send on a salary payment. netAmount is never one of them. */
const SALARY_FIELDS = [
  'employeeId',
  'instituteId',
  'month',
  'year',
  'baseSalary',
  'allowances',
  'deductions',
  'paymentDate',
  'paymentMethod',
  'referenceNo',
  'status',
  'remarks',
] as const;

const pickFields = (source: Record<string, any>): Record<string, any> => {
  const picked: Record<string, any> = {};
  for (const key of SALARY_FIELDS) if (source[key] !== undefined) picked[key] = source[key];
  return picked;
};

type SalaryStatus = 'pending' | 'paid' | 'cancelled';

/** pending -> paid -> cancelled. A paid payment never goes back to pending; cancelled is final. */
export const canMoveSalaryStatus = (from: SalaryStatus, to: SalaryStatus): boolean =>
  from === to || (from === 'pending' && (to === 'paid' || to === 'cancelled')) || (from === 'paid' && to === 'cancelled');

const LEDGER_FAILED =
  "We couldn't record this payment in the accounts, so nothing was saved. Please try again.";
const LEDGER_FAILED_DELETE =
  "We couldn't remove this payment from the accounts, so it was not deleted. Please try again.";

const rawId = (value: any) => (value && value._id !== undefined ? value._id : value);

/** Net pay computed on the server only: base + allowances - deductions, to 2 decimals. */
export const computeNetAmount = (base: number, allowances: number, deductions: number): number =>
  round2(base + allowances - deductions);

/**
 * The three money parts as numbers: from the body where it carries them, else from the stored
 * payment. null after answering 400 when a part is not a valid amount or the net is out of range.
 */
const resolveAmounts = (
  res: Response,
  body: Record<string, any>,
  stored?: Record<string, any>
): { baseSalary: number; allowances: number; deductions: number; netAmount: number } | null => {
  const pick = (key: 'baseSalary' | 'allowances' | 'deductions', min: number): number | null => {
    if (body[key] !== undefined && body[key] !== null && body[key] !== '') return parseAmountInRange(body[key], min);
    // Not submitted: the stored figure (it passed validation when it was saved).
    const kept = round2(Number(stored?.[key] ?? 0));
    return Number.isFinite(kept) && kept >= min && kept <= MAX_AMOUNT ? kept : null;
  };
  const baseSalary = pick('baseSalary', 0.01);
  const allowances = pick('allowances', 0);
  const deductions = pick('deductions', 0);
  if (baseSalary === null) {
    sendBadRequest(res, 'Please enter a base salary greater than zero (up to 2 decimal places).');
    return null;
  }
  if (allowances === null || deductions === null) {
    sendBadRequest(res, 'Please enter allowances and deductions as amounts of zero or more (up to 2 decimal places).');
    return null;
  }
  const netAmount = computeNetAmount(baseSalary, allowances, deductions);
  if (netAmount < 0) {
    sendBadRequest(res, 'Deductions cannot be more than the base salary plus allowances.');
    return null;
  }
  if (netAmount > MAX_AMOUNT) {
    sendBadRequest(res, 'The net salary is larger than the amount this system can record.');
    return null;
  }
  return { baseSalary, allowances, deductions, netAmount };
};

/** An employee can only be paid under the institute they belong to. */
const employeeInInstitute = async (res: Response, employeeId: unknown, instituteId: unknown): Promise<boolean> => {
  if (!employeeId || !instituteId) return true;
  const employee: any = await Employee.findById(employeeId).select('instituteId').lean();
  if (!employee || String(rawId(employee.instituteId)) !== String(rawId(instituteId))) {
    sendBadRequest(res, 'That employee does not belong to the selected institute.');
    return false;
  }
  return true;
};

const postSalaryToLedger = (payment: any) =>
  postLedgerEntry({
    tenantId: rawId(payment.tenantId),
    instituteId: rawId(payment.instituteId),
    ledgerName: 'Salary Payments',
    ledgerType: 'expense',
    amount: payment.netAmount,
    description: `Salary payment - ${payment.month}/${payment.year}`,
    date: payment.paymentDate,
    source: 'salary',
    sourceId: payment._id,
    paymentMethod: payment.paymentMethod,
    referenceNo: payment.referenceNo,
  });

const POPULATE_INSTITUTE = ['instituteId', 'name type'] as const;
const POPULATE_EMPLOYEE = ['employeeId', 'name designation'] as const;

export const createSalaryPayment = async (req: AuthRequest, res: Response) => {
  try {
    const caller = requireWriteScope(req, res);
    if (!caller) return;

    // Whitelisted: tenantId, netAmount and anything else a client adds never reach the model.
    const paymentData = pickFields(req.body || {});
    paymentData.tenantId = caller.tenantId;
    const forcedInstitute = instituteForWrite(caller, paymentData.instituteId);
    if (forcedInstitute !== undefined) paymentData.instituteId = forcedInstitute;
    if (!(await salaryRefsOk(res, caller, caller.tenantId, paymentData))) return;
    if (!(await employeeInInstitute(res, paymentData.employeeId, paymentData.instituteId))) return;

    const status: SalaryStatus = paymentData.status ?? 'pending';
    if (status !== 'pending' && status !== 'paid') {
      return sendBadRequest(res, 'A new salary payment can only be pending or paid.');
    }
    paymentData.status = status;

    const amounts = resolveAmounts(res, paymentData);
    if (!amounts) return;
    Object.assign(paymentData, amounts); // netAmount is ours, whatever the client sent

    const payment = new SalaryPayment(paymentData);
    await payment.save();

    // A payment recorded as paid is posted to the accounts. If that fails the payment is removed
    // again: a paid salary with no ledger entry would silently understate expenses.
    if (payment.status === 'paid') {
      try {
        await postSalaryToLedger(payment);
      } catch (ledgerError) {
        console.error('Failed to post salary to ledger; removing the payment:', ledgerError);
        const { failed } = await runUndos(
          { flow: 'salary create', entity: 'SalaryPayment', entityId: payment._id, tenantId: payment.tenantId },
          [
            { label: 'reverse salary ledger entry', undo: () => reverseLedgerEntry('salary', payment._id as any) },
            { label: 'remove salary payment', undo: () => SalaryPayment.findByIdAndDelete(payment._id) },
          ],
          ledgerError
        );
        // A payment that could not be taken back, or a ledger that is half-posted, needs an administrator.
        if (failed.length > 0 || ledgerError instanceof ReconciliationRequiredError) return sendReconciliationRequired(res);
        return res.status(500).json({ success: false, message: LEDGER_FAILED });
      }
    }

    const populated = await SalaryPayment.findById(payment._id)
      .populate(...POPULATE_INSTITUTE)
      .populate(...POPULATE_EMPLOYEE);
    res.status(201).json({ success: true, data: populated });
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A salary payment for this employee already exists for that month.',
      });
    }
    sendFailure(res, error, 'We couldn\'t save the salary payment. Please try again.');
  }
};

export const updateSalaryPayment = async (req: AuthRequest, res: Response) => {
  try {
    const caller = requireScope(req, res);
    if (!caller) return;
    const existing: any = await SalaryPayment.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "We couldn't find that salary payment. It may have been removed." });
    }

    if (!verifyRecordAccess(req, res, existing, 'SalaryPayment')) {
      return;
    }

    const prev: Record<string, any> = typeof existing.toObject === 'function' ? existing.toObject() : { ...existing };
    const from = (prev.status || 'pending') as SalaryStatus;
    if (from === 'cancelled') {
      return res.status(409).json({ success: false, message: 'A cancelled salary payment cannot be changed.' });
    }

    // Whitelisted, tenantId never writable; an institute account cannot move a payment to another institute.
    const update = pickFields(cleanBody(req.body, caller));
    if (!(await salaryRefsOk(res, caller, String(existing.tenantId), update))) return;
    if (update.employeeId !== undefined || update.instituteId !== undefined) {
      const employeeId = update.employeeId ?? prev.employeeId;
      const instituteId = update.instituteId ?? prev.instituteId;
      if (!(await employeeInInstitute(res, employeeId, instituteId))) return;
    }

    const to = (update.status ?? from) as SalaryStatus;
    if (!canMoveSalaryStatus(from, to)) {
      return res.status(409).json({
        success: false,
        message: 'A paid salary payment cannot be set back to pending. Cancel it and record a new one instead.',
      });
    }

    // Net is recomputed here, from the stored and the submitted parts, never taken from the client.
    const amountsTouched = ['baseSalary', 'allowances', 'deductions'].some((k) => update[k] !== undefined);
    if (amountsTouched) {
      const amounts = resolveAmounts(res, update, prev);
      if (!amounts) return;
      update.netAmount = amounts.netAmount;
      for (const key of ['baseSalary', 'allowances', 'deductions'] as const) {
        if (update[key] !== undefined) update[key] = amounts[key];
      }
    }

    // Which ledger work this change needs. The ledger entry exists only while the payment is paid.
    const wasPaid = from === 'paid';
    const willBePaid = to === 'paid';
    const ledgerFacts = ['month', 'year', 'netAmount', 'paymentDate', 'paymentMethod', 'referenceNo', 'instituteId'];
    const sameValue = (a: any, b: any) =>
      a instanceof Date || b instanceof Date
        ? new Date(a).getTime() === new Date(b).getTime()
        : String(rawId(a) ?? '') === String(rawId(b) ?? '');
    const factsChanged = ledgerFacts.some((k) => update[k] !== undefined && !sameValue(update[k], prev[k]));
    const reverseNeeded = wasPaid && (!willBePaid || factsChanged);
    const postNeeded = willBePaid && (!wasPaid || factsChanged);

    // The status in the filter makes concurrent transitions lose cleanly instead of double-posting.
    const claim: Record<string, any> = { _id: existing._id, status: from };
    // An edit of the figures (or of a paid payment's ledger entry) is claimed on the version that was read as
    // well: the net was computed from that snapshot, so another edit slipping in between would be overwritten
    // by a net that no longer matches its parts.
    if ((amountsTouched || reverseNeeded || postNeeded) && prev.updatedAt) claim.updatedAt = prev.updatedAt;
    let payment: any;
    try {
      payment = await SalaryPayment.findOneAndUpdate(
        claim,
        update,
        { new: true, runValidators: true }
      )
        .populate(...POPULATE_INSTITUTE)
        .populate(...POPULATE_EMPLOYEE);
    } catch (error: any) {
      if (error?.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'A salary payment for this employee already exists for that month.',
        });
      }
      throw error;
    }
    if (!payment) {
      return res.status(409).json({
        success: false,
        message: 'This salary payment was changed by someone else. Please reload it and try again.',
      });
    }

    if (reverseNeeded || postNeeded) {
      try {
        if (reverseNeeded) await reverseLedgerEntry('salary', existing._id as any);
        if (postNeeded) await postSalaryToLedger({ ...payment.toObject?.() ?? payment, _id: existing._id, tenantId: existing.tenantId, instituteId: rawId(payment.instituteId) });
      } catch (ledgerError) {
        console.error('Failed to update salary ledger entry; restoring the payment:', ledgerError);
        // Back to exactly what was stored: the old values, and the old ledger entry if there was one.
        const { failed } = await runUndos(
          { flow: 'salary update', entity: 'SalaryPayment', entityId: existing._id, tenantId: existing.tenantId },
          [
            {
              label: 'restore salary payment',
              undo: async () => {
                const restore: Record<string, any> = {};
                for (const key of Object.keys(update)) restore[key] = prev[key];
                await SalaryPayment.findOneAndUpdate({ _id: existing._id }, restore, { runValidators: false });
              },
            },
            {
              label: 'restore salary ledger entry',
              undo: async () => {
                await reverseLedgerEntry('salary', existing._id as any);
                if (wasPaid) await postSalaryToLedger({ ...prev, _id: existing._id });
              },
            },
          ],
          ledgerError
        );
        if (failed.length > 0 || ledgerError instanceof ReconciliationRequiredError) return sendReconciliationRequired(res);
        return res.status(500).json({ success: false, message: LEDGER_FAILED });
      }

      // Another edit of this payment may have been claimed while this one was posting: its reverse + post can
      // interleave with ours, and a post is skipped when an entry already exists, so the entry could be left
      // holding the OTHER edit's figures. Whoever finishes last makes the entry match what is stored now.
      try {
        const versionOf = (doc: any) => (doc?.updatedAt ? new Date(doc.updatedAt).getTime() : 0);
        let version = versionOf(payment);
        for (let pass = 0; pass < 3; pass += 1) {
          const latest: any = await SalaryPayment.findById(existing._id);
          if (!latest || versionOf(latest) === version) break;
          version = versionOf(latest);
          await reverseLedgerEntry('salary', existing._id as any);
          if (latest.status === 'paid') {
            const plain = typeof latest.toObject === 'function' ? latest.toObject() : latest;
            await postSalaryToLedger({ ...plain, _id: existing._id, tenantId: existing.tenantId, instituteId: rawId(plain.instituteId) });
          }
        }
      } catch (syncError) {
        await reportReconciliationRequired({
          flow: 'salary update',
          entity: 'SalaryPayment',
          entityId: existing._id,
          tenantId: existing.tenantId,
          step: 'sync ledger entry after a concurrent edit',
          reason: syncError,
        });
        return sendReconciliationRequired(res);
      }
    }

    res.json({ success: true, data: payment });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the salary payment. Please try again.');
  }
};

export const deleteSalaryPayment = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireScope(req, res)) return;
    const payment: any = await SalaryPayment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, message: "We couldn't find that salary payment. It may have been removed." });
    }

    if (!verifyRecordAccess(req, res, payment, 'SalaryPayment')) {
      return;
    }

    // Only a paid payment has a ledger entry. If it cannot be reversed the payment stays, so the
    // books and the payment list never disagree.
    const wasPaid = payment.status === 'paid';
    if (wasPaid) {
      try {
        await reverseLedgerEntry('salary', payment._id as any);
      } catch (ledgerError) {
        console.error('Failed to reverse salary ledger entry; payment not deleted:', ledgerError);
        if (ledgerError instanceof ReconciliationRequiredError) return sendReconciliationRequired(res);
        return res.status(500).json({ success: false, message: LEDGER_FAILED_DELETE });
      }
    }

    try {
      await SalaryPayment.findByIdAndDelete(req.params.id);
    } catch (deleteError) {
      if (wasPaid) {
        const { failed } = await runUndos(
          { flow: 'salary delete', entity: 'SalaryPayment', entityId: payment._id, tenantId: payment.tenantId },
          [
            {
              label: 'restore salary ledger entry',
              undo: async () => {
                const plain = typeof payment.toObject === 'function' ? payment.toObject() : payment;
                await postSalaryToLedger(plain);
              },
            },
          ],
          deleteError
        );
        // The ledger entry is gone and the payment is still listed: the books and the list disagree.
        if (failed.length > 0) return sendReconciliationRequired(res);
      }
      throw deleteError;
    }
    res.json({ success: true, message: 'Salary payment deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the salary payment. Please try again.');
  }
};

export const getSalarySummary = async (req: AuthRequest, res: Response) => {
  try {
    const caller = requireScope(req, res);
    if (!caller) return;
    const query = salaryFilters(req, res, caller);
    if (!query) return;
    // A cancelled payment is not a salary that was paid or is due: it stays out of every total.
    query.status = { $ne: 'cancelled' };
    // aggregate() does not cast like find() does, so ids must be real ObjectIds to match anything.
    if (query.tenantId) query.tenantId = new mongoose.Types.ObjectId(query.tenantId);
    if (query.instituteId) query.instituteId = new mongoose.Types.ObjectId(query.instituteId);
    if (query.employeeId) query.employeeId = new mongoose.Types.ObjectId(query.employeeId);

    const summary = await SalaryPayment.aggregate([
      { $match: query },
      {
        $group: {
          _id: { instituteId: '$instituteId', month: '$month', year: '$year' },
          totalBaseSalary: { $sum: '$baseSalary' },
          totalAllowances: { $sum: '$allowances' },
          totalDeductions: { $sum: '$deductions' },
          totalNetAmount: { $sum: '$netAmount' },
          totalEmployees: { $sum: 1 },
          paidCount: {
            $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] },
          },
          pendingCount: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
          },
        },
      },
      {
        $lookup: {
          from: 'institutes',
          localField: '_id.instituteId',
          foreignField: '_id',
          as: 'institute',
        },
      },
      { $unwind: { path: '$institute', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          instituteName: '$institute.name',
          instituteType: '$institute.type',
          month: '$_id.month',
          year: '$_id.year',
          totalBaseSalary: 1,
          totalAllowances: 1,
          totalDeductions: 1,
          totalNetAmount: 1,
          totalEmployees: 1,
          paidCount: 1,
          pendingCount: 1,
        },
      },
      { $sort: { year: -1, month: -1 } },
    ]);

    res.json({ success: true, data: summary });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the salary summary right now. Please try again.');
  }
};

export const getEmployeeSalaryHistory = async (req: AuthRequest, res: Response) => {
  try {
    const caller = requireScope(req, res);
    if (!caller) return;
    const { employeeId } = req.params;

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: "We couldn't find that employee. It may have been removed." });
    }

    if (!verifyRecordAccess(req, res, employee, 'Employee')) {
      return;
    }

    const historyQuery: Record<string, any> = { employeeId, tenantId: employee.tenantId };
    if (caller.isInstitute) historyQuery.instituteId = caller.instituteId;

    const payments = await SalaryPayment.find(historyQuery)
      .populate('instituteId', 'name type')
      .sort({ year: -1, month: -1 });

    res.json({ success: true, data: { employee, payments } });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the employee salary history right now. Please try again.');
  }
};
