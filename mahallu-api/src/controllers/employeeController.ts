import { Response } from 'express';
import Employee from '../models/Employee';
import Institute from '../models/Institute';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { parseAmountInRange } from '../utils/money';
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
} from '../utils/scope';

import { sendFailure } from '../utils/userMessages';
import { asFilterValue, regexLiteral } from '../utils/queryGuard';

/**
 * Access control for employees (records that carry salary and bank details).
 *  - Lists: tenant-scoped and fail closed; an institute account is pinned to its OWN institute
 *    whatever ?instituteId= says.
 *  - By id: the employee must be in the caller's Mahallu and, for an institute account, their institute.
 *  - Create / update: a whitelist of fields (tenantId, _id, timestamps and anything unknown never
 *    reach the model); an institute account's instituteId is forced to its own; a named institute must
 *    belong to the caller's Mahallu. Salary is a validated amount; bank details are digits-only /
 *    IFSC-shaped (route validators) and are rebuilt from known sub-fields only.
 */

const EMPLOYEE_FIELDS = [
  'name',
  'nameMl',
  'phone',
  'email',
  'designation',
  'designationMl',
  'department',
  'joinDate',
  'salary',
  'status',
  'address',
  'qualifications',
] as const;

const BANK_FIELDS = ['accountNumber', 'bankName', 'ifscCode'] as const;

/**
 * The writable part of a body. `bankAccount` is rebuilt from its three known sub-fields only.
 * Returns null after answering 400 when a value is not acceptable.
 */
const writableFields = (res: Response, body: Record<string, any>): Record<string, any> | null => {
  const picked: Record<string, any> = {};
  for (const key of EMPLOYEE_FIELDS) if (body[key] !== undefined) picked[key] = body[key];

  if (picked.salary !== undefined) {
    const salary = parseAmountInRange(picked.salary, 0);
    if (salary === null) {
      sendBadRequest(res, 'Please enter a salary of zero or more (up to 2 decimal places).');
      return null;
    }
    picked.salary = salary;
  }

  if (body.bankAccount !== undefined && body.bankAccount !== null) {
    if (typeof body.bankAccount !== 'object' || Array.isArray(body.bankAccount)) {
      sendBadRequest(res, 'Please check the bank details and try again.');
      return null;
    }
    const bank: Record<string, string> = {};
    for (const key of BANK_FIELDS) {
      const value = body.bankAccount[key];
      if (value === undefined) continue;
      if (typeof value !== 'string') {
        sendBadRequest(res, 'Please check the bank details and try again.');
        return null;
      }
      bank[key] = value;
    }
    if (Object.keys(bank).length > 0) picked.bankAccount = bank;
  }
  return picked;
};

/** For an update: `bankAccount: { ifscCode }` becomes `bankAccount.ifscCode`, so the other bank fields are left alone. */
const forUpdate = (fields: Record<string, any>): Record<string, any> => {
  const { bankAccount, ...rest } = fields;
  for (const [key, value] of Object.entries(bankAccount || {})) rest[`bankAccount.${key}`] = value;
  return rest;
};

export const getAllEmployees = async (req: AuthRequest, res: Response) => {
  try {
    const caller = requireScope(req, res);
    if (!caller) return;
    const tenant = tenantFilterFor(req, res);
    if (!tenant) return;
    const inst = parseIdParam(req.query.instituteId);
    if (!inst.ok) return sendBadRequest(res, MSG.badId);
    const { search } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { ...tenant };

    // An institute account always sees its own institute; the query can only narrow for the others.
    if (caller.isInstitute) query.instituteId = caller.instituteId;
    else if (inst.value) query.instituteId = inst.value;

    const status = asFilterValue(req.query.status);
    if (status) query.status = status;
    if (typeof search === 'string' && search) {
      query.$or = [
        { name: { $regex: regexLiteral(search), $options: 'i' } },
        { designation: { $regex: regexLiteral(search), $options: 'i' } },
        { department: { $regex: regexLiteral(search), $options: 'i' } },
        { phone: { $regex: regexLiteral(search), $options: 'i' } },
      ];
    }

    const [employees, total] = await Promise.all([
      Employee.find(query)
        .populate('instituteId', 'name type')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Employee.countDocuments(query),
    ]);

    res.json(createPaginationResponse(employees, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the employees right now. Please try again.');
  }
};

export const getEmployeeById = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireScope(req, res)) return;
    const employee = await Employee.findById(req.params.id)
      .populate('instituteId', 'name type');
    if (!employee) {
      return res.status(404).json({ success: false, message: "We couldn't find that employee. It may have been removed." });
    }

    if (!verifyRecordAccess(req, res, employee, 'Employee')) {
      return;
    }

    res.json({ success: true, data: employee });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the employee right now. Please try again.');
  }
};

export const createEmployee = async (req: AuthRequest, res: Response) => {
  try {
    const caller = requireWriteScope(req, res);
    if (!caller) return;

    const body = cleanBody(req.body, caller);
    const instituteId = instituteForWrite(caller, body.instituteId);
    if (!instituteId) {
      return res.status(400).json({
        success: false,
        message: 'Please select an institute before continuing.',
      });
    }
    if (!caller.isInstitute) {
      if (!(await refsInScope(caller, caller.tenantId, [{ model: Institute, id: instituteId, kind: 'institute' }]))) {
        return sendForeignRef(res);
      }
    }

    const fields = writableFields(res, body);
    if (!fields) return;
    if (fields.salary === undefined) {
      return sendBadRequest(res, 'Please enter the salary.');
    }

    const employee = new Employee({ ...fields, tenantId: caller.tenantId, instituteId });
    await employee.save();
    const populated = await Employee.findById(employee._id)
      .populate('instituteId', 'name type');
    res.status(201).json({ success: true, data: populated });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the employee. Please try again.');
  }
};

export const updateEmployee = async (req: AuthRequest, res: Response) => {
  try {
    const caller = requireScope(req, res);
    if (!caller) return;
    const existingEmployee = await Employee.findById(req.params.id);
    if (!existingEmployee) {
      return res.status(404).json({ success: false, message: "We couldn't find that employee. It may have been removed." });
    }

    if (!verifyRecordAccess(req, res, existingEmployee, 'Employee')) {
      return;
    }

    // tenantId is never writable; an institute account cannot move an employee to another institute.
    const body = cleanBody(req.body, caller);
    const fields = writableFields(res, body);
    if (!fields) return;
    const update = forUpdate(fields);
    if (!caller.isInstitute && body.instituteId !== undefined && body.instituteId !== '') {
      if (!(await refsInScope(
        { ...caller },
        String(existingEmployee.tenantId),
        [{ model: Institute, id: body.instituteId, kind: 'institute' }]
      ))) {
        return sendForeignRef(res);
      }
      update.instituteId = body.instituteId;
    }

    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true }
    ).populate('instituteId', 'name type');

    if (!employee) {
      return res.status(404).json({ success: false, message: "We couldn't find that employee. It may have been removed." });
    }
    res.json({ success: true, data: employee });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the employee. Please try again.');
  }
};

export const deleteEmployee = async (req: AuthRequest, res: Response) => {
  try {
    if (!requireScope(req, res)) return;
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ success: false, message: "We couldn't find that employee. It may have been removed." });
    }

    if (!verifyRecordAccess(req, res, employee, 'Employee')) {
      return;
    }

    await Employee.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Employee deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the employee. Please try again.');
  }
};
