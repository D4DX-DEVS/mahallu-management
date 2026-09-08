import { Response } from 'express';
import Employee from '../models/Employee';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { verifyTenantOwnership } from '../utils/tenantCheck';

import { sendFailure } from '../utils/userMessages';
import { regexLiteral } from '../utils/queryGuard';

export const getAllEmployees = async (req: AuthRequest, res: Response) => {
  try {
    const { instituteId, status, search, tenantId } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = {};

    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (tenantId && req.isSuperAdmin) {
      query.tenantId = tenantId;
    }

    if (instituteId) query.instituteId = instituteId;
    if (status) query.status = status;
    if (search) {
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
    const employee = await Employee.findById(req.params.id)
      .populate('instituteId', 'name type');
    if (!employee) {
      return res.status(404).json({ success: false, message: "We couldn't find that employee. It may have been removed." });
    }

    if (!verifyTenantOwnership(req, res, employee.tenantId, 'Employee')) {
      return;
    }

    res.json({ success: true, data: employee });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the employee right now. Please try again.');
  }
};

export const createEmployee = async (req: AuthRequest, res: Response) => {
  try {
    const employeeData = {
      ...req.body,
      tenantId: req.tenantId || req.body.tenantId,
    };

    if (!employeeData.tenantId && !req.isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Please select a Mahallu before continuing.',
      });
    }

    if (!employeeData.instituteId) {
      return res.status(400).json({
        success: false,
        message: 'Please select an institute before continuing.',
      });
    }

    const employee = new Employee(employeeData);
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
    const existingEmployee = await Employee.findById(req.params.id);
    if (!existingEmployee) {
      return res.status(404).json({ success: false, message: "We couldn't find that employee. It may have been removed." });
    }

    if (!verifyTenantOwnership(req, res, existingEmployee.tenantId, 'Employee')) {
      return;
    }

    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      req.body,
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
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ success: false, message: "We couldn't find that employee. It may have been removed." });
    }

    if (!verifyTenantOwnership(req, res, employee.tenantId, 'Employee')) {
      return;
    }

    await Employee.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Employee deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the employee. Please try again.');
  }
};
