import { Response } from 'express';
import Member from '../models/Member';
import Family from '../models/Family';
import { NikahRegistration } from '../models/Registration';
import { WelfareApplication } from '../models/Welfare';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { sendFailure } from '../utils/userMessages';
import { regexLiteral } from '../utils/queryGuard';

type RegisterSource = 'member' | 'family' | 'welfare-application';

interface RegisterConfig {
  source: RegisterSource;
  label: string;
  /** Extra filter merged into the tenant-scoped query. */
  filter: (req: AuthRequest) => Record<string, any>;
}

const DEFAULT_ELDERLY_AGE = 60;

/**
 * Community registers (spec 7) are DERIVED views over Member/Family - no new
 * collections. Every entry is a filter plus the shared pagination contract.
 */
export const REGISTERS: Record<string, RegisterConfig> = {
  'zakat-payers': { source: 'member', label: 'Zakat Payers', filter: () => ({ isZakatPayer: true }) },
  'zakat-beneficiaries': {
    source: 'member',
    label: 'Zakat Eligible',
    filter: () => ({ isZakatEligible: true }),
  },
  'job-seekers': { source: 'member', label: 'Job Seekers', filter: () => ({ isJobSeeker: true }) },
  'skilled-workers': {
    source: 'member',
    label: 'Skilled Workers',
    filter: () => ({ skills: { $exists: true, $not: { $size: 0 } } }),
  },
  students: { source: 'member', label: 'Students', filter: () => ({ occupationSector: 'student' }) },
  // Membership resolved from approved nikah registrations (see getMarriageableMemberIds),
  // not the isMarriageable flag - that flag can be stale/manually set (spec 5.3).
  marriageable: {
    source: 'member',
    label: 'Marriageable Members',
    filter: (req) => (req.query.gender ? { gender: req.query.gender } : {}),
  },
  volunteers: { source: 'member', label: 'Volunteers', filter: () => ({ isVolunteer: true }) },
  widows: { source: 'member', label: 'Widows', filter: () => ({ isWidow: true }) },
  orphans: { source: 'member', label: 'Orphans', filter: () => ({ isOrphan: true }) },
  disabled: { source: 'member', label: 'Members with Disability', filter: () => ({ hasDisability: true }) },
  elderly: {
    source: 'member',
    label: 'Senior Citizens',
    filter: (req) => ({ age: { $gte: Number(req.query.minAge) || DEFAULT_ELDERLY_AGE } }),
  },
  unemployed: { source: 'member', label: 'Unemployed', filter: () => ({ occupationSector: 'unemployed' }) },
  // Counts every welfare application regardless of status, not the
  // Family.welfareStatus flag - that flag only updates when an application
  // is linked to a family, so it silently undercounts (see history).
  welfare: {
    source: 'welfare-application',
    label: 'Welfare Families',
    filter: () => ({}),
  },
};

/** Member ids from approved nikah registrations - same source as the dashboard's marriageable count. */
const getMarriageableMemberIds = async (req: AuthRequest): Promise<string[]> => {
  const query: Record<string, any> = { status: 'approved' };
  if (req.tenantId) {
    query.tenantId = req.tenantId;
  } else if (req.query.tenantId && req.isSuperAdmin) {
    query.tenantId = req.query.tenantId;
  }
  const registrations = await NikahRegistration.find(query).select('groomId brideId');
  const ids = new Set<string>();
  registrations.forEach((r) => {
    if (r.groomId) ids.add(r.groomId.toString());
    if (r.brideId) ids.add(r.brideId.toString());
  });
  return Array.from(ids);
};

const baseQuery = (req: AuthRequest, source: RegisterSource): Record<string, any> => {
  const query: Record<string, any> = {};
  if (req.tenantId) {
    query.tenantId = req.tenantId;
  } else if (req.query.tenantId && req.isSuperAdmin) {
    query.tenantId = req.query.tenantId;
  }
  // Registers list live people / live households only. $nin rather than
  // status: 'active' so members migrated in from the old cluster (raw driver
  // inserts, so the schema default never ran and the field is absent) are not
  // silently dropped - a missing field matches $nin, an explicit one does not.
  if (source === 'member') {
    query.status = { $nin: ['deleted', 'inactive'] };
    query.isDead = { $ne: true };
  }
  return query;
};

export const getRegister = async (req: AuthRequest, res: Response) => {
  try {
    const key = req.params.key;
    const config = REGISTERS[key];
    if (!config) {
      return res.status(404).json({ success: false, message: "That register isn't available. Please choose another." });
    }

    const { page, limit, skip } = getPaginationParams(req);
    const { search } = req.query;
    const query = { ...baseQuery(req, config.source), ...config.filter(req) };

    if (key === 'marriageable') {
      query._id = { $in: await getMarriageableMemberIds(req) };
    }

    if (search && config.source !== 'welfare-application') {
      const rx = { $regex: regexLiteral(search as string), $options: 'i' };
      query.$and = [
        ...(query.$and || []),
        config.source === 'member'
          ? { $or: [{ name: rx }, { familyName: rx }, { phone: rx }] }
          : { $or: [{ houseName: rx }, { familyHead: rx }, { contactNo: rx }] },
      ];
    } else if (search) {
      query.reason = { $regex: regexLiteral(search as string), $options: 'i' };
    }

    if (config.source === 'family') {
      const [data, total] = await Promise.all([
        Family.find(query).sort({ houseName: 1 }).skip(skip).limit(limit),
        Family.countDocuments(query),
      ]);
      return res.json(createPaginationResponse(data, total, page, limit));
    }

    if (config.source === 'welfare-application') {
      const [data, total] = await Promise.all([
        WelfareApplication.find(query)
          .populate('schemeId', 'name category')
          .populate('familyId', 'houseName familyHead contactNo')
          .populate('memberId', 'name phone')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        WelfareApplication.countDocuments(query),
      ]);
      return res.json(createPaginationResponse(data, total, page, limit));
    }

    const [data, total] = await Promise.all([
      Member.find(query).populate('familyId', 'houseName area').sort({ name: 1 }).skip(skip).limit(limit),
      Member.countDocuments(query),
    ]);
    res.json(createPaginationResponse(data, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the register right now. Please try again.');
  }
};

/** Counts for every register in one round trip - powers the dashboard cards. */
export const getRegisterSummary = async (req: AuthRequest, res: Response) => {
  try {
    const entries = Object.entries(REGISTERS);
    const marriageableIds = await getMarriageableMemberIds(req);
    const counts = await Promise.all(
      entries.map(([key, config]) => {
        const query = { ...baseQuery(req, config.source), ...config.filter(req) };
        if (key === 'marriageable') {
          query._id = { $in: marriageableIds };
        }
        if (config.source === 'family') return Family.countDocuments(query);
        if (config.source === 'welfare-application') return WelfareApplication.countDocuments(query);
        return Member.countDocuments(query);
      })
    );

    res.json({
      success: true,
      data: entries.map(([key, config], i) => ({
        key,
        label: config.label,
        source: config.source,
        count: counts[i],
      })),
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the register summary right now. Please try again.');
  }
};
