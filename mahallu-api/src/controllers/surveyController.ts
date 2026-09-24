import { Response } from 'express';
import SurveySnapshot from '../models/SurveySnapshot';
import LocalityFacility from '../models/LocalityFacility';
import Member from '../models/Member';
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

const addYears = (date: Date, years: number): Date => {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return next;
};

/** Live aggregate of every demographic stat the snapshot stores. */
const computeStats = async (tenantId: string) => {
  // $nin (not `status: 'active'`) so members migrated in from the old cluster -
  // raw driver inserts, schema defaults never applied, no `status` field - still
  // count as live. A missing field matches $nin, an explicit inactive/deleted does not.
  const memberBase = { tenantId, status: { $nin: ['deleted', 'inactive'] }, isDead: { $ne: true } };

  const [
    totalHouseholds,
    totalPopulation,
    men,
    women,
    children,
    youth,
    seniorCitizens,
    students,
    married,
    unmarried,
    employed,
    unemployed,
    widows,
    orphans,
    disabled,
    familiesNeedingAssistance,
  ] = await Promise.all([
    Family.countDocuments({ tenantId }),
    Member.countDocuments(memberBase),
    Member.countDocuments({ ...memberBase, gender: 'male' }),
    Member.countDocuments({ ...memberBase, gender: 'female' }),
    Member.countDocuments({ ...memberBase, age: { $lt: 15 } }),
    Member.countDocuments({ ...memberBase, age: { $gte: 15, $lt: 35 } }),
    Member.countDocuments({ ...memberBase, age: { $gte: 60 } }),
    Member.countDocuments({ ...memberBase, occupationSector: 'student' }),
    Member.countDocuments({ ...memberBase, maritalStatus: 'married' }),
    Member.countDocuments({ ...memberBase, maritalStatus: 'single' }),
    Member.countDocuments({
      ...memberBase,
      occupationSector: { $in: ['government', 'private', 'self_employed', 'abroad'] },
    }),
    Member.countDocuments({ ...memberBase, occupationSector: 'unemployed' }),
    Member.countDocuments({ ...memberBase, isWidow: true }),
    Member.countDocuments({ ...memberBase, isOrphan: true }),
    Member.countDocuments({ ...memberBase, hasDisability: true }),
    Family.countDocuments({
      tenantId,
      $or: [
        { welfareStatus: { $in: ['receiving', 'applied', 'needs_review'] } },
        { economicStatus: { $in: ['struggling', 'needs_assistance'] } },
      ],
    }),
  ]);

  return {
    totalHouseholds,
    totalPopulation,
    men,
    women,
    children,
    youth,
    seniorCitizens,
    students,
    married,
    unmarried,
    employed,
    unemployed,
    widows,
    orphans,
    disabled,
    familiesNeedingAssistance,
  };
};

export const generateSurvey = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = tenantScope(req);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Please select a Mahallu before continuing.' });
    }

    const type = req.body.type === 'comprehensive' ? 'comprehensive' : 'annual';
    const surveyDate = req.body.surveyDate ? new Date(req.body.surveyDate) : new Date();
    const stats = await computeStats(tenantId.toString());

    const snapshot = await SurveySnapshot.create({
      tenantId,
      surveyDate,
      type,
      // comprehensive = 4-year cycle, annual = 1-year cycle (spec 5.3)
      nextReviewDate: addYears(surveyDate, type === 'comprehensive' ? 4 : 1),
      stats,
      notes: req.body.notes,
      createdBy: req.user?._id,
    });

    res.status(201).json({ success: true, data: snapshot });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t prepare the survey for download. Please try again.');
  }
};

export const getAllSurveys = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const { type } = req.query;
    const query: any = {};
    const tenantId = tenantScope(req);
    if (tenantId) query.tenantId = tenantId;
    if (type) query.type = type;

    const [data, total] = await Promise.all([
      SurveySnapshot.find(query).sort({ surveyDate: -1 }).skip(skip).limit(limit),
      SurveySnapshot.countDocuments(query),
    ]);

    res.json(createPaginationResponse(data, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the surveys right now. Please try again.');
  }
};

