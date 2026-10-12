import { Response } from 'express';
import Employee from '../models/Employee';
import Institute from '../models/Institute';
import { stripImmutable, refBelongsToTenant, clearableUpdate } from '../utils/sanitizeUpdate';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { verifyTenantOwnership } from '../utils/tenantCheck';

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
        { name: { $regex: search, $options: 'i' } },
        { designation: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
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
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getEmployeeById = async (req: AuthRequest, res: Response) => {
  try {
    const employee = await Employee.findById(req.params.id)
      .populate('instituteId', 'name type');
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    if (!verifyTenantOwnership(req, res, employee.tenantId, 'Employee')) {
      return;
    }

    res.json({ success: true, data: employee });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createEmployee = async (req: AuthRequest, res: Response) => {
  try {
    const employeeData: Record<string, any> = {
      ...(stripImmutable(req.body) as Record<string, any>),
      tenantId: req.tenantId || req.body.tenantId,
    };

    if (!employeeData.tenantId && !req.isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required',
      });
    }

    if (!employeeData.instituteId) {
      return res.status(400).json({
        success: false,
        message: 'Institute ID is required',
      });
    }

    if (!(await refBelongsToTenant(Institute, employeeData.instituteId, employeeData.tenantId))) {
      return res.status(400).json({ success: false, message: 'Institute does not belong to this Mahallu' });
    }

    const employee = new Employee(employeeData);
    await employee.save();
    const populated = await Employee.findById(employee._id)
      .populate('instituteId', 'name type');
    res.status(201).json({ success: true, data: populated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateEmployee = async (req: AuthRequest, res: Response) => {
  try {
    const existingEmployee = await Employee.findById(req.params.id);
    if (!existingEmployee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    if (!verifyTenantOwnership(req, res, existingEmployee.tenantId, 'Employee')) {
      return;
    }

    const body = stripImmutable(req.body) as Record<string, any>;
    if (body.instituteId && !(await refBelongsToTenant(Institute, body.instituteId, existingEmployee.tenantId))) {
      return res.status(400).json({ success: false, message: 'Institute does not belong to this Mahallu' });
    }

    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      clearableUpdate(body),
      { new: true, runValidators: true }
    ).populate('instituteId', 'name type');

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    res.json({ success: true, data: employee });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteEmployee = async (req: AuthRequest, res: Response) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    if (!verifyTenantOwnership(req, res, employee.tenantId, 'Employee')) {
      return;
    }

    await Employee.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Employee deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
