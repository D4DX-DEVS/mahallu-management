import { Request, Response } from 'express';
import { NikahRegistration, DeathRegistration, NOC } from '../models/Registration';
import Member from '../models/Member';
import { AuthRequest } from '../middleware/authMiddleware';
import { tenantScope } from '../utils/tenantScope';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { reconcileRegistration, deleteRegistrationWithRollback, previewDeath, previewNikah } from '../services/lifecycleService';
import { sendError } from '../utils/transaction';
import { refBelongsToTenant } from '../utils/sanitizeUpdate';
import Family from '../models/Family';

// Fields only the server may write (side-effect bookkeeping)
const SERVER_ONLY = ['effectsApplied', 'effects', 'previousStatus', 'approvedBy', 'approvedAt', 'certificateIssuedAt', 'tenantId', '_id'];
const stripServerOnly = (body: any) => {
  const clean = { ...body };
  SERVER_ONLY.forEach((k) => delete clean[k]);
  return clean;
};
const actorOf = (req: AuthRequest) => ({ tenantId: req.tenantId, userId: req.user?._id ? String(req.user._id) : undefined, userName: req.user?.name, isSuperAdmin: req.isSuperAdmin });
const canDecide = (req: AuthRequest) => !!req.isSuperAdmin || req.user?.role === 'mahall';

/** Verify member/family refs on a registration body belong to the tenant (cross-tenant ids are rejected). */
async function refsOk(req: AuthRequest, tenantId: any, body: any): Promise<string | null> {
  for (const [field, model] of [['groomId', Member], ['brideId', Member], ['deceasedId', Member], ['spouseMemberId', Member], ['familyId', Family]] as const) {
    if (body[field] && !(await refBelongsToTenant(model as any, body[field], tenantId))) return `${field} does not belong to this mahallu`;
  }
  return null;
}

