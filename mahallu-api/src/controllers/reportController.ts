import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Family from '../models/Family';
import Member from '../models/Member';
import { AuthRequest } from '../middleware/authMiddleware';
import { WelfareApplication } from '../models/Welfare';
import { ZakatDistribution, ZakatBeneficiary } from '../models/Zakat';
import ReliefCase from '../models/ReliefCase';
import { DevelopmentProject } from '../models/DevelopmentProject';
import { VolunteerProfile } from '../models/VolunteerProfile';
import Institute from '../models/Institute';
import Announcement from '../models/Announcement';

import { sendFailure } from '../utils/userMessages';
import { MSG, getCallerScope, isValidId, tenantFilterFor } from '../utils/scope';

/** Shown with an institute account's education report, which leaves the Mahallu-level programmes out. */
export const INSTITUTE_EDUCATION_SCOPE_NOTE =
  "Showing your institute's classes only. Scholarships and academic support are Mahallu-level programmes and are not available for institute accounts.";

/**
 * Every member-facing report counts living people only. Kept in one place so
 * the reports cannot drift apart from each other - and from the family stat
 * cards, survey and registers, which apply the same rule.
 */
const LIVE_MEMBER = { status: { $nin: ['inactive', 'deleted'] }, isDead: { $ne: true } };

export const DEFAULT_REPORT_MAX_ROWS = 5000;

/** Rows a report may list: REPORT_MAX_ROWS, default 5000 (a bad value falls back to it). */
export const reportMaxRows = (env: NodeJS.ProcessEnv = process.env): number => {
  const n = Number(env.REPORT_MAX_ROWS);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_REPORT_MAX_ROWS;
};

/**
 * Cap a list read with `.limit(cap + 1)`: the extra row is only there to tell "exactly cap" from
 * "more than cap". `truncated` is true when the list was cut.
 */
export const capRows = <T>(rows: T[], cap: number): { rows: T[]; truncated: boolean } =>
  rows.length > cap ? { rows: rows.slice(0, cap), truncated: true } : { rows, truncated: false };

/** `{ truncated: true }` to spread into a response, or nothing, so shapes are unchanged when nothing was cut. */
const truncationFlag = (truncated: boolean): { truncated?: true } => (truncated ? { truncated: true } : {});

/** The Mahallu for a report that needs exactly one (400 otherwise), as a validated id string. */
const reportTenantId = (req: AuthRequest, res: Response): string | null => {
  const tenantId = req.tenantId || (req.isSuperAdmin ? (req.query.tenantId as string) : undefined);
  if (!tenantId || !isValidId(String(tenantId))) {
    res.status(400).json({ success: false, message: 'Please select a Mahallu before continuing.' });
    return null;
  }
  return String(tenantId);
};

/** A find() filter made safe for aggregate(), which (unlike find) does not cast ids from strings. */
const forAggregate = (filter: Record<string, any>): Record<string, any> =>
  filter.tenantId ? { ...filter, tenantId: new mongoose.Types.ObjectId(String(filter.tenantId)) } : filter;

export const getAreaReport = async (req: AuthRequest, res: Response) => {
  try {
    const { area } = req.query;
    const scope = tenantFilterFor(req, res);
    if (!scope) return;
    const query: any = { ...scope };
    if (typeof area === 'string' && area) query.area = area;

    const cap = reportMaxRows();

    // Totals are counted by the database; only the listed families are capped.
    const [totalFamilies, familyRows, allFamilyIds] = await Promise.all([
      Family.countDocuments(query),
      Family.find(query).select('houseName area').sort({ _id: 1 }).limit(cap + 1).lean(),
      Family.distinct('_id', query),
    ]);
    const { rows: families, truncated } = capRows(familyRows, cap);

    const [totals, perFamily] = await Promise.all([
      Member.aggregate([
        { $match: { familyId: { $in: allFamilyIds }, ...LIVE_MEMBER } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            male: { $sum: { $cond: [{ $eq: ['$gender', 'male'] }, 1, 0] } },
            female: { $sum: { $cond: [{ $eq: ['$gender', 'female'] }, 1, 0] } },
          },
        },
      ]),
      Member.aggregate([
        { $match: { familyId: { $in: families.map((f: any) => f._id) }, ...LIVE_MEMBER } },
        { $group: { _id: '$familyId', count: { $sum: 1 } } },
      ]),
    ]);
    const memberCounts = new Map<string, number>(perFamily.map((row: any) => [String(row._id), row.count]));

    const report = {
      totalFamilies,
      totalMembers: totals[0]?.total || 0,
      maleCount: totals[0]?.male || 0,
      femaleCount: totals[0]?.female || 0,
      families: families.map((f: any) => ({
        id: f._id,
        houseName: f.houseName,
        area: f.area,
        memberCount: memberCounts.get(String(f._id)) || 0,
      })),
      ...truncationFlag(truncated),
    };

    res.json({ success: true, data: report, ...truncationFlag(truncated) });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the area report right now. Please try again.');
  }
};

