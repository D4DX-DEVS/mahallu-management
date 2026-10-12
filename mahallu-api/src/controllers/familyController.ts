import { Request, Response } from 'express';
import Family from '../models/Family';
import Member from '../models/Member';
import { AuthRequest } from '../middleware/authMiddleware';
import { tenantScope } from '../utils/tenantScope';
import { stripImmutable } from '../utils/sanitizeUpdate';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import mongoose from 'mongoose';
import { ACTIVE_FAMILY_FILTER, ACTIVE_MEMBER_FILTER } from '../utils/archiveFilters';
import { nextFamilyMahallId } from '../services/idService';
import { findFamilyDuplicates, findFamilyDuplicatesForRows, buildFamilyDuplicateReport } from '../services/duplicateService';
import {
  archiveFamily, archiveInfo, restoreFamily, hardDeleteFamily, mergeFamilies, mergePreview, splitFamily,
  appointFamilyHead, familiesNeedingAttention,
} from '../services/familyLifecycleService';
import { sendError } from '../utils/transaction';

const actorOf = (req: AuthRequest) => ({
  tenantId: req.tenantId,
  userId: req.user?._id ? String(req.user._id) : undefined,
  userName: req.user?.name,
  isSuperAdmin: req.isSuperAdmin,
});
const flag = (v: unknown) => v === true || v === 'true' || v === '1';
// Lifecycle fields are server-managed: never accept them from a generic create/update body
const LIFECYCLE_FIELDS = ['isArchived', 'archivedAt', 'archivedBy', 'archivedReason', 'needsHeadReassignment', 'needsHeadReason', 'needsHeadSince', 'mergedIntoFamilyId', 'lifecycleLog', 'confirmDuplicate'];
const stripLifecycle = (body: Record<string, any>) => {
  const clean = { ...body };
  LIFECYCLE_FIELDS.forEach((f) => delete clean[f]);
  return clean;
};

