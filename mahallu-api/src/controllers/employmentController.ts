import { Response } from 'express';
import mongoose from 'mongoose';
import { Employer, JobVacancy, SkillTraining } from '../models/Employment';
import Member from '../models/Member';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { stripImmutable, refBelongsToTenant } from '../utils/sanitizeUpdate';

import { sendFailure } from '../utils/userMessages';
import { regexLiteral } from '../utils/queryGuard';

const tenantScope = (req: AuthRequest): Record<string, any> =>
  req.tenantId ? { tenantId: req.tenantId } : {};

// ============= EMPLOYER ENDPOINTS =============

export const getAllEmployers = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { ...tenantScope(req) };

    if (req.query.status) query.status = req.query.status;
    if (req.query.search) query.name = { $regex: regexLiteral(String(req.query.search)), $options: 'i' };

    const [employers, total] = await Promise.all([
      Employer.find(query)
        .populate('memberId', 'name phone')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit),
      Employer.countDocuments(query),
    ]);

    res.json(createPaginationResponse(employers, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the employers right now. Please try again.');
  }
};

export const getEmployerById = async (req: AuthRequest, res: Response) => {
  try {
    const employer = await Employer.findOne({ _id: req.params.id, ...tenantScope(req) }).populate(
      'memberId',
      'name phone'
    );

    if (!employer) {
      return res.status(404).json({ success: false, message: "We couldn't find that employer. It may have been removed." });
    }

    res.json({ success: true, data: employer });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the employer right now. Please try again.');
  }
};

export const createEmployer = async (req: AuthRequest, res: Response) => {
  try {
    if (req.body.memberId && !(await refBelongsToTenant(Member, req.body.memberId, req.tenantId))) {
      return res.status(400).json({ success: false, message: 'This member belongs to another Mahallu.' });
    }

    const employer = await Employer.create({
      ...stripImmutable(req.body),
      tenantId: req.tenantId,
    });

    res.status(201).json({ success: true, data: employer });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the employer. Please try again.');
  }
};

export const updateEmployer = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await Employer.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!existing) {
      return res.status(404).json({ success: false, message: "We couldn't find that employer. It may have been removed." });
    }

    if (req.body.memberId && !(await refBelongsToTenant(Member, req.body.memberId, req.tenantId))) {
      return res.status(400).json({ success: false, message: 'This member belongs to another Mahallu.' });
    }

    const employer = await Employer.findByIdAndUpdate(req.params.id, stripImmutable(req.body), {
      new: true,
      runValidators: true,
    }).populate('memberId', 'name phone');

    res.json({ success: true, data: employer });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the employer. Please try again.');
  }
};

export const deleteEmployer = async (req: AuthRequest, res: Response) => {
  try {
    const employer = await Employer.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!employer) {
      return res.status(404).json({ success: false, message: "We couldn't find that employer. It may have been removed." });
    }

    await Employer.deleteOne({ _id: req.params.id });
    res.json({ success: true, message: 'Employer deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the employer. Please try again.');
  }
};

// ============= JOB VACANCY ENDPOINTS =============

export const getAllVacancies = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { ...tenantScope(req) };

    if (req.query.status) query.status = req.query.status;
    if (req.query.employerId) query.employerId = req.query.employerId;
    if (req.query.search) query.title = { $regex: regexLiteral(String(req.query.search)), $options: 'i' };

    const [vacancies, total] = await Promise.all([
      JobVacancy.find(query)
        .populate('employerId', 'name location')
        .sort({ postedDate: -1 })
        .skip(skip)
        .limit(limit),
      JobVacancy.countDocuments(query),
    ]);

    res.json(createPaginationResponse(vacancies, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the vacancies right now. Please try again.');
  }
};

export const getVacancyById = async (req: AuthRequest, res: Response) => {
  try {
    const vacancy = await JobVacancy.findOne({ _id: req.params.id, ...tenantScope(req) }).populate(
      'employerId',
      'name location'
    );

    if (!vacancy) {
      return res.status(404).json({ success: false, message: "We couldn't find that job vacancy. It may have been removed." });
    }

    res.json({ success: true, data: vacancy });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the vacancy right now. Please try again.');
  }
};