// Nikah Registration
export const getAllNikahRegistrations = async (req: AuthRequest, res: Response) => {
  try {
    const { status, search, tenantId } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = {};

    // Apply tenant filter - req.tenantId includes x-tenant-id header for super admin viewing as tenant
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (tenantId && req.isSuperAdmin) {
      query.tenantId = tenantId;
    }

    if (status) query.status = status;
    if (search) {
      query.$or = [
        { groomName: { $regex: search, $options: 'i' } },
        { brideName: { $regex: search, $options: 'i' } },
      ];
    }

    const [registrations, total] = await Promise.all([
      NikahRegistration.find(query)
        .populate('groomId', 'name')
        .populate('brideId', 'name')
        .sort({ nikahDate: -1 })
        .skip(skip)
        .limit(limit),
      NikahRegistration.countDocuments(query),
    ]);

    res.json(createPaginationResponse(registrations, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getNikahRegistrationById = async (req: AuthRequest, res: Response) => {
  try {
    const registration = await NikahRegistration.findById(req.params.id)
      .populate('groomId', 'name')
      .populate('brideId', 'name');
    
    if (!registration) {
      return res.status(404).json({ success: false, message: 'Nikah registration not found' });
    }

    // Check tenant access
    if (!req.isSuperAdmin && registration.tenantId.toString() !== req.tenantId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, data: registration });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createNikahRegistration = async (req: AuthRequest, res: Response) => {
  try {
    const registrationData = {
      ...stripServerOnly(req.body),
      tenantId: req.tenantId || req.body.tenantId,
    };

    if (!registrationData.tenantId && !req.isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required',
      });
    }

    if (registrationData.status && registrationData.status !== 'pending' && !canDecide(req)) {
      return res.status(403).json({ success: false, message: 'Only the mahallu admin can approve or reject a registration.' });
    }
    const refErr = registrationData.tenantId ? await refsOk(req, registrationData.tenantId, registrationData) : null;
    if (refErr) return res.status(400).json({ success: false, message: refErr });

    const registration = new NikahRegistration(registrationData);
    await registration.save();
    const sideEffects = await reconcileRegistration('nikah', registration._id, actorOf(req));
    res.status(201).json({ success: true, data: await NikahRegistration.findById(registration._id), sideEffects });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateNikahRegistration = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const b = req.body;
    const fields = [
      'groomName', 'groomAge', 'groomId', 'brideName', 'brideAge', 'brideId',
      'mahallMemberType', 'nikahDate', 'mahallId', 'waliName', 'witness1', 'witness2',
      'mahrAmount', 'mahrDescription', 'status', 'remarks', 'venue',
      'groomFatherName', 'brideFatherName', 'groomAddress', 'brideAddress', 'officiantName',
      'brideFamilyAction', 'newFamilyHouseName',
    ];
    const update: Record<string, any> = {};
    fields.forEach((f) => { if (b[f] !== undefined) update[f] = b[f]; });

    const registration = await NikahRegistration.findById(id);
    if (!registration) {
      return res.status(404).json({ success: false, message: 'Nikah registration not found' });
    }

    // Check tenant access
    if (!req.isSuperAdmin && registration.tenantId.toString() !== req.tenantId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (update.status !== undefined && update.status !== registration.status && !canDecide(req)) {
      return res.status(403).json({ success: false, message: 'Only the mahallu admin can approve or reject a registration.' });
    }
    const refErr = await refsOk(req, registration.tenantId, update);
    if (refErr) return res.status(400).json({ success: false, message: refErr });

    await NikahRegistration.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    const sideEffects = await reconcileRegistration('nikah', id, actorOf(req));
    const updated = await NikahRegistration.findById(id)
      .populate('groomId', 'name')
      .populate('brideId', 'name');

    res.json({ success: true, data: updated, sideEffects });
  } catch (error: any) {
    sendError(res, error);
  }
};

export const deleteNikahRegistration = async (req: AuthRequest, res: Response) => {
  try {
    const reg = await NikahRegistration.findById(req.params.id);
    if (!reg) return res.status(404).json({ success: false, message: 'Nikah registration not found' });
    if (!req.isSuperAdmin && reg.tenantId.toString() !== req.tenantId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const r = await deleteRegistrationWithRollback('nikah', reg._id, actorOf(req));
    res.json({ success: true, message: 'Nikah registration deleted. Anything it changed has been undone.', notes: r?.notes || [] });
  } catch (error: any) {
    sendError(res, error);
  }
};

export const previewNikahEffects = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId || req.body.tenantId;
    if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    const refErr = await refsOk(req, tenantId, req.body);
    if (refErr) return res.status(400).json({ success: false, message: refErr });
    res.json({ success: true, data: await previewNikah(tenantId, req.body) });
  } catch (error: any) {
    sendError(res, error);
  }
};

// Death Registration
export const getAllDeathRegistrations = async (req: AuthRequest, res: Response) => {
  try {
    const { status, search, tenantId } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = {};

    // Apply tenant filter - req.tenantId includes x-tenant-id header for super admin viewing as tenant
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (tenantId && req.isSuperAdmin) {
      query.tenantId = tenantId;
    }

    if (status) query.status = status;
    if (search) {
      query.deceasedName = { $regex: search, $options: 'i' };
    }

    const [registrations, total] = await Promise.all([
      DeathRegistration.find(query)
        .populate('deceasedId', 'name')
        .populate('familyId', 'houseName')
        .sort({ deathDate: -1 })
        .skip(skip)
        .limit(limit),
      DeathRegistration.countDocuments(query),
    ]);

    res.json(createPaginationResponse(registrations, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDeathRegistrationById = async (req: AuthRequest, res: Response) => {
  try {
    const registration = await DeathRegistration.findById(req.params.id)
      .populate('deceasedId', 'name')
      .populate('familyId', 'houseName');
    
    if (!registration) {
      return res.status(404).json({ success: false, message: 'Death registration not found' });
    }

    // Check tenant access
    if (!req.isSuperAdmin && registration.tenantId.toString() !== req.tenantId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, data: registration });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createDeathRegistration = async (req: AuthRequest, res: Response) => {
  try {
    const registrationData = {
      ...stripServerOnly(req.body),
      tenantId: req.tenantId || req.body.tenantId,
      // Recorded by an admin => approved straight away (this is how it always behaved: the member was marked
      // deceased on create). Member-portal requests are created elsewhere as 'pending'.
      status: req.body.status || 'approved',
    };

    if (!registrationData.tenantId && !req.isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required',
      });
    }
    if (registrationData.status !== 'pending' && !canDecide(req)) {
      return res.status(403).json({ success: false, message: 'Only the mahallu admin can approve or reject a registration.' });
    }
    const refErr = registrationData.tenantId ? await refsOk(req, registrationData.tenantId, registrationData) : null;
    if (refErr) return res.status(400).json({ success: false, message: refErr });
    if (registrationData.graveId && !registrationData.graveRecordId) registrationData.graveRecordId = registrationData.graveId;
    if (registrationData.graveRecordId && !registrationData.graveId) registrationData.graveId = registrationData.graveRecordId;

    const registration = new DeathRegistration(registrationData);
    await registration.save();
    const sideEffects = await reconcileRegistration('death', registration._id, actorOf(req));
    res.status(201).json({ success: true, data: await DeathRegistration.findById(registration._id), sideEffects });
  } catch (error: any) {
    sendError(res, error);
  }
};

export const updateDeathRegistration = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const b = req.body;
    const fields = [
      'deceasedName', 'deceasedId', 'deathDate', 'placeOfDeath', 'causeOfDeath',
      'mahallId', 'familyId', 'informantName', 'informantRelation', 'informantPhone',
      'status', 'remarks', 'graveId', 'graveRecordId', 'spouseMemberId',
    ];
    const update: Record<string, any> = {};
    fields.forEach((f) => { if (b[f] !== undefined) update[f] = b[f]; });
    if (update.graveId && update.graveRecordId === undefined) update.graveRecordId = update.graveId;
    if (update.graveRecordId && update.graveId === undefined) update.graveId = update.graveRecordId;

    const registration = await DeathRegistration.findById(id);
    if (!registration) {
      return res.status(404).json({ success: false, message: 'Death registration not found' });
    }

    // Check tenant access
    if (!req.isSuperAdmin && registration.tenantId.toString() !== req.tenantId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (update.status !== undefined && update.status !== registration.status && !canDecide(req)) {
      return res.status(403).json({ success: false, message: 'Only the mahallu admin can approve or reject a registration.' });
    }
    const refErr = await refsOk(req, registration.tenantId, update);
    if (refErr) return res.status(400).json({ success: false, message: refErr });

    await DeathRegistration.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    const sideEffects = await reconcileRegistration('death', id, actorOf(req));
    const updated = await DeathRegistration.findById(id)
      .populate('deceasedId', 'name')
      .populate('familyId', 'houseName');

    res.json({ success: true, data: updated, sideEffects });
  } catch (error: any) {
    sendError(res, error);
  }
};

export const deleteDeathRegistration = async (req: AuthRequest, res: Response) => {
  try {
    const reg = await DeathRegistration.findById(req.params.id);
    if (!reg) return res.status(404).json({ success: false, message: 'Death registration not found' });
    if (!req.isSuperAdmin && reg.tenantId.toString() !== req.tenantId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const r = await deleteRegistrationWithRollback('death', reg._id, actorOf(req));
    res.json({ success: true, message: 'Death registration deleted. Anything it changed has been undone.', notes: r?.notes || [] });
  } catch (error: any) {
    sendError(res, error);
  }
};

export const previewDeathEffects = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId || req.body.tenantId;
    if (!tenantId) return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    const refErr = await refsOk(req, tenantId, req.body);
    if (refErr) return res.status(400).json({ success: false, message: refErr });
    res.json({ success: true, data: await previewDeath(tenantId, req.body) });
  } catch (error: any) {
    sendError(res, error);
  }
};

// NOC
export const getAllNOCs = async (req: AuthRequest, res: Response) => {
  try {
    const { type, status, search, tenantId } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = {};

    // Apply tenant filter - req.tenantId includes x-tenant-id header for super admin viewing as tenant
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (tenantId && req.isSuperAdmin) {
      query.tenantId = tenantId;
    }

    if (type) query.type = type;
    if (status) query.status = status;
    if (search) {
      query.applicantName = { $regex: search, $options: 'i' };
    }

    const [nocs, total] = await Promise.all([
      NOC.find(query)
        .populate('applicantId', 'name')
        .populate('nikahRegistrationId')
        .populate('tenantId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      NOC.countDocuments(query),
    ]);

    res.json(createPaginationResponse(nocs, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getNOCById = async (req: AuthRequest, res: Response) => {
  try {
    const noc = await NOC.findById(req.params.id)
      .populate('applicantId', 'name')
      .populate('nikahRegistrationId');
    
    if (!noc) {
      return res.status(404).json({ success: false, message: 'NOC not found' });
    }

    // Check tenant access
    if (!req.isSuperAdmin && noc.tenantId.toString() !== req.tenantId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.json({ success: true, data: noc });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createNOC = async (req: AuthRequest, res: Response) => {
  try {
    const { purposeTitle, purposeDescription, purpose } = req.body;
    if (!purposeTitle && !purpose) {
      return res.status(400).json({ success: false, message: 'Purpose title is required' });
    }
    if (!purposeDescription && !purpose) {
      return res.status(400).json({ success: false, message: 'Purpose description is required' });
    }
    const nocData = {
      ...req.body,
      tenantId: req.tenantId || req.body.tenantId,
      purposeTitle: purposeTitle || purpose,
      purposeDescription: purposeDescription || purpose,
      purpose: purpose || purposeTitle || purposeDescription,
      // Set status to approved for Mahallu admin created NOCs
      status: req.body.status || 'approved',
      // Set issued date to current date if not provided
      issuedDate: req.body.issuedDate || new Date(),
      // Record who approved it
      approvedBy: req.user?.name || undefined,
    };

    if (!nocData.tenantId && !req.isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required',
      });
    }

    const noc = new NOC(nocData);
    await noc.save();
    res.status(201).json({ success: true, data: noc });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateNOC = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, issuedDate, expiryDate, remarks, purposeTitle, purposeDescription, purpose } = req.body;

    const updateData: Record<string, any> = { status, issuedDate, expiryDate, remarks, purposeTitle, purposeDescription, purpose };
    if (status === 'approved') {
      updateData.approvedBy = req.user?.name || undefined;
      if (!issuedDate) updateData.issuedDate = new Date();
    }

    const noc = await NOC.findOneAndUpdate(
      { _id: id, ...tenantScope(req) },
      updateData,
      { new: true, runValidators: true }
    )
      .populate('applicantId', 'name')
      .populate('nikahRegistrationId');

    if (!noc) {
      return res.status(404).json({ success: false, message: 'NOC not found' });
    }

    res.json({ success: true, data: noc });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

