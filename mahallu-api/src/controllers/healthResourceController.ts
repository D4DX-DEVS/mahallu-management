import { Response } from 'express';
import HealthResource from '../models/HealthResource';
import Member from '../models/Member';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { stripImmutable, refBelongsToTenant } from '../utils/sanitizeUpdate';

const tenantScope = (req: AuthRequest): Record<string, any> =>
  req.tenantId ? { tenantId: req.tenantId } : {};

/**
 * Check that referenced member belongs to tenant.
 */
const validateHealthResourceRefs = async (req: AuthRequest): Promise<string | null> => {
  const { memberId } = req.body;
  if (memberId && !(await refBelongsToTenant(Member, memberId, req.tenantId))) {
    return 'Member does not belong to this Mahallu';
  }
  return null;
};

/**
 * GET /api/health-resources
 * List health resources. Non-sensitive types (doctor, blood_donor, elderly_care) accessible to mahall role.
 * Sensitive types (palliative_case, patient_support) require sensitiveAccess('health') middleware
 * (routed separately or checked per-request).
 */
export const getAllHealthResources = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { ...tenantScope(req) };

    // Filter by type (doctors, blood_donors, elderly_care only - sensitive types blocked)
    if (req.query.type) {
      const type = String(req.query.type);
      if (['palliative_case', 'patient_support'].includes(type)) {
        return res.status(403).json({
          success: false,
          message: 'Access to this resource type is restricted. Use the sensitive endpoint.',
        });
      }
      query.type = type;
    }

    // Apply implicit filter: exclude sensitive types from regular list endpoint
    query.type = { $nin: ['palliative_case', 'patient_support'] };

    if (req.query.status) query.status = req.query.status;
    if (req.query.bloodGroup) query.bloodGroup = req.query.bloodGroup;
    if (req.query.search) query.name = { $regex: String(req.query.search), $options: 'i' };

    const [resources, total] = await Promise.all([
      HealthResource.find(query)
        .populate('memberId', 'name phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      HealthResource.countDocuments(query),
    ]);

    res.json(createPaginationResponse(resources, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/health-resources/sensitive
 * List sensitive health resources (palliative_case, patient_support).
 * Requires sensitiveAccess('health') middleware on the route.
 */
export const getAllSensitiveHealthResources = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { ...tenantScope(req), type: { $in: ['palliative_case', 'patient_support'] } };

    if (req.query.type) query.type = String(req.query.type);
    if (req.query.status) query.status = req.query.status;
    if (req.query.search) query.name = { $regex: String(req.query.search), $options: 'i' };

    const [resources, total] = await Promise.all([
      HealthResource.find(query)
        .populate('memberId', 'name phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      HealthResource.countDocuments(query),
    ]);

    res.json(createPaginationResponse(resources, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/health-resources/:id
 */
export const getHealthResourceById = async (req: AuthRequest, res: Response) => {
  try {
    const resource = await HealthResource.findOne({ _id: req.params.id, ...tenantScope(req) }).populate(
      'memberId',
      'name phone'
    );

    if (!resource) {
      return res.status(404).json({ success: false, message: 'Health resource not found' });
    }

    res.json({ success: true, data: resource });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/health-resources
 * Create a health resource (non-sensitive types only).
 */
export const createHealthResource = async (req: AuthRequest, res: Response) => {
  try {
    // Validate sensitive type not being created via regular endpoint
    if (['palliative_case', 'patient_support'].includes(req.body.type)) {
      return res.status(403).json({
        success: false,
        message: 'Use the /health-resources/sensitive endpoint for restricted resource types.',
      });
    }

    const refError = await validateHealthResourceRefs(req);
    if (refError) {
      return res.status(400).json({ success: false, message: refError });
    }

    const resource = await HealthResource.create({
      tenantId: req.tenantId,
      ...req.body,
    });

    res.status(201).json({ success: true, data: resource });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/health-resources/sensitive
 * Create a sensitive health resource (palliative_case, patient_support).
 * Requires sensitiveAccess('health') middleware on the route.
 */
export const createSensitiveHealthResource = async (req: AuthRequest, res: Response) => {
  try {
    // Validate type is sensitive
    if (!['palliative_case', 'patient_support'].includes(req.body.type)) {
      return res.status(400).json({
        success: false,
        message: 'Use the regular /health-resources endpoint for non-sensitive types.',
      });
    }

    const refError = await validateHealthResourceRefs(req);
    if (refError) {
      return res.status(400).json({ success: false, message: refError });
    }

    const resource = await HealthResource.create({
      tenantId: req.tenantId,
      ...req.body,
    });

    res.status(201).json({ success: true, data: resource });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/health-resources/:id
 * Update a health resource.
 */
export const updateHealthResource = async (req: AuthRequest, res: Response) => {
  try {
    const resource = await HealthResource.findOne({ _id: req.params.id, ...tenantScope(req) });

    if (!resource) {
      return res.status(404).json({ success: false, message: 'Health resource not found' });
    }

    // If type is being changed to sensitive, or resource is sensitive, require sensitiveAccess
    // For simplicity: check if current or new type is sensitive, deny update if no sensitiveAccess
    const isSensitive =
      ['palliative_case', 'patient_support'].includes(resource.type) ||
      ['palliative_case', 'patient_support'].includes(req.body.type);

    if (isSensitive && !req.isSuperAdmin) {
      const sensitiveModules = req.user?.permissions?.sensitiveModules;
      if (!sensitiveModules || !sensitiveModules.includes('health')) {
        return res.status(403).json({
          success: false,
          message: 'Access to this resource is restricted',
        });
      }
    }

    const refError = await validateHealthResourceRefs(req);
    if (refError) {
      return res.status(400).json({ success: false, message: refError });
    }

    const updated = await HealthResource.findByIdAndUpdate(req.params.id, stripImmutable(req.body), {
      new: true,
      runValidators: true,
    }).populate('memberId', 'name phone');

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/health-resources/:id
 * Hard delete a health resource.
 */
export const deleteHealthResource = async (req: AuthRequest, res: Response) => {
  try {
    const resource = await HealthResource.findOne({ _id: req.params.id, ...tenantScope(req) });

    if (!resource) {
      return res.status(404).json({ success: false, message: 'Health resource not found' });
    }

    // Check sensitive access if needed
    if (
      ['palliative_case', 'patient_support'].includes(resource.type) &&
      !req.isSuperAdmin
    ) {
      const sensitiveModules = req.user?.permissions?.sensitiveModules;
      if (!sensitiveModules || !sensitiveModules.includes('health')) {
        return res.status(403).json({
          success: false,
          message: 'Access to this resource is restricted',
        });
      }
    }

    await HealthResource.deleteOne({ _id: req.params.id });
    res.json({ success: true, message: 'Health resource deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/health/summary
 * Summary stats: doctors count, blood donors by group, camps count, elderly care count.
 * No sensitive counts unless user has sensitiveAccess('health').
 */
export const getHealthSummary = async (req: AuthRequest, res: Response) => {
  try {
    const baseQuery = { ...tenantScope(req), status: 'active' };

    // Non-sensitive queries
    const doctorsCount = await HealthResource.countDocuments({ ...baseQuery, type: 'doctor' });
    const elderlyCareCount = await HealthResource.countDocuments({
      ...baseQuery,
      type: 'elderly_care',
    });
    const bloodDonorsCount = await HealthResource.countDocuments({
      ...baseQuery,
      type: 'blood_donor',
    });

    // Blood group distribution
    const bloodGroupDist = await HealthResource.aggregate([
      { $match: { ...baseQuery, type: 'blood_donor', bloodGroup: { $ne: null } } },
      { $group: { _id: '$bloodGroup', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    // Determine if user can see sensitive counts
    const canSeeSensitive = req.isSuperAdmin || req.user?.permissions?.sensitiveModules?.includes('health');

    let palliativeCaseCount = 0;
    let patientSupportCount = 0;

    if (canSeeSensitive) {
      palliativeCaseCount = await HealthResource.countDocuments({
        ...baseQuery,
        type: 'palliative_case',
      });
      patientSupportCount = await HealthResource.countDocuments({
        ...baseQuery,
        type: 'patient_support',
      });
    }

    res.json({
      success: true,
      data: {
        doctorsCount,
        elderlyCareCount,
        bloodDonorsCount,
        bloodGroupDistribution: bloodGroupDist,
        palliativeCaseCount: canSeeSensitive ? palliativeCaseCount : undefined,
        patientSupportCount: canSeeSensitive ? patientSupportCount : undefined,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
