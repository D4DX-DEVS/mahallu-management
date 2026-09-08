import { Response } from 'express';
import Khateeb from '../models/Khateeb';
import Khutbah from '../models/Khutbah';
import Institute from '../models/Institute';
import Member from '../models/Member';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { stripImmutable, refBelongsToTenant } from '../utils/sanitizeUpdate';

import { sendFailure } from '../utils/userMessages';
import { regexLiteral } from '../utils/queryGuard';

const tenantScope = (req: AuthRequest): Record<string, any> =>
  req.tenantId ? { tenantId: req.tenantId } : {};

/**
 * Confirm every tenant-scoped reference in the body belongs to this tenant.
 * Used by both khateeb and khutbah writes so no create/update path can attach a
 * foreign-tenant record.
 */
const validateKhutbahRefs = async (req: AuthRequest): Promise<string | null> => {
  const { khateebId, memberId } = req.body;
  if (khateebId && !(await refBelongsToTenant(Khateeb, khateebId, req.tenantId))) {
    return 'Khateeb does not belong to this Mahallu';
  }
  if (memberId && !(await refBelongsToTenant(Member, memberId, req.tenantId))) {
    return 'This member belongs to another Mahallu.';
  }
  return null;
};

/** Get or create the Mosque institute for this tenant. */
const getMosqueInstitute = async (tenantId: any) => {
  let mosque = await Institute.findOne({ tenantId, type: 'mosque' });
  if (!mosque) {
    mosque = new Institute({
      tenantId,
      name: 'Mosque',
      place: 'Main',
      type: 'mosque',
      status: 'active',
    });
    await mosque.save();
  }
  return mosque;
};

/**
 * @swagger
 * /khateebs:
 *   get:
 *     summary: Get all khateebs
 *     tags: [Religious]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *     responses:
 *       200:
 *         description: List of khateebs
 */
export const getAllKhateebs = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { ...tenantScope(req) };

    if (req.query.search) query.name = { $regex: regexLiteral(String(req.query.search)), $options: 'i' };
    if (req.query.status) query.status = req.query.status;

    const [khateebs, total] = await Promise.all([
      Khateeb.find(query)
        .populate('memberId', 'name nameMl contactNo')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit),
      Khateeb.countDocuments(query),
    ]);

    res.json(createPaginationResponse(khateebs, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the khateebs right now. Please try again.');
  }
};

export const getKhateebById = async (req: AuthRequest, res: Response) => {
  try {
    const khateeb = await Khateeb.findOne({ _id: req.params.id, ...tenantScope(req) }).populate(
      'memberId',
      'name nameMl contactNo'
    );

    if (!khateeb) {
      return res.status(404).json({ success: false, message: "We couldn't find that khateeb. It may have been removed." });
    }

    res.json({ success: true, data: khateeb });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the khateeb right now. Please try again.');
  }
};

export const createKhateeb = async (req: AuthRequest, res: Response) => {
  try {
    const refError = await validateKhutbahRefs(req);
    if (refError) return res.status(400).json({ success: false, message: refError });

    const khateeb = new Khateeb({
      ...req.body,
      tenantId: req.tenantId,
    });

    await khateeb.save();
    await khateeb.populate('memberId', 'name nameMl contactNo');

    res.status(201).json({ success: true, data: khateeb });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the khateeb. Please try again.');
  }
};

export const updateKhateeb = async (req: AuthRequest, res: Response) => {
  try {
    const refError = await validateKhutbahRefs(req);
    if (refError) return res.status(400).json({ success: false, message: refError });

    const updateData = stripImmutable(req.body);

    const khateeb = await Khateeb.findOneAndUpdate(
      { _id: req.params.id, ...tenantScope(req) },
      updateData,
      { new: true, runValidators: true }
    ).populate('memberId', 'name nameMl contactNo');

    if (!khateeb) {
      return res.status(404).json({ success: false, message: "We couldn't find that khateeb. It may have been removed." });
    }

    res.json({ success: true, data: khateeb });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the khateeb. Please try again.');
  }
};

