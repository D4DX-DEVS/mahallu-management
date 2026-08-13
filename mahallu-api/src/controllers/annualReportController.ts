import { Response } from 'express';
import mongoose from 'mongoose';
import Family from '../models/Family';
import Member from '../models/Member';
import { AuthRequest } from '../middleware/authMiddleware';
import SurveySnapshot from '../models/SurveySnapshot';
import { LedgerItem } from '../models/MasterAccount';
import { Zakat } from '../models/Collectible';
import { WelfareApplication } from '../models/Welfare';
import { ZakatDistribution } from '../models/Zakat';
import { MadrasaClass, StudentEnrollment } from '../models/Madrasa';
import { Exam } from '../models/Attendance';
import { JobVacancy, SkillTraining } from '../models/Employment';
import Institute from '../models/Institute';
import { DevelopmentProject } from '../models/DevelopmentProject';

export const yearRange = (year: number) => ({
  start: new Date(Date.UTC(year, 0, 1)),
  end: new Date(Date.UTC(year + 1, 0, 1)),
});

/**
 * Annual "State of the Mahallu" report (spec 31.2 / Task C1).
 * Single aggregation over the calendar year: demographics, finance, welfare,
 * zakat, education, employment, programs, projects.
 * ponytail: countDocuments + one sum-aggregate per collection — no snapshot model,
 * recompute on read. Add an AnnualSnapshot cache only if this gets slow.
 */
/** Pure data computation — shared by the HTTP handler and the AI assistant tool. */
export const computeAnnualReport = async (tid: mongoose.Types.ObjectId, year: number) => {
  const { start, end } = yearRange(year);
  const q = { tenantId: tid };
    const inYear = (field: string) => ({ tenantId: tid, [field]: { $gte: start, $lt: end } });

    const sum = async (model: any, match: any, field = 'amount') => {
      const [row] = await model.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: `$${field}` } } }]);
      return row?.total || 0;
    };

    const [
      totalFamilies,
      totalMembers,
      latestSurvey,
      ledgerIncome,
      ledgerExpense,
      welfareApps,
      welfareDisbursed,
      zakatCollected,
      zakatDistributed,
      classes,
      activeEnrollments,
      exams,
      vacancies,
      trainings,
      programs,
      projects,
    ] = await Promise.all([
      Family.countDocuments(q),
      Member.countDocuments(q),
      SurveySnapshot.findOne({ tenantId: tid, surveyDate: { $lt: end } }).sort({ surveyDate: -1 }),
      sum(LedgerItem, { ...inYear('date'), type: 'income' }),
      sum(LedgerItem, { ...inYear('date'), type: 'expense' }),
      WelfareApplication.countDocuments(inYear('createdAt')),
      sum(WelfareApplication, { ...inYear('createdAt'), status: 'disbursed' }, 'approvedAmount'),
      sum(Zakat, inYear('paymentDate')),
      sum(ZakatDistribution, inYear('distributionDate')),
      MadrasaClass.countDocuments({ ...q, status: 'active' }),
      StudentEnrollment.countDocuments({ ...q, status: 'active' }),
      Exam.countDocuments(inYear('examDate')),
      JobVacancy.countDocuments(inYear('postedDate')),
      SkillTraining.countDocuments(inYear('startDate')),
      Institute.countDocuments({ ...q, type: 'program' }),
      DevelopmentProject.find(q),
    ]);

    const trainingDocs = await SkillTraining.find(inYear('startDate'));
    const trainedParticipants = trainingDocs.reduce((s: number, t: any) => s + (t.participants?.length || 0), 0);
    const employedOutcomes = trainingDocs.reduce(
      (s: number, t: any) =>
        s + (t.participants || []).filter((p: any) => p.employmentOutcome && p.employmentOutcome !== 'none').length,
      0
    );

    return {
        year,
        demographics: {
          totalFamilies,
          totalMembers,
          latestSurvey: latestSurvey
            ? { surveyDate: (latestSurvey as any).surveyDate, type: (latestSurvey as any).type, stats: (latestSurvey as any).stats }
            : null,
        },
        finance: {
          income: ledgerIncome,
          expense: ledgerExpense,
          balance: ledgerIncome - ledgerExpense,
        },
        welfare: {
          applications: welfareApps,
          disbursedAmount: welfareDisbursed,
        },
        zakat: {
          collected: zakatCollected,
          distributed: zakatDistributed,
          balance: zakatCollected - zakatDistributed,
        },
        education: {
          activeClasses: classes,
          activeStudents: activeEnrollments,
          exams,
        },
        employment: {
          vacanciesPosted: vacancies,
          trainings,
          trainedParticipants,
          employedOutcomes,
        },
        programs: { total: programs },
        projects: {
          total: projects.length,
          completed: projects.filter((p: any) => p.status === 'completed').length,
          inProgress: projects.filter((p: any) => p.status === 'in_progress').length,
          totalEstimatedCost: projects.reduce((s: number, p: any) => s + (p.estimatedCost || 0), 0),
        },
  };
};

export const getAnnualReport = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId || (req.isSuperAdmin ? (req.query.tenantId as string) : undefined);
    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }

    const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();
    if (year < 1900 || year > 3000) {
      return res.status(400).json({ success: false, message: 'Invalid year' });
    }

    const data = await computeAnnualReport(new mongoose.Types.ObjectId(tenantId as string), year);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