export const createVacancy = async (req: AuthRequest, res: Response) => {
  try {
    // Validate that either employerId or employerName is present
    if (!req.body.employerId && !req.body.employerName) {
      return res.status(400).json({
        success: false,
        message: 'Please choose an employer, or enter the employer’s name.',
      });
    }

    if (req.body.employerId && !(await refBelongsToTenant(Employer, req.body.employerId, req.tenantId))) {
      return res.status(400).json({ success: false, message: 'This employer belongs to another Mahallu.' });
    }

    const vacancy = await JobVacancy.create({
      ...stripImmutable(req.body),
      tenantId: req.tenantId,
    });

    res.status(201).json({ success: true, data: vacancy });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the vacancy. Please try again.');
  }
};

export const updateVacancy = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await JobVacancy.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!existing) {
      return res.status(404).json({ success: false, message: "We couldn't find that job vacancy. It may have been removed." });
    }

    if (req.body.employerId && !(await refBelongsToTenant(Employer, req.body.employerId, req.tenantId))) {
      return res.status(400).json({ success: false, message: 'This employer belongs to another Mahallu.' });
    }

    const vacancy = await JobVacancy.findByIdAndUpdate(req.params.id, stripImmutable(req.body), {
      new: true,
      runValidators: true,
    }).populate('employerId', 'name location');

    res.json({ success: true, data: vacancy });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the vacancy. Please try again.');
  }
};

export const deleteVacancy = async (req: AuthRequest, res: Response) => {
  try {
    const vacancy = await JobVacancy.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!vacancy) {
      return res.status(404).json({ success: false, message: "We couldn't find that job vacancy. It may have been removed." });
    }

    await JobVacancy.deleteOne({ _id: req.params.id });
    res.json({ success: true, message: 'Job vacancy deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the vacancy. Please try again.');
  }
};

// ============= SKILL TRAINING ENDPOINTS =============

export const getAllTrainings = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { ...tenantScope(req) };

    if (req.query.status) query.status = req.query.status;
    if (req.query.search) query.name = { $regex: regexLiteral(String(req.query.search)), $options: 'i' };

    const [trainings, total] = await Promise.all([
      SkillTraining.find(query)
        .populate('participants.memberId', 'name')
        .sort({ startDate: -1 })
        .skip(skip)
        .limit(limit),
      SkillTraining.countDocuments(query),
    ]);

    const withCounts = trainings.map((t) => ({
      ...t.toObject(),
      participantCount: t.participants.length,
    }));

    res.json(createPaginationResponse(withCounts, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the trainings right now. Please try again.');
  }
};

export const getTrainingById = async (req: AuthRequest, res: Response) => {
  try {
    const training = await SkillTraining.findOne({ _id: req.params.id, ...tenantScope(req) }).populate(
      'participants.memberId',
      'name phone'
    );

    if (!training) {
      return res.status(404).json({ success: false, message: "We couldn't find that skill training. It may have been removed." });
    }

    res.json({
      success: true,
      data: {
        ...training.toObject(),
        participantCount: training.participants.length,
      },
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the training right now. Please try again.');
  }
};

export const createTraining = async (req: AuthRequest, res: Response) => {
  try {
    const training = await SkillTraining.create({
      ...stripImmutable(req.body),
      tenantId: req.tenantId,
      participants: req.body.participants || [],
    });

    res.status(201).json({ success: true, data: training });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the training. Please try again.');
  }
};

export const updateTraining = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await SkillTraining.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!existing) {
      return res.status(404).json({ success: false, message: "We couldn't find that skill training. It may have been removed." });
    }

    const training = await SkillTraining.findByIdAndUpdate(req.params.id, stripImmutable(req.body), {
      new: true,
      runValidators: true,
    }).populate('participants.memberId', 'name phone');

    res.json({ success: true, data: training });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the training. Please try again.');
  }
};

