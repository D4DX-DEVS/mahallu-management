import { Response } from 'express';
import mongoose from 'mongoose';
import { DevelopmentProject } from '../models/DevelopmentProject';
import { LedgerItem } from '../models/MasterAccount';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { stripImmutable, refBelongsToTenant } from '../utils/sanitizeUpdate';

const tenantScope = (req: AuthRequest) => {
  if (req.tenantId) return req.tenantId;
  if (req.isSuperAdmin && req.query.tenantId) return req.query.tenantId as string;
  return undefined;
};

const scopedQuery = (req: AuthRequest): Record<string, any> => {
  const tenantId = tenantScope(req);
  return tenantId ? { tenantId } : {};
};

/**
 * @swagger
 * /development-projects:
 *   get:
 *     summary: List development projects
 *     tags: [Development]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: area
 *         schema:
 *           type: string
 *           enum: [roads, water, sanitation, environment, education, healthcare, public_facility, govt_scheme, infrastructure, other]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [proposed, approved, in_progress, completed, dropped]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: Project list
 */
export const getAllProjects = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const { area, status, search } = req.query;
    const query: any = scopedQuery(req);
    if (area) query.area = area;
    if (status) query.status = status;
    if (search) query.name = { $regex: search, $options: 'i' };

    const [data, total] = await Promise.all([
      DevelopmentProject.find(query)
        .populate('committeeId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      DevelopmentProject.countDocuments(query),
    ]);
    res.json(createPaginationResponse(data, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @swagger
 * /development-projects/{id}:
 *   get:
 *     summary: Get a development project
 *     tags: [Development]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project
 *       404:
 *         description: Project not found
 */
export const getProjectById = async (req: AuthRequest, res: Response) => {
  try {
    const project = await DevelopmentProject.findById(req.params.id).populate('committeeId', 'name');
    if (!project || (req.tenantId && project.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    res.json({ success: true, data: project });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @swagger
 * /development-projects:
 *   post:
 *     summary: Create a development project
 *     tags: [Development]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, area, estimatedCost]
 *             properties:
 *               name:
 *                 type: string
 *               nameMl:
 *                 type: string
 *               area:
 *                 type: string
 *               proposal:
 *                 type: string
 *               estimatedCost:
 *                 type: number
 *               fundingSource:
 *                 type: string
 *               responsibleTeam:
 *                 type: string
 *               committeeId:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               targetDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       201:
 *         description: Created
 *       403:
 *         description: Role not allowed
 */
export const createProject = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = tenantScope(req) || req.body.tenantId;
    if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    const project = await DevelopmentProject.create({ ...req.body, tenantId });
    res.status(201).json({ success: true, data: project });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @swagger
 * /development-projects/{id}:
 *   put:
 *     summary: Update a development project
 *     tags: [Development]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               area:
 *                 type: string
 *               estimatedCost:
 *                 type: number
 *               progressPercent:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [proposed, approved, in_progress, completed, dropped]
 *               completionReport:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated project
 *       404:
 *         description: Project not found
 */
export const updateProject = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await DevelopmentProject.findById(req.params.id);
    if (!existing || (req.tenantId && existing.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    const project = await DevelopmentProject.findByIdAndUpdate(req.params.id, stripImmutable(req.body), {
      new: true,
      runValidators: true,
    }).populate('committeeId', 'name');
    res.json({ success: true, data: project });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @swagger
 * /development-projects/{id}:
 *   delete:
 *     summary: Delete a development project
 *     tags: [Development]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted
 *       404:
 *         description: Project not found
 */
export const deleteProject = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await DevelopmentProject.findById(req.params.id);
    if (!existing || (req.tenantId && existing.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    await existing.deleteOne();
    res.json({ success: true, message: 'Project deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @swagger
 * /development-projects/{id}/expenditure:
 *   get:
 *     summary: Get project expenditure from linked ledger items
 *     tags: [Development]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Expenditure data with paginated ledger items
 */
export const getProjectExpenditure = async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id;
    const { page, limit, skip } = getPaginationParams(req);

    // Verify project exists and belongs to tenant
    const project = await DevelopmentProject.findById(projectId);
    if (!project || (req.tenantId && project.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const query = { projectId: new mongoose.Types.ObjectId(projectId), type: 'expense' };
    const [items, total] = await Promise.all([
      LedgerItem.find(query)
        .populate('ledgerId', 'name')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit),
      LedgerItem.countDocuments(query),
    ]);

    const totalAmount = await LedgerItem.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const total_spent = totalAmount.length > 0 ? totalAmount[0].total : 0;

    res.json({
      success: true,
      data: {
        total: total_spent,
        items,
        pagination: { page, limit, skip, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