export const deleteKhateeb = async (req: AuthRequest, res: Response) => {
  try {
    const khateeb = await Khateeb.findOneAndDelete({ _id: req.params.id, ...tenantScope(req) });

    if (!khateeb) {
      return res.status(404).json({ success: false, message: "We couldn't find that khateeb. It may have been removed." });
    }

    res.json({ success: true, message: 'Khateeb deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the khateeb. Please try again.');
  }
};

/**
 * @swagger
 * /khutbahs:
 *   get:
 *     summary: Get all khutbahs
 *     tags: [Religious]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *       - in: query
 *         name: khateebId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [scheduled, delivered, cancelled]
 *       - in: query
 *         name: month
 *         schema:
 *           type: string
 *           example: '2025-01'
 *       - in: query
 *         name: upcoming
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of khutbahs
 */
export const getAllKhutbahs = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { ...tenantScope(req) };

    if (req.query.khateebId) query.khateebId = req.query.khateebId;
    if (req.query.status) query.status = req.query.status;

    // Filter by month: YYYY-MM
    if (req.query.month) {
      const [year, month] = String(req.query.month).split('-');
      const startDate = new Date(`${year}-${month}-01`);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
      query.date = { $gte: startDate, $lt: endDate };
    }

    // Upcoming: date >= today
    if (req.query.upcoming === 'true' || req.query.upcoming === '1') {
      query.date = { $gte: new Date() };
    }

    const sortBy = req.query.upcoming === 'true' ? 'date' : '-date';

    const [khutbahs, total] = await Promise.all([
      Khutbah.find(query)
        .populate('khateebId', 'name nameMl contactNo')
        .sort(sortBy)
        .skip(skip)
        .limit(limit),
      Khutbah.countDocuments(query),
    ]);

    res.json(createPaginationResponse(khutbahs, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the khutbahs right now. Please try again.');
  }
};

export const getKhutbahById = async (req: AuthRequest, res: Response) => {
  try {
    const khutbah = await Khutbah.findOne({ _id: req.params.id, ...tenantScope(req) }).populate(
      'khateebId',
      'name nameMl contactNo qualifications'
    );

    if (!khutbah) {
      return res.status(404).json({ success: false, message: "We couldn't find that khutbah. It may have been removed." });
    }

    res.json({ success: true, data: khutbah });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the khutbah right now. Please try again.');
  }
};

export const createKhutbah = async (req: AuthRequest, res: Response) => {
  try {
    const refError = await validateKhutbahRefs(req);
    if (refError) return res.status(400).json({ success: false, message: refError });

    const khutbah = new Khutbah({
      ...req.body,
      tenantId: req.tenantId,
    });

    await khutbah.save();
    await khutbah.populate('khateebId', 'name nameMl contactNo qualifications');

    res.status(201).json({ success: true, data: khutbah });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the khutbah. Please try again.');
  }
};

export const updateKhutbah = async (req: AuthRequest, res: Response) => {
  try {
    const refError = await validateKhutbahRefs(req);
    if (refError) return res.status(400).json({ success: false, message: refError });

    const updateData = stripImmutable(req.body);

    const khutbah = await Khutbah.findOneAndUpdate(
      { _id: req.params.id, ...tenantScope(req) },
      updateData,
      { new: true, runValidators: true }
    ).populate('khateebId', 'name nameMl contactNo qualifications');

    if (!khutbah) {
      return res.status(404).json({ success: false, message: "We couldn't find that khutbah. It may have been removed." });
    }

    res.json({ success: true, data: khutbah });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the khutbah. Please try again.');
  }
};

export const deleteKhutbah = async (req: AuthRequest, res: Response) => {
  try {
    const khutbah = await Khutbah.findOneAndDelete({ _id: req.params.id, ...tenantScope(req) });

    if (!khutbah) {
      return res.status(404).json({ success: false, message: "We couldn't find that khutbah. It may have been removed." });
    }

    res.json({ success: true, message: 'Khutbah deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the khutbah. Please try again.');
  }
};

/**
 * Get or create the Mosque institute (auto-creation for staff recording).
 * @swagger
 * /religious/mosque-institute:
 *   get:
 *     summary: Get or create mosque institute
 *     tags: [Religious]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Mosque institute
 */
export const getMosqueInstituteHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.tenantId) return res.status(400).json({ success: false, message: 'Please select a Mahallu before continuing.' });

    const mosque = await getMosqueInstitute(req.tenantId);
    res.json({ success: true, data: mosque });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the mosque institute right now. Please try again.');
  }
};