export const deleteTraining = async (req: AuthRequest, res: Response) => {
  try {
    const training = await SkillTraining.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!training) {
      return res.status(404).json({ success: false, message: "We couldn't find that skill training. It may have been removed." });
    }

    await SkillTraining.deleteOne({ _id: req.params.id });
    res.json({ success: true, message: 'Skill training deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the training. Please try again.');
  }
};

// ============= SKILL TRAINING PARTICIPANTS ENDPOINTS =============

export const addParticipant = async (req: AuthRequest, res: Response) => {
  try {
    const training = await SkillTraining.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!training) {
      return res.status(404).json({ success: false, message: "We couldn't find that skill training. It may have been removed." });
    }

    const { memberId } = req.body;
    if (!memberId) {
      return res.status(400).json({ success: false, message: 'Please select a member.' });
    }

    if (!(await refBelongsToTenant(Member, memberId, req.tenantId))) {
      return res.status(400).json({ success: false, message: 'This member belongs to another Mahallu.' });
    }

    // Check if already enrolled
    if (training.participants.some((p) => p.memberId.toString() === memberId)) {
      return res.status(400).json({ success: false, message: 'This member is already a participant.' });
    }

    training.participants.push({
      memberId: new mongoose.Types.ObjectId(memberId),
      certificateIssued: false,
      employmentOutcome: 'none',
    });

    await training.save();
    const updated = await SkillTraining.findById(training._id).populate('participants.memberId', 'name phone');

    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the participant. Please try again.');
  }
};

export const updateParticipant = async (req: AuthRequest, res: Response) => {
  try {
    const training = await SkillTraining.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!training) {
      return res.status(404).json({ success: false, message: "We couldn't find that skill training. It may have been removed." });
    }

    const participant = training.participants.find((p) => p.memberId.toString() === req.params.memberId);
    if (!participant) {
      return res.status(404).json({ success: false, message: "We couldn't find that participant. It may have been removed." });
    }

    if (req.body.certificateIssued !== undefined) {
      participant.certificateIssued = req.body.certificateIssued;
    }
    if (req.body.employmentOutcome !== undefined) {
      participant.employmentOutcome = req.body.employmentOutcome;
    }

    await training.save();
    const updated = await SkillTraining.findById(training._id).populate('participants.memberId', 'name phone');

    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the participant. Please try again.');
  }
};

export const removeParticipant = async (req: AuthRequest, res: Response) => {
  try {
    const training = await SkillTraining.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!training) {
      return res.status(404).json({ success: false, message: "We couldn't find that skill training. It may have been removed." });
    }

    training.participants = training.participants.filter(
      (p) => p.memberId.toString() !== req.params.memberId
    );

    await training.save();
    const updated = await SkillTraining.findById(training._id).populate('participants.memberId', 'name phone');

    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the participant. Please try again.');
  }
};

// ============= EMPLOYMENT SUMMARY =============

export const getEmploymentSummary = async (req: AuthRequest, res: Response) => {
  try {
    const scope = tenantScope(req);

    const [employerCount, openVacancies, trainingCount, registeredJobSeekers, skilledWorkers] =
      await Promise.all([
        Employer.countDocuments({ ...scope, status: 'active' }),
        JobVacancy.countDocuments({ ...scope, status: 'open' }),
        SkillTraining.countDocuments({ ...scope, status: { $in: ['planned', 'ongoing', 'completed'] } }),
        Member.countDocuments({ ...scope, isJobSeeker: true }),
        Member.countDocuments({ ...scope, skills: { $exists: true, $ne: [] } }),
      ]);

    const summary = {
      employersCount: employerCount,
      openVacancies,
      trainingsCount: trainingCount,
      registeredJobSeekers,
      skilledWorkers,
    };

    res.json({ success: true, data: summary });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the employment summary right now. Please try again.');
  }
};
