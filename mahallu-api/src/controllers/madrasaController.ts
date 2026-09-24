import { Response } from 'express';
import mongoose from 'mongoose';
import { MadrasaClass, StudentEnrollment } from '../models/Madrasa';
import Member from '../models/Member';
import Institute from '../models/Institute';
import Employee from '../models/Employee';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { stripImmutable, refBelongsToTenant } from '../utils/sanitizeUpdate';

import { sendFailure } from '../utils/userMessages';
import { regexLiteral } from '../utils/queryGuard';

const tenantScope = (req: AuthRequest): Record<string, any> =>
  req.tenantId ? { tenantId: req.tenantId } : {};

/** Confirm the institute/teacher references on the body belong to this tenant. */
const validateClassRefs = async (req: AuthRequest): Promise<string | null> => {
  const { instituteId, teacherEmployeeId } = req.body;
  if (instituteId && !(await refBelongsToTenant(Institute, instituteId, req.tenantId))) {
    return 'Institute does not belong to this Mahallu';
  }
  if (teacherEmployeeId && !(await refBelongsToTenant(Employee, teacherEmployeeId, req.tenantId))) {
    return 'Teacher does not belong to this Mahallu';
  }
  return null;
};

/** Active student count per class, in one round trip instead of N. */
const countStudents = async (
  classIds: mongoose.Types.ObjectId[]
): Promise<Record<string, number>> => {
  if (classIds.length === 0) return {};
  const rows = await StudentEnrollment.aggregate([
    { $match: { classId: { $in: classIds }, status: 'active' } },
    { $group: { _id: '$classId', count: { $sum: 1 } } },
  ]);
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row._id.toString()] = row.count;
    return acc;
  }, {});
};

export const getAllClasses = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { ...tenantScope(req) };

    if (req.query.academicYear) query.academicYear = req.query.academicYear;
    if (req.query.classType) query.classType = req.query.classType;
    if (req.query.status) query.status = req.query.status;
    if (req.query.instituteId) query.instituteId = req.query.instituteId;
    if (req.query.search) query.name = { $regex: regexLiteral(String(req.query.search)), $options: 'i' };

    const [classes, total] = await Promise.all([
      MadrasaClass.find(query)
        .populate('teacherEmployeeId', 'name nameMl designation')
        .populate('instituteId', 'name')
        .sort({ academicYear: -1, name: 1 })
        .skip(skip)
        .limit(limit),
      MadrasaClass.countDocuments(query),
    ]);

    const counts = await countStudents(classes.map((cls) => cls._id as mongoose.Types.ObjectId));
    const withCounts = classes.map((cls) => ({
      ...cls.toObject(),
      studentCount: counts[(cls._id as mongoose.Types.ObjectId).toString()] ?? 0,
    }));

    res.json(createPaginationResponse(withCounts, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the classes right now. Please try again.');
  }
};

export const getClassById = async (req: AuthRequest, res: Response) => {
  try {
    const cls = await MadrasaClass.findOne({ _id: req.params.id, ...tenantScope(req) })
      .populate('teacherEmployeeId', 'name nameMl designation')
      .populate('instituteId', 'name');

    if (!cls) {
      return res.status(404).json({ success: false, message: "We couldn't find that class. It may have been removed." });
    }

    const counts = await countStudents([cls._id as mongoose.Types.ObjectId]);
    res.json({
      success: true,
      data: {
        ...cls.toObject(),
        studentCount: counts[(cls._id as mongoose.Types.ObjectId).toString()] ?? 0,
      },
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the class right now. Please try again.');
  }
};

export const createClass = async (req: AuthRequest, res: Response) => {
  try {
    const refError = await validateClassRefs(req);
    if (refError) {
      return res.status(400).json({ success: false, message: refError });
    }

    const cls = await MadrasaClass.create({
      ...stripImmutable(req.body),
      tenantId: req.tenantId,
    });
    res.status(201).json({ success: true, data: cls });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the class. Please try again.');
  }
};

export const updateClass = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await MadrasaClass.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!existing) {
      return res.status(404).json({ success: false, message: "We couldn't find that class. It may have been removed." });
    }

    const refError = await validateClassRefs(req);
    if (refError) {
      return res.status(400).json({ success: false, message: refError });
    }

    const cls = await MadrasaClass.findByIdAndUpdate(req.params.id, stripImmutable(req.body), {
      new: true,
      runValidators: true,
    });
    res.json({ success: true, data: cls });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the class. Please try again.');
  }
};

export const deleteClass = async (req: AuthRequest, res: Response) => {
  try {
    const cls = await MadrasaClass.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!cls) {
      return res.status(404).json({ success: false, message: "We couldn't find that class. It may have been removed." });
    }

    const enrolled = await StudentEnrollment.countDocuments({ classId: cls._id });
    if (enrolled > 0) {
      return res.status(400).json({
        success: false,
        message: `This class has ${enrolled} enrolled student(s), so it can't be deleted. Please mark it inactive instead.`,
      });
    }

    await cls.deleteOne();
    res.json({ success: true, message: 'Class deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the class. Please try again.');
  }
};

