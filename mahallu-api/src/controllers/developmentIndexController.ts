import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/authMiddleware';
import Family from '../models/Family';
import Member from '../models/Member';
import Committee from '../models/Committee';
import Meeting from '../models/Meeting';
import Institute from '../models/Institute';
import Announcement from '../models/Announcement';
import Khutbah from '../models/Khutbah';
import MedicalCamp from '../models/MedicalCamp';
import HealthResource from '../models/HealthResource';
import { WelfareApplication } from '../models/Welfare';
import { ZakatDistribution } from '../models/Zakat';
import { Zakat } from '../models/Collectible';
import { LedgerItem } from '../models/MasterAccount';
import { StudentEnrollment } from '../models/Madrasa';
import { JobVacancy, SkillTraining } from '../models/Employment';
import { VolunteerProfile } from '../models/VolunteerProfile';
import { DevelopmentProject } from '../models/DevelopmentProject';
import {
  DIMENSIONS,
  FAMILY_FRESHNESS_MONTHS,
  STUDENT_AGE_MAX,
  STUDENT_AGE_MIN,
  TARGETS,
  YOUTH_AGE_MAX,
  YOUTH_AGE_MIN,
  score,
} from '../config/developmentIndex';

interface Dimension {
  key: string;
  label: string;
  score: number;
  indicators: Record<string, number>;
}

/**
 * GET /api/development-index (Task C2, spec §32).
 * Twelve dimension scores computed live from existing collections. Formula
 * constants live in config/developmentIndex.ts.
 * ponytail: computed on read, no IndexSnapshot model or cron. Add the snapshot
 * only when someone asks for quarter-over-quarter trends.
 */
