import { Response } from 'express';
import SalaryPayment from '../models/SalaryPayment';
import Employee from '../models/Employee';
import Institute from '../models/Institute';
import { stripImmutable, refBelongsToTenant } from '../utils/sanitizeUpdate';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { verifyTenantOwnership } from '../utils/tenantCheck';
import { LedgerItem } from '../models/MasterAccount';
import { postLedgerEntry, reverseLedgerEntry } from '../services/ledgerPostingService';
import { ensurePeriodOpen } from '../utils/periodLock';

export const getAllSalaryPayments = async (req: AuthRequest, res: Response) => {
  try {
    const { instituteId, employeeId, month, year, status, tenantId } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = {};

    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (tenantId && req.isSuperAdmin) {
      query.tenantId = tenantId;
    }

    if (instituteId) query.instituteId = instituteId;
    if (employeeId) query.employeeId = employeeId;
    if (month) query.month = parseInt(month as string);
    if (year) query.year = parseInt(year as string);
    if (status) query.status = status;

    const [payments, total] = await Promise.all([
      SalaryPayment.find(query)
        .populate('instituteId', 'name type')
        .populate('employeeId', 'name designation')
        .sort({ year: -1, month: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      SalaryPayment.countDocuments(query),
    ]);

    res.json(createPaginationResponse(payments, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSalaryPaymentById = async (req: AuthRequest, res: Response) => {
  try {
    const payment = await SalaryPayment.findById(req.params.id)
      .populate('instituteId', 'name type')
      .populate('employeeId', 'name designation salary');
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Salary payment not found' });
    }

    if (!verifyTenantOwnership(req, res, payment.tenantId, 'SalaryPayment')) {
      return;
    }

    res.json({ success: true, data: payment });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createSalaryPayment = async (req: AuthRequest, res: Response) => {
  try {
    const paymentData: Record<string, any> = {
      ...(stripImmutable(req.body) as Record<string, any>),
      tenantId: req.tenantId || req.body.tenantId,
    };

    if (!paymentData.tenantId && !req.isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required',
      });
    }

    if (
      !(await refBelongsToTenant(Employee, paymentData.employeeId, paymentData.tenantId)) ||
      !(await refBelongsToTenant(Institute, paymentData.instituteId, paymentData.tenantId))
    ) {
      return res.status(400).json({ success: false, message: 'Employee or institute does not belong to this Mahallu' });
    }

    // Calculate net amount if not provided
    if (!paymentData.netAmount) {
      paymentData.netAmount = (paymentData.baseSalary || 0) + (paymentData.allowances || 0) - (paymentData.deductions || 0);
    }

    if (!(await ensurePeriodOpen(res, paymentData.tenantId, paymentData.paymentDate))) return;

    const payment = new SalaryPayment(paymentData);
    await payment.save();

    // Auto-post to ledger if payment is marked as paid
    if (payment.status === 'paid') {
      try {
        await postLedgerEntry({
          tenantId: payment.tenantId,
          instituteId: payment.instituteId,
          ledgerName: 'Salary Payments',
          ledgerType: 'expense',
          amount: payment.netAmount,
          description: `Salary payment - ${payment.month}/${payment.year}`,
          date: payment.paymentDate,
          source: 'salary',
          sourceId: payment._id as any,
          paymentMethod: payment.paymentMethod,
          referenceNo: payment.referenceNo,
        });
      } catch (ledgerError: any) {
        // A paid salary without its expense would silently understate spending: undo and tell the user
        console.error('Failed to auto-post salary to ledger:', ledgerError);
        await SalaryPayment.deleteOne({ _id: payment._id });
        return res.status(ledgerError?.statusCode === 423 ? 423 : 500).json({
          success: false,
          message: `Salary payment was not saved because it could not be posted to the ledger: ${ledgerError.message}`,
        });
      }
    }

    const populated = await SalaryPayment.findById(payment._id)
      .populate('instituteId', 'name type')
      .populate('employeeId', 'name designation');
    res.status(201).json({ success: true, data: populated });
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Salary payment already exists for this employee in the given month/year',
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSalaryPayment = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await SalaryPayment.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Salary payment not found' });
    }

    if (!verifyTenantOwnership(req, res, existing.tenantId, 'SalaryPayment')) {
      return;
    }

    const body = stripImmutable(req.body) as Record<string, any>;
    if (!(await ensurePeriodOpen(res, existing.tenantId, [existing.paymentDate, body.paymentDate]))) return;
    // Recalculate net amount if salary components are being updated
    if (body.baseSalary !== undefined || body.allowances !== undefined || body.deductions !== undefined) {
      const base = body.baseSalary ?? existing.baseSalary;
      const allowances = body.allowances ?? existing.allowances;
      const deductions = body.deductions ?? existing.deductions;
      body.netAmount = base + allowances - deductions;
    }

    // The employee / institute cannot be moved to another tenant's records
    if (
      !(await refBelongsToTenant(Employee, body.employeeId, existing.tenantId)) ||
      !(await refBelongsToTenant(Institute, body.instituteId, existing.tenantId))
    ) {
      return res.status(400).json({ success: false, message: 'Employee or institute does not belong to this Mahallu' });
    }
    const previous = existing.toObject();

    const payment = await SalaryPayment.findByIdAndUpdate(
      req.params.id,
      body,
      { new: true, runValidators: true }
    )
      .populate('instituteId', 'name type')
      .populate('employeeId', 'name designation');

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Salary payment not found' });
    }

    // Re-post to ledger: reverse old entry, create new if paid. If it fails, restore the record and
    // the old ledger entry so the books never silently lose the expense.
    const postParams = (p: any) => ({
      tenantId: p.tenantId,
      // populated documents expose _id; plain ids pass through
      instituteId: (p.instituteId && (p.instituteId as any)._id) || p.instituteId,
      ledgerName: 'Salary Payments',
      ledgerType: 'expense' as const,
      amount: p.netAmount,
      description: `Salary payment - ${p.month}/${p.year}`,
      date: p.paymentDate,
      source: 'salary' as const,
      sourceId: p._id as any,
      paymentMethod: p.paymentMethod,
      referenceNo: p.referenceNo,
    });
    try {
      await reverseLedgerEntry('salary', existing._id as any);
      if (payment.status === 'paid') await postLedgerEntry(postParams(payment));
    } catch (ledgerError: any) {
      console.error('Failed to update salary ledger entry:', ledgerError);
      const { _id, ...oldFields } = previous as any;
      await SalaryPayment.replaceOne({ _id }, oldFields).catch(() => undefined);
      try {
        const stillThere = await LedgerItem.exists({ source: 'salary', sourceId: existing._id });
        if (!stillThere && previous.status === 'paid') await postLedgerEntry(postParams(previous));
      } catch (restoreError) {
        console.error('Could not restore the previous salary ledger entry:', restoreError);
      }
      return res.status(ledgerError?.statusCode === 423 ? 423 : 500).json({
        success: false,
        message: `Salary payment was not changed because the ledger could not be updated: ${ledgerError.message}`,
      });
    }

    res.json({ success: true, data: payment });
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Salary payment already exists for this employee in the given month/year' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteSalaryPayment = async (req: AuthRequest, res: Response) => {
  try {
    const payment = await SalaryPayment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Salary payment not found' });
    }

    if (!verifyTenantOwnership(req, res, payment.tenantId, 'SalaryPayment')) {
      return;
    }

    if (!(await ensurePeriodOpen(res, payment.tenantId, payment.paymentDate))) return;

    // Reverse any auto-posted ledger entries
    try {
      await reverseLedgerEntry('salary', payment._id as any);
    } catch (ledgerError: any) {
      console.error('Failed to reverse salary ledger entry:', ledgerError);
      return res.status(ledgerError?.statusCode === 423 ? 423 : 500).json({
        success: false,
        message: `Salary payment was not deleted because its ledger entry could not be reversed: ${ledgerError.message}`,
      });
    }

    await SalaryPayment.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Salary payment deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSalarySummary = async (req: AuthRequest, res: Response) => {
  try {
    const { instituteId, month, year } = req.query;
    const query: any = {};

    if (req.tenantId) {
      query.tenantId = req.tenantId;
    }

    if (instituteId) query.instituteId = instituteId;
    if (month) query.month = parseInt(month as string);
    if (year) query.year = parseInt(year as string);

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
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getEmployeeSalaryHistory = async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId } = req.params;

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    if (!verifyTenantOwnership(req, res, employee.tenantId, 'Employee')) {
      return;
    }

    const payments = await SalaryPayment.find({ employeeId })
      .populate('instituteId', 'name type')
      .sort({ year: -1, month: -1 });

    res.json({ success: true, data: { employee, payments } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
