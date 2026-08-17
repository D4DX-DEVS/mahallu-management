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

export const getAreaReport = async (req: AuthRequest, res: Response) => {
  try {
    const { area, tenantId } = req.query;
    const query: any = {};

    // Apply tenant filter - req.tenantId includes x-tenant-id header for super admin viewing as tenant
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (tenantId && req.isSuperAdmin) {
      query.tenantId = tenantId;
    }

    if (area) query.area = area;

    const families = await Family.find(query);
    const familyIds = families.map((f) => f._id);
    const members = await Member.find({ familyId: { $in: familyIds } });

    const report = {
      totalFamilies: families.length,
      totalMembers: members.length,
      maleCount: members.filter((m) => m.gender === 'male').length,
      femaleCount: members.filter((m) => m.gender === 'female').length,
      families: families.map((f) => ({
        id: f._id,
        houseName: f.houseName,
        area: f.area,
        memberCount: members.filter((m) => m.familyId.toString() === f._id.toString()).length,
      })),
    };

    res.json({ success: true, data: report });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getBloodBankReport = async (req: AuthRequest, res: Response) => {
  try {
    const { bloodGroup, tenantId } = req.query;
    const query: any = {};

    // Apply tenant filter - req.tenantId includes x-tenant-id header for super admin viewing as tenant
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (tenantId && req.isSuperAdmin) {
      query.tenantId = tenantId;
    }

    if (bloodGroup) query.bloodGroup = bloodGroup;

    const members = await Member.find(query).select('name bloodGroup phone age gender');

    const bloodGroupStats: Record<string, number> = {};
    members.forEach((member) => {
      if (member.bloodGroup) {
        bloodGroupStats[member.bloodGroup] = (bloodGroupStats[member.bloodGroup] || 0) + 1;
      }
    });

    res.json({
      success: true,
      data: {
        total: members.length,
        bloodGroupStats,
        members: members.filter((m) => m.bloodGroup),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getOrphansReport = async (req: AuthRequest, res: Response) => {
  try {
    const { tenantId } = req.query;
    const query: any = {};

    // Apply tenant filter - req.tenantId includes x-tenant-id header for super admin viewing as tenant
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (tenantId && req.isSuperAdmin) {
      query.tenantId = tenantId;
    }

    // This is a simplified version - in reality, you'd need to identify orphans based on family structure
    const members = await Member.find(query)
      .populate('familyId', 'houseName')
      .select('name age gender familyId');

    // Filter members who might be orphans (age < 18, or based on other criteria)
    const orphans = members.filter((m) => (m.age || 0) < 18);

    res.json({
      success: true,
      data: {
        total: orphans.length,
        orphans: orphans.map((o) => ({
          id: o._id,
          name: o.name,
          age: o.age,
          gender: o.gender,
          family: (o.familyId as any)?.houseName,
        })),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};


/**
 * Education report (spec 34.3): students count, active classes, attendance %,
 * exams, scholarship totals, support cases by type/status.
 */
export const getEducationReport = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId || (req.isSuperAdmin ? (req.query.tenantId as string) : undefined);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    // Import models needed for education report
    const { MadrasaClass, StudentEnrollment } = require('../models/Madrasa');
    const { ClassAttendance, Exam } = require('../models/Attendance');
    const { Scholarship, ScholarshipAward, AcademicSupportCase } = require('../models/Scholarship');

    const query = { tenantId };

    // Get students count (active enrollments)
    const activeStudents = await StudentEnrollment.countDocuments({
      ...query,
      status: 'active',
    });

    // Get active classes count
    const activeClasses = await MadrasaClass.countDocuments({
      ...query,
      status: 'active',
    });

    // Get attendance for this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const attendanceRecords = await ClassAttendance.find({
      ...query,
      date: { $gte: monthStart, $lte: monthEnd },
    });

    let attendancePercent = 0;
    if (attendanceRecords.length > 0) {
      const totalRecords = attendanceRecords.reduce((sum: number, rec: any) => sum + rec.records.length, 0);
      const presentCount = attendanceRecords.reduce(
        (sum: number, rec: any) => sum + rec.records.filter((r: any) => r.present).length,
        0
      );
      attendancePercent = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;
    }

    // Get exams count
    const examsCount = await Exam.countDocuments(query);

    // Get scholarship stats
    const scholarships = await Scholarship.countDocuments({ ...query, status: 'active' });
    const awards = await ScholarshipAward.find(query);
    const totalAwarded = awards.reduce((sum: number, a: any) => sum + a.amount, 0);
    const awardsByStatus: Record<string, number> = {};
    awards.forEach((a: any) => {
      awardsByStatus[a.status] = (awardsByStatus[a.status] || 0) + 1;
    });

    // Get support cases by type and status
    const supportCases = await AcademicSupportCase.find(query);
    const casesByType: Record<string, number> = {};
    const casesByStatus: Record<string, number> = {};
    supportCases.forEach((c: any) => {
      casesByType[c.type] = (casesByType[c.type] || 0) + 1;
      casesByStatus[c.status] = (casesByStatus[c.status] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        studentsCount: activeStudents,
        activeClassesCount: activeClasses,
        attendancePercentThisMonth: attendancePercent,
        examsCount,
        scholarships: {
          activeScholarships: scholarships,
          totalAwardedAmount: totalAwarded,
          totalAwards: awards.length,
          awardsByStatus,
        },
        supportCases: {
          total: supportCases.length,
          byType: casesByType,
          byStatus: casesByStatus,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Demographic report (spec 34.1): age band, education, employment and welfare
 * aggregates computed live from Member/Family records.
 */
export const getDemographicsReport = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId || (req.isSuperAdmin ? (req.query.tenantId as string) : undefined);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const memberBase: any = { tenantId, status: 'active', isDead: { $ne: true } };

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
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Welfare report (spec 34.2): beneficiaries, assistance totals, pending applications.
 */
export const getWelfareReport = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId || (req.isSuperAdmin ? (req.query.tenantId as string) : undefined);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const tenantObjectId = new mongoose.Types.ObjectId(tenantId as string);
    const query = { tenantId: tenantObjectId };

    const [applications, zakatBeneficiaries, zakatDistributions, reliefCases] = await Promise.all([
      WelfareApplication.find(query),
      ZakatBeneficiary.find(query),
      ZakatDistribution.find(query),
      ReliefCase.find(query),
    ]);

    // Welfare application stats
    const appsByStatus = {
      pending: applications.filter((a: any) => a.status === 'pending').length,
      verified: applications.filter((a: any) => a.status === 'verified').length,
      approved: applications.filter((a: any) => a.status === 'approved').length,
      disbursed: applications.filter((a: any) => a.status === 'disbursed').length,
      rejected: applications.filter((a: any) => a.status === 'rejected').length,
      closed: applications.filter((a: any) => a.status === 'closed').length,
    };

    const requestedTotal = applications.reduce((sum: number, a: any) => sum + (a.requestedAmount || 0), 0);
    const approvedTotal = applications.reduce((sum: number, a: any) => sum + (a.approvedAmount || 0), 0);
    const disbursedTotal = applications.filter((a: any) => a.status === 'disbursed').reduce((sum: number, a: any) => sum + (a.approvedAmount || 0), 0);

    // Zakat beneficiary stats
    const zakatVerified = zakatBeneficiaries.filter((b: any) => b.verificationStatus === 'verified').length;
    const zakatDistributionTotal = zakatDistributions.reduce((sum: number, d: any) => sum + (d.amount || 0), 0);

    // Relief case stats
    const reliefByStatus = {
      reported: reliefCases.filter((r: any) => r.status === 'reported').length,
      verified: reliefCases.filter((r: any) => r.status === 'verified').length,
      approved: reliefCases.filter((r: any) => r.status === 'approved').length,
      assisted: reliefCases.filter((r: any) => r.status === 'assisted').length,
      closed: reliefCases.filter((r: any) => r.status === 'closed').length,
    };

    res.json({
      success: true,
      data: {
        welfare: {
          applications: {
            total: applications.length,
            byStatus: appsByStatus,
          },
          requested: requestedTotal,
          approved: approvedTotal,
          disbursed: disbursedTotal,
        },
        zakat: {
          beneficiaries: {
            total: zakatBeneficiaries.length,
            verified: zakatVerified,
          },
          distributions: {
            total: zakatDistributions.length,
            totalAmount: zakatDistributionTotal,
          },
        },
        relief: {
          cases: {
            total: reliefCases.length,
            byStatus: reliefByStatus,
          },
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Community report (spec 34.2): programs, volunteers, projects
 */
export const getCommunityReport = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId || (req.isSuperAdmin ? (req.query.tenantId as string) : undefined);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const tenantObjectId = new mongoose.Types.ObjectId(tenantId as string);
    const query = { tenantId: tenantObjectId };

    const [programs, volunteers, projects, announcements] = await Promise.all([
      Institute.find({ ...query, type: 'program' }),
      VolunteerProfile.find(query),
      DevelopmentProject.find(query),
      Announcement.find(query),
    ]);

    // Project stats
    const projectsByStatus = {
      proposed: projects.filter((p: any) => p.status === 'proposed').length,
      approved: projects.filter((p: any) => p.status === 'approved').length,
      in_progress: projects.filter((p: any) => p.status === 'in_progress').length,
      completed: projects.filter((p: any) => p.status === 'completed').length,
      dropped: projects.filter((p: any) => p.status === 'dropped').length,
    };

    const totalEstimatedCost = projects.reduce((sum: number, p: any) => sum + (p.estimatedCost || 0), 0);
    const avgProgress = projects.length > 0 ? Math.round(projects.reduce((sum: number, p: any) => sum + (p.progressPercent || 0), 0) / projects.length) : 0;

    // Volunteer stats
    const volunteersByWing = {
      youth: volunteers.filter((v: any) => v.wings && v.wings.includes('youth')).length,
      women: volunteers.filter((v: any) => v.wings && v.wings.includes('women')).length,
      general: volunteers.filter((v: any) => v.wings && v.wings.includes('general')).length,
    };

    // Announcement stats
    const announcementsSent = announcements.filter((a: any) => a.status === 'sent').length;

    res.json({
      success: true,
      data: {
        programs: {
          total: programs.length,
        },
        volunteers: {
          total: volunteers.length,
          byWing: volunteersByWing,
        },
        projects: {
          total: projects.length,
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
    res.status(500).json({ success: false, message: error.message });
  }
};


// GET /reports/data-quality — admin dashboard metrics for data hygiene
export const getDataQualityReport = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant context required' });
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
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /reports/duplicates — suspected duplicate members (shared phone, or same name+age)
export const getDuplicatesReport = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant context required' });
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
    res.status(500).json({ success: false, message: error.message });
  }
};