/** Pure data computation — shared by the HTTP handler and the AI assistant tool. */
export const computeDevelopmentIndex = async (tid: mongoose.Types.ObjectId) => {
  const q = { tenantId: tid };

    const now = new Date();
    const yearAgo = new Date(now);
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    const freshnessCutoff = new Date(now);
    freshnessCutoff.setMonth(freshnessCutoff.getMonth() - FAMILY_FRESHNESS_MONTHS);

    const sum = async (model: any, match: any, field = 'amount') => {
      const [row] = await model.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: `$${field}` } } }]);
      return row?.total || 0;
    };

    const [
      totalFamilies,
      freshFamilies,
      flaggedFamilies,
      welfareApplications,
      welfareProcessed,
      khutbahsDelivered,
      schoolAgeMembers,
      activeEnrollments,
      zakatCollected,
      zakatDistributed,
      vacancies,
      trainings,
      youthMembers,
      youthVolunteers,
      adultWomen,
      womenVolunteers,
      healthResources,
      camps,
      ledgerDates,
      committees,
      meetings,
      programs,
      announcementsSent,
      activeProjects,
    ] = await Promise.all([
      Family.countDocuments(q),
      Family.countDocuments({ ...q, updatedAt: { $gte: freshnessCutoff } }),
      Family.countDocuments({ ...q, welfareStatus: { $in: ['applied', 'needs_review', 'receiving'] } }),
      WelfareApplication.countDocuments(q),
      WelfareApplication.countDocuments({ ...q, status: { $in: ['approved', 'disbursed', 'closed'] } }),
      Khutbah.countDocuments({ ...q, status: 'delivered', date: { $gte: yearAgo } }),
      Member.countDocuments({ ...q, age: { $gte: STUDENT_AGE_MIN, $lte: STUDENT_AGE_MAX } }),
      StudentEnrollment.countDocuments({ ...q, status: 'active' }),
      sum(Zakat, { ...q, paymentDate: { $gte: yearAgo } }),
      sum(ZakatDistribution, { ...q, distributionDate: { $gte: yearAgo } }),
      JobVacancy.countDocuments({ ...q, postedDate: { $gte: yearAgo } }),
      SkillTraining.find({ ...q, startDate: { $gte: yearAgo } }),
      Member.countDocuments({ ...q, age: { $gte: YOUTH_AGE_MIN, $lte: YOUTH_AGE_MAX } }),
      VolunteerProfile.countDocuments({ ...q, status: 'active', wings: 'youth' }),
      Member.countDocuments({ ...q, gender: 'female', age: { $gte: 18 } }),
      VolunteerProfile.countDocuments({ ...q, status: 'active', wings: 'women' }),
      HealthResource.countDocuments({ ...q, status: 'active' }),
      MedicalCamp.countDocuments({ ...q, campDate: { $gte: yearAgo } }),
      LedgerItem.distinct('date', { ...q, date: { $gte: yearAgo } }),
      Committee.countDocuments({ ...q, status: 'active' }),
      Meeting.countDocuments({ ...q, meetingDate: { $gte: yearAgo }, status: 'completed' }),
      Institute.countDocuments({ ...q, type: 'program' }),
      Announcement.countDocuments({ ...q, status: 'sent' }),
      DevelopmentProject.countDocuments({ ...q, status: { $in: ['approved', 'in_progress'] } }),
    ]);

    const trainingParticipants = (trainings as any[]).reduce(
      (s: number, t: any) => s + (t.participants?.length || 0),
      0
    );
    const activeMonths = new Set(
      (ledgerDates as Date[]).map((d) => `${d.getUTCFullYear()}-${d.getUTCMonth()}`)
    ).size;

    const dims: Record<string, Dimension> = {
      familyData: {
        key: 'familyData',
        label: 'Family Data',
        score: score(freshFamilies, totalFamilies),
        indicators: { totalFamilies, updatedLast12Months: freshFamilies },
      },
      worship: {
        key: 'worship',
        label: 'Worship',
        score: score(khutbahsDelivered, TARGETS.khutbahsPerYear),
        indicators: { khutbahsDelivered, target: TARGETS.khutbahsPerYear },
      },
      education: {
        key: 'education',
        label: 'Education',
        score: score(activeEnrollments, schoolAgeMembers * TARGETS.educationEnrollmentRatio),
        indicators: { schoolAgeMembers, activeEnrollments },
      },
      welfare: {
        key: 'welfare',
        label: 'Welfare',
        score: score(welfareProcessed, Math.max(flaggedFamilies, welfareApplications)),
        indicators: { flaggedFamilies, applications: welfareApplications, processed: welfareProcessed },
      },
      zakat: {
        key: 'zakat',
        label: 'Zakat',
        score: score(zakatDistributed, zakatCollected),
        indicators: { collected: zakatCollected, distributed: zakatDistributed },
      },
      economy: {
        key: 'economy',
        label: 'Economy',
        score: score(vacancies + trainingParticipants, TARGETS.economyOpportunities),
        indicators: { vacancies, trainingParticipants },
      },
      youth: {
        key: 'youth',
        label: 'Youth',
        score: score(youthVolunteers, youthMembers * TARGETS.youthVolunteerRatio),
        indicators: { youthMembers, youthVolunteers },
      },
      women: {
        key: 'women',
        label: 'Women',
        score: score(womenVolunteers, adultWomen * TARGETS.womenParticipationRatio),
        indicators: { adultWomen, womenVolunteers },
      },
      health: {
        key: 'health',
        label: 'Health',
        score: Math.round(
          (score(healthResources, TARGETS.healthResources) + score(camps, TARGETS.healthCampsPerYear)) / 2
        ),
        indicators: { healthResources, campsLast12Months: camps },
      },
      finance: {
        key: 'finance',
        label: 'Finance',
        score: score(activeMonths, 12),
        indicators: { monthsWithLedgerActivity: activeMonths },
      },
      governance: {
        key: 'governance',
        label: 'Governance',
        score: score(meetings, committees * TARGETS.meetingsPerCommitteePerYear),
        indicators: { activeCommittees: committees, meetingsLast12Months: meetings },
      },
      community: {
        key: 'community',
        label: 'Community',
        score: score(programs + announcementsSent + activeProjects, TARGETS.communityInitiatives),
        indicators: { programs, announcementsSent, activeProjects },
      },
    };

    const dimensions = DIMENSIONS.map((d) => dims[d.key]);
    const totalScore = Math.round(dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length);
    const weakest = [...dimensions]
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .map((d) => d.key);

    return { dimensions, totalScore, weakest, generatedAt: now };
};

export const getDevelopmentIndex = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId || (req.isSuperAdmin ? (req.query.tenantId as string) : undefined);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const data = await computeDevelopmentIndex(new mongoose.Types.ObjectId(tenantId as string));
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