export const getAllFamilies = async (req: AuthRequest, res: Response) => {
  try {
    const { status, search, area, sortBy, tenantId } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = {};

    // Apply tenant filter
    // req.tenantId is set by authMiddleware and includes x-tenant-id header for super admin viewing as tenant
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (tenantId && req.isSuperAdmin) {
      query.tenantId = tenantId;
    }
    // If neither, super admin sees all families

    // Archived families are hidden unless asked for: ?archived=true (only archived) or ?includeArchived=true (both)
    if (req.query.archived === 'true') query.isArchived = true;
    else if (req.query.includeArchived !== 'true') Object.assign(query, ACTIVE_FAMILY_FILTER);
    if (req.query.needsHead === 'true') query.needsHeadReassignment = true;

    if (status) query.status = status;
    if (area) query.area = area;
    if (search) {
      query.$or = [
        { houseName: { $regex: search, $options: 'i' } },
        { mahallId: { $regex: search, $options: 'i' } },
        { contactNo: { $regex: search, $options: 'i' } },
      ];
    }

    const sort: any = {};
    if (sortBy === 'mahallId') sort.mahallId = 1;
    else sort.createdAt = -1;

    const [families, total] = await Promise.all([
      Family.find(query).sort(sort).skip(skip).limit(limit),
      Family.countDocuments(query),
    ]);

    // Live member count per family: one grouped query for this page (tenant scoped via the families' own ids)
    const counts = await Member.aggregate([
      { $match: { familyId: { $in: families.map((f) => f._id) }, ...ACTIVE_MEMBER_FILTER, ...(query.tenantId ? { tenantId: new mongoose.Types.ObjectId(String(query.tenantId)) } : {}) } },
      { $group: { _id: '$familyId', n: { $sum: 1 } } },
    ]);
    const countById = new Map(counts.map((c: any) => [String(c._id), c.n as number]));
    const data = families.map((f) => ({ ...f.toJSON(), memberCount: countById.get(String(f._id)) ?? 0 }));

    res.json(createPaginationResponse(data as any, total, page, limit));
  } catch (error: any) {
    console.error('Error fetching families:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getFamilyById = async (req: AuthRequest, res: Response) => {
  try {
    const family = await Family.findById(req.params.id);
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }

    if (!req.isSuperAdmin && req.tenantId && family.tenantId.toString() !== req.tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Family does not belong to your tenant',
      });
    }

    res.json({ success: true, data: family });
  } catch (error: any) {
    console.error('Error fetching family:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createFamily = async (req: AuthRequest, res: Response) => {
  try {
    // Ensure tenantId is set
    const familyData: Record<string, any> = {
      ...(stripLifecycle(stripImmutable(req.body) as Record<string, any>)),
      tenantId: req.tenantId || req.body.tenantId,
    };

    if (!familyData.tenantId && !req.isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required',
      });
    }

    // Possible duplicate? (same contact number, or same house + family head). Overridable.
    if (familyData.tenantId && !flag(req.query.confirmDuplicate) && !flag(req.body?.confirmDuplicate)) {
      const matches = await findFamilyDuplicates(familyData.tenantId, familyData);
      if (matches.length) {
        return res.status(409).json({
          success: false,
          code: 'POSSIBLE_DUPLICATE',
          message: 'This looks like a family that is already on the list. Check before adding it again.',
          matches: matches.map((m) => ({ id: m.id, houseName: m.houseName, familyHead: m.familyHead, mahallId: m.mahallId, reason: m.reasonText, reasonCode: m.reason })),
        });
      }
    }

    // Family ID (FID<n>) comes from an atomic per-tenant counter; retry if an id is somehow taken
    let family: any;
    for (let attempt = 0; attempt < 5; attempt++) {
      familyData.mahallId = await nextFamilyMahallId(familyData.tenantId);
      try {
        family = new Family(familyData);
        await family.save();
        break;
      } catch (err: any) {
        if (err?.code === 11000 && attempt < 4) continue;
        throw err;
      }
    }
    res.status(201).json({ success: true, data: family });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateFamily = async (req: AuthRequest, res: Response) => {
  try {
    const family = await Family.findOneAndUpdate(
      { _id: req.params.id, ...tenantScope(req) },
      stripLifecycle(stripImmutable(req.body) as Record<string, any>),
      { new: true, runValidators: true }
    );
    if (!family) {
      return res.status(404).json({ success: false, message: 'Family not found' });
    }
    res.json({ success: true, data: family });
  } catch (error: any) {
    console.error('Error updating family:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /families/:id  -> archives the family (soft delete).
 *   ?cascade=true  also archives its active members
 *   ?force=true    archive even though the family still owes dues
 *   ?reason=...    stored on the family
 *   ?hard=true     permanent delete, super_admin only and only for an already archived family
 */
export const deleteFamily = async (req: AuthRequest, res: Response) => {
  try {
    if (flag(req.query.hard)) {
      await hardDeleteFamily(req.params.id, actorOf(req));
      return res.json({ success: true, message: 'Family permanently deleted' });
    }
    const result = await archiveFamily(req.params.id, actorOf(req), {
      cascade: flag(req.query.cascade),
      force: flag(req.query.force),
      reason: typeof req.query.reason === 'string' ? req.query.reason : typeof req.body?.reason === 'string' ? req.body.reason : undefined,
    });
    res.json({
      success: true,
      message: 'Family archived. You can restore it any time.',
      data: { archivedMembers: result.archivedMembers, dueAmount: result.dueAmount, family: result.family },
    });
  } catch (error: any) {
    sendError(res, error);
  }
};

export const getFamilyLifecycleInfo = async (req: AuthRequest, res: Response) => {
  try {
    const info = await archiveInfo(req.params.id, actorOf(req));
    res.json({
      success: true,
      data: {
        isArchived: !!info.family.isArchived,
        activeMembers: info.activeMembers.length,
        members: info.activeMembers.map((m: any) => ({ id: String(m._id), name: m.name })),
        dueAmount: info.dueAmount,
        needsHeadReassignment: !!info.family.needsHeadReassignment,
        needsHeadReason: info.family.needsHeadReason,
        lifecycleLog: info.family.lifecycleLog || [],
      },
    });
  } catch (error: any) {
    sendError(res, error);
  }
};

export const restoreFamilyHandler = async (req: AuthRequest, res: Response) => {
  try {
    const r = await restoreFamily(req.params.id, actorOf(req));
    res.json({ success: true, message: 'Family restored', data: r });
  } catch (error: any) {
    sendError(res, error);
  }
};

export const mergePreviewHandler = async (req: AuthRequest, res: Response) => {
  try {
    const into = String(req.query.intoFamilyId || '');
    if (!into) return res.status(400).json({ success: false, message: 'Choose the family to merge into (intoFamilyId).' });
    res.json({ success: true, data: await mergePreview(req.params.id, into, actorOf(req)) });
  } catch (error: any) {
    sendError(res, error);
  }
};

export const mergeFamilyHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { intoFamilyId } = req.body || {};
    if (!intoFamilyId) return res.status(400).json({ success: false, message: 'Choose the family to merge into (intoFamilyId).' });
    const r = await mergeFamilies(req.params.id, String(intoFamilyId), actorOf(req));
    res.json({ success: true, message: `Merged. ${r.movedMembers} member${r.movedMembers === 1 ? '' : 's'} moved.`, data: r });
  } catch (error: any) {
    sendError(res, error);
  }
};

export const splitFamilyHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { memberIds, newHouseName, newFamilyHeadId, contactNo } = req.body || {};
    const r = await splitFamily(req.params.id, actorOf(req), { memberIds, newHouseName, newFamilyHeadId, contactNo });
    res.status(201).json({ success: true, message: 'New family created', data: r });
  } catch (error: any) {
    sendError(res, error);
  }
};

