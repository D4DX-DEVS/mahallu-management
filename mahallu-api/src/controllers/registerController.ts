import { Response } from 'express';
import Member from '../models/Member';
import Family from '../models/Family';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';

type RegisterSource = 'member' | 'family';

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
    label: 'Zakat Beneficiaries (candidates)',
    filter: () => ({ isZakatEligible: true }),
  },
  'job-seekers': { source: 'member', label: 'Job Seekers', filter: () => ({ isJobSeeker: true }) },
  'skilled-workers': {
    source: 'member',
    label: 'Skilled Workers',
    filter: () => ({ skills: { $exists: true, $not: { $size: 0 } } }),
  },
  students: { source: 'member', label: 'Students', filter: () => ({ occupationSector: 'student' }) },
  marriageable: {
    source: 'member',
    label: 'Marriageable Members',
    filter: (req) => (req.query.gender ? { isMarriageable: true, gender: req.query.gender } : { isMarriageable: true }),
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
  welfare: {
    source: 'family',
    label: 'Welfare Families',
    filter: (req) => {
      const { welfareStatus, economicStatus } = req.query;
      if (welfareStatus) return { welfareStatus };
      if (economicStatus) return { economicStatus };
      return {
        $or: [
          { welfareStatus: { $in: ['receiving', 'applied', 'needs_review'] } },
          { economicStatus: { $in: ['struggling', 'needs_assistance'] } },
        ],
      };
    },
  },
};

const baseQuery = (req: AuthRequest, source: RegisterSource): Record<string, any> => {
  const query: Record<string, any> = {};
  if (req.tenantId) {
    query.tenantId = req.tenantId;
  } else if (req.query.tenantId && req.isSuperAdmin) {
    query.tenantId = req.query.tenantId;
  }
  // Registers list live people / live households only
  if (source === 'member') {
    query.status = 'active';
    query.isDead = { $ne: true };
  }
  return query;
};

export const getRegister = async (req: AuthRequest, res: Response) => {
  try {
    const key = req.params.key;
    const config = REGISTERS[key];
    if (!config) {
      return res.status(404).json({ success: false, message: `Unknown register: ${key}` });
    }

    const { page, limit, skip } = getPaginationParams(req);
    const { search } = req.query;
    const query = { ...baseQuery(req, config.source), ...config.filter(req) };

    if (search) {
      const rx = { $regex: search as string, $options: 'i' };
      query.$and = [
        ...(query.$and || []),
        config.source === 'member'
          ? { $or: [{ name: rx }, { familyName: rx }, { phone: rx }] }
          : { $or: [{ houseName: rx }, { familyHead: rx }, { contactNo: rx }] },
      ];
    }

    if (config.source === 'family') {
      const [data, total] = await Promise.all([
        Family.find(query).sort({ houseName: 1 }).skip(skip).limit(limit),
        Family.countDocuments(query),
      ]);
      return res.json(createPaginationResponse(data, total, page, limit));
    }

    const [data, total] = await Promise.all([
      Member.find(query).populate('familyId', 'houseName area').sort({ name: 1 }).skip(skip).limit(limit),
      Member.countDocuments(query),
    ]);
    res.json(createPaginationResponse(data, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Counts for every register in one round trip - powers the dashboard cards. */
export const getRegisterSummary = async (req: AuthRequest, res: Response) => {
  try {
    const entries = Object.entries(REGISTERS);
    const counts = await Promise.all(
      entries.map(([, config]) => {
        const query = { ...baseQuery(req, config.source), ...config.filter(req) };
        return config.source === 'family' ? Family.countDocuments(query) : Member.countDocuments(query);
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
    res.status(500).json({ success: false, message: error.message });
  }
};
