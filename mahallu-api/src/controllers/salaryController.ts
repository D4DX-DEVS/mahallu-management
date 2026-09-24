import { Response } from 'express';
import SalaryPayment from '../models/SalaryPayment';
import Employee from '../models/Employee';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { verifyTenantOwnership } from '../utils/tenantCheck';
import { postLedgerEntry, reverseLedgerEntry } from '../services/ledgerPostingService';

import { sendFailure } from '../utils/userMessages';

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
    sendFailure(res, error, 'We couldn\'t load the salary payments right now. Please try again.');
  }
};

export const getSalaryPaymentById = async (req: AuthRequest, res: Response) => {
  try {
    const payment = await SalaryPayment.findById(req.params.id)
      .populate('instituteId', 'name type')
      .populate('employeeId', 'name designation salary');
    if (!payment) {
      return res.status(404).json({ success: false, message: "We couldn't find that salary payment. It may have been removed." });
    }

    if (!verifyTenantOwnership(req, res, payment.tenantId, 'SalaryPayment')) {
      return;
    }

    res.json({ success: true, data: payment });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the salary payment right now. Please try again.');
  }
};

export const createSalaryPayment = async (req: AuthRequest, res: Response) => {
  try {
    const paymentData = {
      ...req.body,
      tenantId: req.tenantId || req.body.tenantId,
    };

    if (!paymentData.tenantId && !req.isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Please select a Mahallu before continuing.',
      });
    }

    // Calculate net amount if not provided
    if (!paymentData.netAmount) {
      paymentData.netAmount = (paymentData.baseSalary || 0) + (paymentData.allowances || 0) - (paymentData.deductions || 0);
    }

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
      } catch (ledgerError) {
        console.error('Failed to auto-post salary to ledger:', ledgerError);
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
        message: 'A salary payment for this employee already exists for that month.',
      });
    }
    sendFailure(res, error, 'We couldn\'t save the salary payment. Please try again.');
  }
};

export const updateSalaryPayment = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await SalaryPayment.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "We couldn't find that salary payment. It may have been removed." });
    }

    if (!verifyTenantOwnership(req, res, existing.tenantId, 'SalaryPayment')) {
      return;
    }

    // Recalculate net amount if salary components are being updated
    if (req.body.baseSalary !== undefined || req.body.allowances !== undefined || req.body.deductions !== undefined) {
      const base = req.body.baseSalary ?? existing.baseSalary;
      const allowances = req.body.allowances ?? existing.allowances;
      const deductions = req.body.deductions ?? existing.deductions;
      req.body.netAmount = base + allowances - deductions;
    }

    const payment = await SalaryPayment.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
      .populate('instituteId', 'name type')
      .populate('employeeId', 'name designation');

    if (!payment) {
      return res.status(404).json({ success: false, message: "We couldn't find that salary payment. It may have been removed." });
    }

    // Re-post to ledger: reverse old entry, create new if paid
    try {
      await reverseLedgerEntry('salary', existing._id as any);
      if (payment.status === 'paid') {
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
      }
    } catch (ledgerError) {
      console.error('Failed to update salary ledger entry:', ledgerError);
    }

    res.json({ success: true, data: payment });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the salary payment. Please try again.');
  }
};

export const deleteSalaryPayment = async (req: AuthRequest, res: Response) => {
  try {
    const payment = await SalaryPayment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, message: "We couldn't find that salary payment. It may have been removed." });
    }

    if (!verifyTenantOwnership(req, res, payment.tenantId, 'SalaryPayment')) {
      return;
    }

    // Reverse any auto-posted ledger entries
    try {
      await reverseLedgerEntry('salary', payment._id as any);
    } catch (ledgerError) {
      console.error('Failed to reverse salary ledger entry:', ledgerError);
    }

    await SalaryPayment.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Salary payment deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the salary payment. Please try again.');
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
    sendFailure(res, error, 'We couldn\'t load the salary summary right now. Please try again.');
  }
};

export const getEmployeeSalaryHistory = async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId } = req.params;

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: "We couldn't find that employee. It may have been removed." });
    }

    if (!verifyTenantOwnership(req, res, employee.tenantId, 'Employee')) {
      return;
    }

    const payments = await SalaryPayment.find({ employeeId })
      .populate('instituteId', 'name type')
      .sort({ year: -1, month: -1 });

    res.json({ success: true, data: { employee, payments } });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the employee salary history right now. Please try again.');
  }
};