export const getSurveyById = async (req: AuthRequest, res: Response) => {
  try {
    const snapshot = await SurveySnapshot.findById(req.params.id);
    if (!snapshot || (req.tenantId && snapshot.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: "We couldn't find that survey. It may have been removed." });
    }

    // Previous snapshot lets the UI show movement without a second request
    const previous = await SurveySnapshot.findOne({
      tenantId: snapshot.tenantId,
      surveyDate: { $lt: snapshot.surveyDate },
    }).sort({ surveyDate: -1 });

    res.json({ success: true, data: { snapshot, previous } });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the survey right now. Please try again.');
  }
};

export const getSurveyStatus = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = tenantScope(req);
    if (!tenantId) return res.json({ success: true, data: { latest: null, isOverdue: false } });

    const latest = await SurveySnapshot.findOne({ tenantId }).sort({ surveyDate: -1 });
    const isOverdue = !latest || latest.nextReviewDate.getTime() < Date.now();

    res.json({
      success: true,
      data: { latest, isOverdue, liveStats: await computeStats(tenantId.toString()) },
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the survey status right now. Please try again.');
  }
};

export const deleteSurvey = async (req: AuthRequest, res: Response) => {
  try {
    const snapshot = await SurveySnapshot.findById(req.params.id);
    if (!snapshot || (req.tenantId && snapshot.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: "We couldn't find that survey. It may have been removed." });
    }
    await snapshot.deleteOne();
    res.json({ success: true, message: 'Survey snapshot deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the survey. Please try again.');
  }
};

// ---------------------------------------------------------------------------
// Locality facilities (spec 5.2)
// ---------------------------------------------------------------------------

export const getAllFacilities = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const { type, status, search } = req.query;
    const query: any = {};
    const tenantId = tenantScope(req);
    if (tenantId) query.tenantId = tenantId;
    if (type) query.type = type;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: regexLiteral(search), $options: 'i' } },
        { nameMl: { $regex: regexLiteral(search), $options: 'i' } },
        { address: { $regex: regexLiteral(search), $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      LocalityFacility.find(query).sort({ name: 1 }).skip(skip).limit(limit),
      LocalityFacility.countDocuments(query),
    ]);

    res.json(createPaginationResponse(data, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the facilities right now. Please try again.');
  }
};

export const getFacilityById = async (req: AuthRequest, res: Response) => {
  try {
    const facility = await LocalityFacility.findById(req.params.id);
    if (!facility || (req.tenantId && facility.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: "We couldn't find that facility. It may have been removed." });
    }
    res.json({ success: true, data: facility });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the facility right now. Please try again.');
  }
};

export const createFacility = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = tenantScope(req) || req.body.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Please select a Mahallu before continuing.' });
    }
    const facility = await LocalityFacility.create({ ...req.body, tenantId });
    res.status(201).json({ success: true, data: facility });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the facility. Please try again.');
  }
};

export const updateFacility = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await LocalityFacility.findById(req.params.id);
    if (!existing || (req.tenantId && existing.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: "We couldn't find that facility. It may have been removed." });
    }
    const facility = await LocalityFacility.findByIdAndUpdate(req.params.id, stripImmutable(req.body), {
      new: true,
      runValidators: true,
    });
    res.json({ success: true, data: facility });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the facility. Please try again.');
  }
};

export const deleteFacility = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await LocalityFacility.findById(req.params.id);
    if (!existing || (req.tenantId && existing.tenantId.toString() !== req.tenantId)) {
      return res.status(404).json({ success: false, message: "We couldn't find that facility. It may have been removed." });
    }
    await existing.deleteOne();
    res.json({ success: true, message: 'Facility deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the facility. Please try again.');
  }
};