export const getBloodBankReport = async (req: AuthRequest, res: Response) => {
  try {
    const { bloodGroup } = req.query;
    const scope = tenantFilterFor(req, res);
    if (!scope) return;
    const query: any = { ...scope, ...LIVE_MEMBER };
    if (typeof bloodGroup === 'string' && bloodGroup) query.bloodGroup = bloodGroup;

    // Members that have a blood group recorded (the list and the per-group counts).
    const withGroup: any = { ...query, bloodGroup: query.bloodGroup ?? { $nin: [null, ''] } };
    const cap = reportMaxRows();

    const [total, stats, memberRows] = await Promise.all([
      Member.countDocuments(query),
      Member.aggregate([
        { $match: forAggregate(withGroup) },
        { $group: { _id: '$bloodGroup', count: { $sum: 1 } } },
      ]),
      Member.find(withGroup).select('name bloodGroup phone age gender').sort({ _id: 1 }).limit(cap + 1).lean(),
    ]);
    const { rows: members, truncated } = capRows(memberRows, cap);

    const bloodGroupStats: Record<string, number> = {};
    stats.forEach((row: any) => {
      if (row._id) bloodGroupStats[row._id] = row.count;
    });

    res.json({
      success: true,
      data: {
        total,
        bloodGroupStats,
        members,
        ...truncationFlag(truncated),
      },
      ...truncationFlag(truncated),
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the blood bank report right now. Please try again.');
  }
};

export const getOrphansReport = async (req: AuthRequest, res: Response) => {
  try {
    const scope = tenantFilterFor(req, res);
    if (!scope) return;

    // This is a simplified version - in reality, you'd need to identify orphans based on family structure.
    // Minors only. An unrecorded age is unknown, not zero - counting those as
    // orphans put every age-less member on the list. The database does the filtering.
    const query: any = { ...scope, ...LIVE_MEMBER, age: { $type: 'number', $lt: 18 } };
    const cap = reportMaxRows();

    const [total, rows] = await Promise.all([
      Member.countDocuments(query),
      Member.find(query)
        .populate('familyId', 'houseName')
        .select('name age gender familyId')
        .sort({ _id: 1 })
        .limit(cap + 1)
        .lean(),
    ]);
    const { rows: orphans, truncated } = capRows(rows, cap);

    res.json({
      success: true,
      data: {
        total,
        orphans: orphans.map((o: any) => ({
          id: o._id,
          name: o.name,
          age: o.age,
          gender: o.gender,
          family: (o.familyId as any)?.houseName,
        })),
        ...truncationFlag(truncated),
      },
      ...truncationFlag(truncated),
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the orphans report right now. Please try again.');
  }
};


/**
 * Education report (spec 34.3): students count, active classes, attendance %,
 * exams, scholarship totals, support cases by type/status.
 *
 * Everything is counted / summed by the database: nothing is loaded into memory, so there is no cap.
 */
export const getEducationReport = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = reportTenantId(req, res);
    if (!tenantId) return;

    // The institute comes from the caller's session, never from the query. An institute account
    // with no institute is refused instead of being given the Mahallu-wide numbers.
    const caller = getCallerScope(req);
    if (caller.isInstitute && !caller.isSuperAdmin && !caller.instituteId) {
      return res.status(403).json({ success: false, message: MSG.noInstitute });
    }
    const instituteOnly = caller.isInstitute && !caller.isSuperAdmin;

    // Import models needed for education report
    const { MadrasaClass, StudentEnrollment } = require('../models/Madrasa');
    const { ClassAttendance, Exam } = require('../models/Attendance');
    const { Scholarship, ScholarshipAward, AcademicSupportCase } = require('../models/Scholarship');

    const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

    // Classes carry the institute (MadrasaClass.instituteId); enrollments, attendance sheets and
    // exams reach it through their classId. For an institute account every one of those counts is
    // limited to the classes of THAT institute in THIS Mahallu.
    const classFilter: Record<string, any> = { tenantId };
    let classIds: mongoose.Types.ObjectId[] | undefined;
    if (instituteOnly) {
      classFilter.instituteId = caller.instituteId;
      const ids: any[] = await MadrasaClass.distinct('_id', classFilter);
      classIds = ids.map((id) => new mongoose.Types.ObjectId(String(id)));
    }
    const byClass = classIds ? { classId: { $in: classIds } } : {};

    const query = { tenantId, ...byClass };

    // Attendance for this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Scholarships, awards and academic support cases are Mahallu-level programmes: none of them
    // has an institute (or a class) to attribute it to, so an institute account does not get them.
    const mahalluLevel = (run: () => Promise<any>, empty: any) => (instituteOnly ? Promise.resolve(empty) : run());

    const [activeStudents, activeClasses, attendanceAgg, examsCount, scholarships, awardRows, caseRows] = await Promise.all([
      // students count (active enrollments)
      StudentEnrollment.countDocuments({ ...query, status: 'active' }),
      // active classes count
      MadrasaClass.countDocuments({ ...classFilter, status: 'active' }),
      ClassAttendance.aggregate([
        { $match: { tenantId: tenantObjectId, ...byClass, date: { $gte: monthStart, $lte: monthEnd } } },
        {
          $group: {
            _id: null,
            total: { $sum: { $size: { $ifNull: ['$records', []] } } },
            present: {
              $sum: { $size: { $filter: { input: { $ifNull: ['$records', []] }, as: 'r', cond: '$$r.present' } } },
            },
          },
        },
      ]),
      Exam.countDocuments(query),
      mahalluLevel(() => Scholarship.countDocuments({ tenantId, status: 'active' }), 0),
      mahalluLevel(
        () =>
          ScholarshipAward.aggregate([
            { $match: { tenantId: tenantObjectId } },
            { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$amount' } } },
          ]),
        []
      ),
      mahalluLevel(
        () =>
          AcademicSupportCase.aggregate([
            { $match: { tenantId: tenantObjectId } },
            { $group: { _id: { type: '$type', status: '$status' }, count: { $sum: 1 } } },
          ]),
        []
      ),
    ]);

    const attendancePercent =
      attendanceAgg[0]?.total > 0 ? Math.round((attendanceAgg[0].present / attendanceAgg[0].total) * 100) : 0;

    let totalAwarded = 0;
    let totalAwards = 0;
    const awardsByStatus: Record<string, number> = {};
    awardRows.forEach((row: any) => {
      totalAwarded += row.amount || 0;
      totalAwards += row.count;
      awardsByStatus[String(row._id)] = (awardsByStatus[String(row._id)] || 0) + row.count;
    });

    let supportTotal = 0;
    const casesByType: Record<string, number> = {};
    const casesByStatus: Record<string, number> = {};
    caseRows.forEach((row: any) => {
      supportTotal += row.count;
      casesByType[String(row._id.type)] = (casesByType[String(row._id.type)] || 0) + row.count;
      casesByStatus[String(row._id.status)] = (casesByStatus[String(row._id.status)] || 0) + row.count;
    });

    res.json({
      success: true,
      data: {
        studentsCount: activeStudents,
        activeClassesCount: activeClasses,
        attendancePercentThisMonth: attendancePercent,
        examsCount,
        // null, not zero: "not available for this account", never a number that looks like data.
        scholarships: instituteOnly
          ? null
          : {
              activeScholarships: scholarships,
              totalAwardedAmount: totalAwarded,
              totalAwards,
              awardsByStatus,
            },
        supportCases: instituteOnly
          ? null
          : {
              total: supportTotal,
              byType: casesByType,
              byStatus: casesByStatus,
            },
        ...(instituteOnly ? { scopeNote: INSTITUTE_EDUCATION_SCOPE_NOTE } : {}),
      },
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the education report right now. Please try again.');
  }
};

/**
 * Demographic report (spec 34.1): age band, education, employment and welfare
 * aggregates computed live from Member/Family records.
 */
export const getDemographicsReport = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = reportTenantId(req, res);
    if (!tenantId) return;

    // Missing status on legacy records predates the field's default and should count as active.
    const memberBase: any = { tenantId, status: { $nin: ['inactive', 'deleted'] }, isDead: { $ne: true } };

    const ageBands = [
      { key: '0-14', min: 0, max: 14 },
      { key: '15-34', min: 15, max: 34 },
      { key: '35-59', min: 35, max: 59 },
      { key: '60+', min: 60, max: 200 },
    ];

    const [ageCounts, education, employment, gender, welfare] = await Promise.all([
      Promise.all(
        ageBands.map((band) =>
          Member.countDocuments({ ...memberBase, age: { $gte: band.min, $lte: band.max } })
        )
      ),
      Member.aggregate([
        { $match: { ...memberBase, tenantId: new mongoose.Types.ObjectId(tenantId) } },
        { $group: { _id: '$education', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Member.aggregate([
        { $match: { ...memberBase, tenantId: new mongoose.Types.ObjectId(tenantId) } },
        { $group: { _id: '$occupationSector', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Promise.all([
        Member.countDocuments({ ...memberBase, gender: 'male' }),
        Member.countDocuments({ ...memberBase, gender: 'female' }),
      ]),
      Family.aggregate([
        { $match: { tenantId: new mongoose.Types.ObjectId(tenantId) } },
        { $group: { _id: '$welfareStatus', count: { $sum: 1 } } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        ageGroups: ageBands.map((band, i) => ({ label: band.key, count: ageCounts[i] })),
        gender: { male: gender[0], female: gender[1] },
        education: education.map((row: any) => ({ label: row._id || 'Not specified', count: row.count })),
        employment: employment.map((row: any) => ({ label: row._id || 'Not specified', count: row.count })),
        welfare: welfare.map((row: any) => ({ label: row._id || 'Not specified', count: row.count })),
      },
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the demographics report right now. Please try again.');
  }
};

/**
 * Welfare report (spec 34.2): beneficiaries, assistance totals, pending applications.
 *
 * Counted / summed by the database: nothing is loaded into memory, so there is no cap.
 */
export const getWelfareReport = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = reportTenantId(req, res);
    if (!tenantId) return;

    const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
    const query = { tenantId: tenantObjectId };

    const [appRows, zakatBeneficiaryTotal, zakatVerified, zakatDistributionAgg, reliefRows] = await Promise.all([
      WelfareApplication.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            requested: { $sum: '$requestedAmount' },
            approved: { $sum: '$approvedAmount' },
          },
        },
      ]),
      ZakatBeneficiary.countDocuments(query),
      ZakatBeneficiary.countDocuments({ ...query, verificationStatus: 'verified' }),
      ZakatDistribution.aggregate([
        { $match: query },
        { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount' } } },
      ]),
      ReliefCase.aggregate([{ $match: query }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);

    // Welfare application stats
    const appsByStatus = { pending: 0, verified: 0, approved: 0, disbursed: 0, rejected: 0, closed: 0 };
    let applicationsTotal = 0;
    let requestedTotal = 0;
    let approvedTotal = 0;
    let disbursedTotal = 0;
    appRows.forEach((row: any) => {
      applicationsTotal += row.count;
      requestedTotal += row.requested || 0;
      approvedTotal += row.approved || 0;
      if (row._id === 'disbursed') disbursedTotal += row.approved || 0;
      if (row._id in appsByStatus) (appsByStatus as Record<string, number>)[row._id] += row.count;
    });

    // Zakat distribution stats
    const zakatDistributionCount = zakatDistributionAgg[0]?.count || 0;
    const zakatDistributionTotal = zakatDistributionAgg[0]?.amount || 0;

    // Relief case stats
    const reliefByStatus = { reported: 0, verified: 0, approved: 0, assisted: 0, closed: 0 };
    let reliefTotal = 0;
    reliefRows.forEach((row: any) => {
      reliefTotal += row.count;
      if (row._id in reliefByStatus) (reliefByStatus as Record<string, number>)[row._id] += row.count;
    });

    res.json({
      success: true,
      data: {
        welfare: {
          applications: {
            total: applicationsTotal,
            byStatus: appsByStatus,
          },
          requested: requestedTotal,
          approved: approvedTotal,
          disbursed: disbursedTotal,
        },
        zakat: {
          beneficiaries: {
            total: zakatBeneficiaryTotal,
            verified: zakatVerified,
          },
          distributions: {
            total: zakatDistributionCount,
            totalAmount: zakatDistributionTotal,
          },
        },
        relief: {
          cases: {
            total: reliefTotal,
            byStatus: reliefByStatus,
          },
        },
      },
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the welfare report right now. Please try again.');
  }
};

/**
 * Community report (spec 34.2): programs, volunteers, projects
 *
 * Counted / summed by the database: nothing is loaded into memory, so there is no cap.
 */
export const getCommunityReport = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = reportTenantId(req, res);
    if (!tenantId) return;

    const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
    const query = { tenantId: tenantObjectId };

    const [programsTotal, volunteersTotal, youth, women, general, projectRows, announcementsSent] = await Promise.all([
      Institute.countDocuments({ ...query, type: 'program' }),
      VolunteerProfile.countDocuments(query),
      VolunteerProfile.countDocuments({ ...query, wings: 'youth' }),
      VolunteerProfile.countDocuments({ ...query, wings: 'women' }),
      VolunteerProfile.countDocuments({ ...query, wings: 'general' }),
      DevelopmentProject.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            cost: { $sum: '$estimatedCost' },
            progress: { $sum: '$progressPercent' },
          },
        },
      ]),
      Announcement.countDocuments({ ...query, status: 'sent' }),
    ]);

    // Project stats
    const projectsByStatus = { proposed: 0, approved: 0, in_progress: 0, completed: 0, dropped: 0 };
    let projectsTotal = 0;
    let totalEstimatedCost = 0;
    let progressSum = 0;
    projectRows.forEach((row: any) => {
      projectsTotal += row.count;
      totalEstimatedCost += row.cost || 0;
      progressSum += row.progress || 0;
      if (row._id in projectsByStatus) (projectsByStatus as Record<string, number>)[row._id] += row.count;
    });
    const avgProgress = projectsTotal > 0 ? Math.round(progressSum / projectsTotal) : 0;

    res.json({
      success: true,
      data: {
        programs: {
          total: programsTotal,
        },
        volunteers: {
          total: volunteersTotal,
          byWing: { youth, women, general },
        },
        projects: {
          total: projectsTotal,
          byStatus: projectsByStatus,
          totalEstimatedCost,
          averageProgress: avgProgress,
        },
        announcements: {
          sent: announcementsSent,
        },
      },
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the community report right now. Please try again.');
  }
};


// GET /reports/data-quality — admin dashboard metrics for data hygiene
export const getDataQualityReport = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Please select a Mahallu before continuing.' });
    }
    const tid = new mongoose.Types.ObjectId(tenantId);

    const [
      totalFamilies,
      pendingFamilies,
      headFamilyIds,
      totalMembers,
      membersMissingPhone,
      membersMissingAge,
      unenrolledStudents,
      duplicatePhoneGroups,
    ] = await Promise.all([
      Family.countDocuments({ tenantId: tid }),
      Family.countDocuments({ tenantId: tid, status: { $ne: 'approved' } }),
      Member.distinct('familyId', { tenantId: tid, isFamilyHead: true, status: 'active' }),
      Member.countDocuments({ tenantId: tid, status: 'active' }),
      Member.countDocuments({ tenantId: tid, status: 'active', $or: [{ phone: { $exists: false } }, { phone: '' }, { phone: null }] }),
      Member.countDocuments({ tenantId: tid, status: 'active', $or: [{ age: { $exists: false } }, { age: null }] }),
      Member.countDocuments({
        tenantId: tid,
        status: 'active',
        occupationSector: 'student',
        educationInstitutionId: { $exists: false },
        localityFacilityId: { $exists: false },
      }),
      Member.aggregate([
        { $match: { tenantId: tid, status: 'active', phone: { $nin: [null, ''] } } },
        { $group: { _id: '$phone', count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
        { $count: 'groups' },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        families: {
          total: totalFamilies,
          pendingApproval: pendingFamilies,
          withoutHead: totalFamilies - headFamilyIds.length,
        },
        members: {
          total: totalMembers,
          missingPhone: membersMissingPhone,
          missingAge: membersMissingAge,
          unenrolledStudents,
        },
        suspectedDuplicatePhoneGroups: duplicatePhoneGroups[0]?.groups || 0,
      },
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the data quality report right now. Please try again.');
  }
};

// GET /reports/duplicates — suspected duplicate members (shared phone, or same name+age)
export const getDuplicatesReport = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Please select a Mahallu before continuing.' });
    }
    const tid = new mongoose.Types.ObjectId(tenantId);

    const [byPhone, byNameAge] = await Promise.all([
      Member.aggregate([
        { $match: { tenantId: tid, status: 'active', phone: { $nin: [null, ''] } } },
        { $group: { _id: '$phone', count: { $sum: 1 }, members: { $push: { id: '$_id', name: '$name', familyName: '$familyName' } } } },
        { $match: { count: { $gt: 1 } } },
        { $limit: 50 },
      ]),
      Member.aggregate([
        { $match: { tenantId: tid, status: 'active', age: { $ne: null } } },
        { $group: { _id: { name: { $toLower: '$name' }, age: '$age' }, count: { $sum: 1 }, members: { $push: { id: '$_id', name: '$name', familyName: '$familyName', phone: '$phone' } } } },
        { $match: { count: { $gt: 1 } } },
        { $limit: 50 },
      ]),
    ]);

    res.json({ success: true, data: { byPhone, byNameAge } });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the duplicates report right now. Please try again.');
  }
};