export const setFamilyHeadHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { memberId } = req.body || {};
    if (!memberId) return res.status(400).json({ success: false, message: 'Choose which member becomes the family head (memberId).' });
    const family = await appointFamilyHead(req.params.id, String(memberId), actorOf(req));
    res.json({ success: true, data: family });
  } catch (error: any) {
    sendError(res, error);
  }
};

export const getFamilyDuplicates = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId || (req.isSuperAdmin ? (req.query.tenantId as string) : undefined);
    if (!tenantId) return res.status(400).json({ success: false, message: 'Choose a mahallu first (tenantId).' });
    const pairs = await buildFamilyDuplicateReport(tenantId);
    res.json({ success: true, data: { pairs, count: pairs.length } });
  } catch (error: any) {
    sendError(res, error);
  }
};

export const getFamiliesNeedingAttention = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId || (req.isSuperAdmin ? (req.query.tenantId as string) : undefined);
    if (!tenantId) return res.status(400).json({ success: false, message: 'Choose a mahallu first (tenantId).' });
    res.json({ success: true, data: await familiesNeedingAttention(tenantId) });
  } catch (error: any) {
    sendError(res, error);
  }
};

export const getFamilyStats = async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId: queryTenantId } = req.query;
    const query: any = { status: { $ne: 'deleted' } };

    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (queryTenantId && req.isSuperAdmin) {
      query.tenantId = queryTenantId;
    }

    const [totalMembers, maleCount, femaleCount] = await Promise.all([
      Member.countDocuments(query),
      Member.countDocuments({ ...query, gender: 'male' }),
      Member.countDocuments({ ...query, gender: 'female' }),
    ]);

    res.json({ success: true, data: { totalMembers, maleCount, femaleCount } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Bulk import families (CSV parsed client-side into a JSON array). Max 500 rows. */
export const bulkImportFamilies = async (req: AuthRequest, res: Response) => {
  try {
    const { families } = req.body;
    if (!Array.isArray(families) || families.length === 0) {
      return res.status(400).json({ success: false, message: 'families array is required' });
    }
    if (families.length > 500) {
      return res.status(400).json({ success: false, message: 'Maximum 500 families per import' });
    }

    const errors: { row: number; message: string }[] = [];
    const docs: any[] = [];

    families.forEach((f: any, i: number) => {
      if (!f.houseName || typeof f.houseName !== 'string' || !f.houseName.trim()) {
        errors.push({ row: i + 1, message: 'houseName is required' });
        return;
      }

      docs.push({
        houseName: f.houseName.trim(),
        houseNameMl: f.houseNameMl || f.house_name_ml || undefined,
        familyHead: f.familyHead || f.family_head || undefined,
        familyHeadMl: f.familyHeadMl || f.family_head_ml || undefined,
        contactNo: f.contactNo || f.contact_no || undefined,
        area: f.area || undefined,
        areaMl: f.areaMl || f.area_ml || undefined,
        place: f.place || undefined,
        placeMl: f.placeMl || f.place_ml || undefined,
        varisangyaGrade: f.varisangyaGrade || f.varisangyaGrade_grade || undefined,
        tenantId: req.tenantId,
        status: 'approved',
      });
    });

    if (errors.length) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }

    // Possible duplicates (against existing families and earlier rows of the same file)
    if (!flag(req.query.confirmDuplicate) && !flag(req.body?.confirmDuplicate)) {
      const dupRows = await findFamilyDuplicatesForRows(req.tenantId, docs);
      if (dupRows.length) {
        return res.status(409).json({
          success: false,
          code: 'POSSIBLE_DUPLICATE',
          message: `${dupRows.length} row${dupRows.length === 1 ? '' : 's'} look like families that already exist. Review them, or import anyway.`,
          matches: dupRows.flatMap((r) =>
            r.matches.map((m) => ({ row: r.row, id: m.id, houseName: m.houseName, familyHead: m.familyHead, mahallId: m.mahallId, reason: m.reasonText, reasonCode: m.reason }))
          ),
        });
      }
    }
    for (const d of docs) d.mahallId = await nextFamilyMahallId(req.tenantId as string);

    const created = await Family.insertMany(docs);
    res.status(201).json({ success: true, data: { imported: created.length } });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