export const getClassStudents = async (req: AuthRequest, res: Response) => {
  try {
    const cls = await MadrasaClass.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!cls) {
      return res.status(404).json({ success: false, message: "We couldn't find that class. It may have been removed." });
    }

    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { classId: cls._id, ...tenantScope(req) };
    if (req.query.status) query.status = req.query.status;

    const [students, total] = await Promise.all([
      StudentEnrollment.find(query)
        .populate('memberId', 'name nameMl contactNo dateOfBirth gender')
        .sort({ rollNo: 1, createdAt: 1 })
        .skip(skip)
        .limit(limit),
      StudentEnrollment.countDocuments(query),
    ]);

    res.json(createPaginationResponse(students, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the class students right now. Please try again.');
  }
};

export const getAllEnrollments = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { ...tenantScope(req) };
    if (req.query.classId) query.classId = req.query.classId;
    if (req.query.memberId) query.memberId = req.query.memberId;
    if (req.query.status) query.status = req.query.status;

    const [enrollments, total] = await Promise.all([
      StudentEnrollment.find(query)
        .populate('memberId', 'name nameMl contactNo')
        .populate('classId', 'name academicYear classType')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      StudentEnrollment.countDocuments(query),
    ]);

    res.json(createPaginationResponse(enrollments, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the enrollments right now. Please try again.');
  }
};

export const createEnrollment = async (req: AuthRequest, res: Response) => {
  try {
    const { classId, memberId } = req.body;

    if (!(await refBelongsToTenant(MadrasaClass, classId, req.tenantId))) {
      return res
        .status(400)
        .json({ success: false, message: 'This class belongs to another Mahallu.' });
    }
    if (!(await refBelongsToTenant(Member, memberId, req.tenantId))) {
      return res
        .status(400)
        .json({ success: false, message: 'This student belongs to another Mahallu.' });
    }

    const duplicate = await StudentEnrollment.findOne({ classId, memberId });
    if (duplicate) {
      return res
        .status(400)
        .json({ success: false, message: 'This student is already enrolled in this class.' });
    }

    const enrollment = await StudentEnrollment.create({
      ...stripImmutable(req.body),
      tenantId: req.tenantId,
    });
    const populated = await enrollment.populate('memberId', 'name nameMl contactNo');

    // Enrollment is the strongest signal a member is a student - reflect it on the
    // Member register (spec 7 'students' register reads occupationSector), unless
    // the profile already carries an explicit sector.
    await Member.updateOne({ _id: memberId, occupationSector: { $in: [null, undefined, ''] } }, { occupationSector: 'student' });

    res.status(201).json({ success: true, data: populated });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the enrollment. Please try again.');
  }
};

export const updateEnrollment = async (req: AuthRequest, res: Response) => {
  try {
    const existing = await StudentEnrollment.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!existing) {
      return res.status(404).json({ success: false, message: "We couldn't find that enrollment. It may have been removed." });
    }

    // Moving a student between classes is a new enrollment, not an edit.
    const payload = stripImmutable(req.body);
    delete payload.classId;
    delete payload.memberId;

    const enrollment = await StudentEnrollment.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    }).populate('memberId', 'name nameMl contactNo');

    res.json({ success: true, data: enrollment });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the enrollment. Please try again.');
  }
};

export const deleteEnrollment = async (req: AuthRequest, res: Response) => {
  try {
    const enrollment = await StudentEnrollment.findOneAndDelete({
      _id: req.params.id,
      ...tenantScope(req),
    });
    if (!enrollment) {
      return res.status(404).json({ success: false, message: "We couldn't find that enrollment. It may have been removed." });
    }
    res.json({ success: true, message: 'Enrollment removed' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the enrollment. Please try again.');
  }
};

export const getMadrasaSummary = async (req: AuthRequest, res: Response) => {
  try {
    const match: any = {};
    // Aggregation does not cast strings to ObjectId the way find() does.
    if (req.tenantId) match.tenantId = new mongoose.Types.ObjectId(req.tenantId);

    const [classRows, enrollmentRows] = await Promise.all([
      MadrasaClass.aggregate([
        { $match: match },
        { $group: { _id: '$classType', count: { $sum: 1 } } },
      ]),
      StudentEnrollment.aggregate([
        { $match: match },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const tally = (rows: Array<{ _id: string; count: number }>) =>
      rows.reduce<Record<string, number>>((acc, row) => {
        acc[row._id] = row.count;
        return acc;
      }, {});

    const byStatus = tally(enrollmentRows);
    const byType = tally(classRows);

    res.json({
      success: true,
      data: {
        totalClasses: Object.values(byType).reduce((a, b) => a + b, 0),
        activeStudents: byStatus.active ?? 0,
        completedStudents: byStatus.completed ?? 0,
        droppedStudents: byStatus.dropped ?? 0,
        byClassType: byType,
        byEnrollmentStatus: byStatus,
      },
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the madrasa summary right now. Please try again.');
  }
};
