import { Response } from 'express';
import Cluster from '../models/Cluster';
import ClusterVisit from '../models/ClusterVisit';
import Family from '../models/Family';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { stripImmutable } from '../utils/sanitizeUpdate';

import { sendFailure } from '../utils/userMessages';
import { regexLiteral } from '../utils/queryGuard';

const tenantScope = (req: AuthRequest) => {
  if (req.tenantId) return req.tenantId;
  if (req.isSuperAdmin && req.query.tenantId) return req.query.tenantId as string;
  return undefined;
};

const scopedQuery = (req: AuthRequest): Record<string, any> => {
  const tenantId = tenantScope(req);
  return tenantId ? { tenantId } : {};
};

export const getAllClusters = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const { status, search } = req.query;
    const query: any = scopedQuery(req);
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: regexLiteral(search), $options: 'i' } },
        { code: { $regex: regexLiteral(search), $options: 'i' } },
      ];
    }

    const [clusters, total] = await Promise.all([
      Cluster.find(query)
        .populate('coordinatorMemberId', 'name phone')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit),
      Cluster.countDocuments(query),
    ]);

    // Family count per cluster for the card grid
    const counts = await Family.aggregate([
      { $match: { clusterId: { $in: clusters.map((c) => c._id) } } },
      { $group: { _id: '$clusterId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c: any) => [c._id.toString(), c.count]));

    const data = clusters.map((c) => ({
      ...c.toObject(),
      familyCount: countMap.get((c._id as any).toString()) || 0,
    }));

    res.json(createPaginationResponse(data, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the clusters right now. Please try again.');
  }
};

export const getClusterById = async (req: AuthRequest, res: Response) => {
  try {
    const cluster = await Cluster.findById(req.params.id)
      .populate('coordinatorMemberId', 'name phone')
      .populate('teamMemberIds', 'name phone');
    if (!cluster || (req.tenantId && cluster.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: "We couldn't find that cluster. It may have been removed." });
    }
    const familyCount = await Family.countDocuments({ clusterId: cluster._id });
    res.json({ success: true, data: { ...cluster.toObject(), familyCount } });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the cluster right now. Please try again.');
  }
};

export const createCluster = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = tenantScope(req) || req.body.tenantId;
    if (!tenantId) return res.status(400).json({ success: false, message: 'Please select a Mahallu before continuing.' });
    const cluster = await Cluster.create({ ...req.body, tenantId });
    res.status(201).json({ success: true, data: cluster });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the cluster. Please try again.');
  }
};

export const updateCluster = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await Cluster.findById(req.params.id);
    if (!existing || (req.tenantId && existing.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: "We couldn't find that cluster. It may have been removed." });
    }
    const cluster = await Cluster.findByIdAndUpdate(req.params.id, stripImmutable(req.body), {
      new: true,
      runValidators: true,
    });
    res.json({ success: true, data: cluster });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the cluster. Please try again.');
  }
};

export const deleteCluster = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await Cluster.findById(req.params.id);
    if (!existing || (req.tenantId && existing.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: "We couldn't find that cluster. It may have been removed." });
    }
    // Families outlive their cluster: detach rather than block or cascade
    await Family.updateMany({ clusterId: existing._id }, { $unset: { clusterId: '' } });
    await ClusterVisit.deleteMany({ clusterId: existing._id });
    await existing.deleteOne();
    res.json({ success: true, message: 'Cluster deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the cluster. Please try again.');
  }
};

/** Families belonging to a cluster (paginated, spec 27). */
export const getClusterFamilies = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const { search } = req.query;
    const query: any = { ...scopedQuery(req), clusterId: req.params.id };
    if (search) {
      query.$or = [
        { houseName: { $regex: regexLiteral(search), $options: 'i' } },
        { familyHead: { $regex: regexLiteral(search), $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      Family.find(query).sort({ houseName: 1 }).skip(skip).limit(limit),
      Family.countDocuments(query),
    ]);
    res.json(createPaginationResponse(data, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the cluster families right now. Please try again.');
  }
};

export const assignFamilies = async (req: AuthRequest, res: Response) => {
  try {
    const cluster = await Cluster.findById(req.params.id);
    if (!cluster || (req.tenantId && cluster.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: "We couldn't find that cluster. It may have been removed." });
    }

    const familyIds: string[] = req.body.familyIds || [];
    if (!Array.isArray(familyIds) || familyIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Please select at least one family.' });
    }

    // Tenant filter in the update keeps a stray id from another Mahallu out
    const result = await Family.updateMany(
      { _id: { $in: familyIds }, ...scopedQuery(req) },
      { clusterId: cluster._id }
    );

    res.json({ success: true, data: { assigned: result.modifiedCount } });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the families. Please try again.');
  }
};

export const unassignFamily = async (req: AuthRequest, res: Response) => {
  try {
    const family = await Family.findOne({ _id: req.params.familyId, ...scopedQuery(req) });
    if (!family) {
      return res.status(404).json({ success: false, message: "We couldn't find that family. It may have been removed." });
    }
    family.clusterId = undefined;
    await family.save();
    res.json({ success: true, message: 'Family removed from cluster' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the family. Please try again.');
  }
};

// ---------------------------------------------------------------------------
// Cluster visits
// ---------------------------------------------------------------------------

export const getAllVisits = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const { clusterId, followUpNeeded } = req.query;
    const query: any = scopedQuery(req);
    if (clusterId) query.clusterId = clusterId;
    if (followUpNeeded === 'true') query.followUpNeeded = true;

    const [data, total] = await Promise.all([
      ClusterVisit.find(query)
        .populate('clusterId', 'name')
        .populate('familyId', 'houseName familyHead')
        .sort({ visitDate: -1 })
        .skip(skip)
        .limit(limit),
      ClusterVisit.countDocuments(query),
    ]);
    res.json(createPaginationResponse(data, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the visits right now. Please try again.');
  }
};

export const createVisit = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = tenantScope(req) || req.body.tenantId;
    if (!tenantId) return res.status(400).json({ success: false, message: 'Please select a Mahallu before continuing.' });

    const cluster = await Cluster.findById(req.body.clusterId);
    if (!cluster || cluster.tenantId.toString() !== tenantId.toString()) {
      return res.status(400).json({ success: false, message: 'Please select a valid cluster.' });
    }

    const visit = await ClusterVisit.create({ ...req.body, tenantId });
    res.status(201).json({ success: true, data: visit });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the visit. Please try again.');
  }
};

export const updateVisit = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await ClusterVisit.findById(req.params.id);
    if (!existing || (req.tenantId && existing.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: "We couldn't find that visit. It may have been removed." });
    }
    const visit = await ClusterVisit.findByIdAndUpdate(req.params.id, stripImmutable(req.body), {
      new: true,
      runValidators: true,
    });
    res.json({ success: true, data: visit });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the visit. Please try again.');
  }
};

export const deleteVisit = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await ClusterVisit.findById(req.params.id);
    if (!existing || (req.tenantId && existing.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: "We couldn't find that visit. It may have been removed." });
    }
    await existing.deleteOne();
    res.json({ success: true, message: 'Visit deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the visit. Please try again.');
  }
};
