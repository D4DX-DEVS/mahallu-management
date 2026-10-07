import { Response } from 'express';
import { Exam } from '../models/Attendance';
import { StudentEnrollment } from '../models/Madrasa';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { stripImmutable } from '../utils/sanitizeUpdate';
import { requireScope, requireWriteScope } from '../utils/scope';
import {
  tenantScope,
  classAccessForRecord,
  ownClassIds,
  limitToClasses,
  classIdFilter,
  classRefInScope,
  CLASS_REF_MESSAGE,
} from '../utils/educationScope';

import { sendFailure } from '../utils/userMessages';

/**
 * Institute scoping (utils/educationScope.ts): an exam belongs to its class, so an institute account
 * only reaches exams of its own institute's classes. Exams of Mahallu-level classes (no instituteId)
 * are not visible to it. Super admin / Mahallu admin keep the whole Mahallu.
 */

/**
 * @swagger
 * /exams:
 *   get:
 *     summary: List exams
 *     tags: [Education]
 *     description: |
 *       List exams for a class or all classes.
 *       **Access:** Super Admin, Mahall Admin, Institute
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: classId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [scheduled, completed, cancelled]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Paginated exams
 */
export const listExams = async (req: AuthRequest, res: Response) => {
  try {
    const caller = requireScope(req, res);
    if (!caller) return;
    const classFilter = classIdFilter(req, res);
    if (!classFilter) return;

    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { ...tenantScope(req) };

    // An institute account only sees exams of its own classes; ?classId= can only pick one of them.
    limitToClasses(query, await ownClassIds(req, caller), classFilter.value);
    if (req.query.status) {
      query.status = req.query.status;
    }

    const [exams, total] = await Promise.all([
      Exam.find(query)
        .populate('classId', 'name')
        .sort({ examDate: -1 })
        .skip(skip)
        .limit(limit),
      Exam.countDocuments(query),
    ]);

    res.json(createPaginationResponse(exams, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the exams right now. Please try again.');
  }
};

/**
 * @swagger
 * /exams/{id}:
 *   get:
 *     summary: Get exam by ID
 *     tags: [Education]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Exam record with results
 *       404:
 *         description: Exam not found
 */
export const getExamById = async (req: AuthRequest, res: Response) => {
  try {
    const caller = requireScope(req, res);
    if (!caller) return;
    const exam = await Exam.findOne({ _id: req.params.id, ...tenantScope(req) })
      .populate('classId', 'name')
      .populate('results.enrollmentId', 'rollNo memberId');

    if (!exam) {
      return res.status(404).json({ success: false, message: "We couldn't find that exam. It may have been removed." });
    }
    // classId is populated here; classAccessForRecord needs the id of the parent class.
    const parentClassId = (exam.classId as any)?._id ?? exam.classId;
    if (!(await classAccessForRecord(req, res, caller, parentClassId, 'Exam'))) return;

    // Populate student details
    const enrollmentIds = exam.results.map((r) => r.enrollmentId);
    const enrollments = await StudentEnrollment.find({ _id: { $in: enrollmentIds } }).populate(
      'memberId',
      'name'
    );
    const enrollmentMap = new Map(enrollments.map((e) => [e._id.toString(), e]));

    const resultsWithDetails = exam.results.map((r: any) => {
      const enrollment = enrollmentMap.get(r.enrollmentId.toString());
      const memberObj = enrollment?.memberId && typeof enrollment.memberId === 'object' ? enrollment.memberId : null;
      return {
        enrollmentId: r.enrollmentId,
        marks: r.marks,
        grade: r.grade,
        studentName: memberObj ? (memberObj as any).name : '-',
        rollNo: enrollment?.rollNo,
      };
    });

    const examObj = exam.toObject();
    examObj.results = resultsWithDetails as any;

    res.json({ success: true, data: examObj });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the exam right now. Please try again.');
  }
};

/**
 * @swagger
 * /exams:
 *   post:
 *     summary: Create an exam
 *     tags: [Education]
 *     description: |
 *       Create a new exam for a class.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               classId:
 *                 type: string
 *               name:
 *                 type: string
 *               examDate:
 *                 type: string
 *                 format: date
 *               maxMarks:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [scheduled, completed, cancelled]
 *     responses:
 *       201:
 *         description: Exam created
 *       400:
 *         description: Invalid input or references
 */
export const createExam = async (req: AuthRequest, res: Response) => {
  try {
    const caller = requireWriteScope(req, res);
    if (!caller) return;
    const { classId, name, examDate, maxMarks } = req.body;

    if (!classId || !name || !examDate || maxMarks === undefined) {
      return res
        .status(400)
        .json({ success: false, message: 'Please enter the class, name, date and maximum marks.' });
    }

    // The class must be in this Mahallu and, for an institute account, one of that institute's own.
    if (!(await classRefInScope(caller, caller.tenantId, classId))) {
      return res.status(400).json({ success: false, message: CLASS_REF_MESSAGE });
    }

    const exam = new Exam({
      tenantId: caller.tenantId,
      classId,
      name,
      examDate,
      maxMarks,
      status: req.body.status || 'scheduled',
      results: [],
    });

    await exam.save();
    await exam.populate('classId', 'name');

    res.status(201).json({ success: true, data: exam });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the exam. Please try again.');
  }
};

/**
 * @swagger
 * /exams/{id}:
 *   put:
 *     summary: Update an exam
 *     tags: [Education]
 *     description: |
 *       Update exam details (name, date, maxMarks, status).
 *       Does NOT update results — use /results endpoint instead.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Exam updated
 *       404:
 *         description: Exam not found
 */
export const updateExam = async (req: AuthRequest, res: Response) => {
  try {
    const caller = requireScope(req, res);
    if (!caller) return;
    const exam = await Exam.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!exam) {
      return res.status(404).json({ success: false, message: "We couldn't find that exam. It may have been removed." });
    }
    if (!(await classAccessForRecord(req, res, caller, exam.classId, 'Exam'))) return;

    const updates = stripImmutable(req.body);
    // Don't allow updating results via this endpoint
    delete updates.results;
    // Moving the exam to another class is allowed only to a class the caller could have created it in.
    if (updates.classId !== undefined && String(updates.classId) !== String(exam.classId)) {
      if (!(await classRefInScope(caller, String(exam.tenantId), updates.classId))) {
        return res.status(400).json({ success: false, message: CLASS_REF_MESSAGE });
      }
    }
    Object.assign(exam, updates);
    await exam.save();
    await exam.populate('classId', 'name');

    res.json({ success: true, data: exam });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the exam. Please try again.');
  }
};

/**
 * @swagger
 * /exams/{id}:
 *   delete:
 *     summary: Delete an exam
 *     tags: [Education]
 *     description: |
 *       Delete an exam record.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Exam deleted
 *       404:
 *         description: Exam not found
 */
export const deleteExam = async (req: AuthRequest, res: Response) => {
  try {
    const caller = requireScope(req, res);
    if (!caller) return;
    const found = await Exam.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!found) {
      return res.status(404).json({ success: false, message: "We couldn't find that exam. It may have been removed." });
    }
    if (!(await classAccessForRecord(req, res, caller, found.classId, 'Exam'))) return;

    const exam = await Exam.findOneAndDelete({ _id: req.params.id, ...tenantScope(req) });
    if (!exam) {
      return res.status(404).json({ success: false, message: "We couldn't find that exam. It may have been removed." });
    }

    res.json({ success: true, message: 'Exam deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete the exam. Please try again.');
  }
};

/**
 * @swagger
 * /exams/{id}/results:
 *   put:
 *     summary: Update exam results
 *     tags: [Education]
 *     description: |
 *       Update the results array for an exam. Replaces entire results array.
 *       Validates marks ≤ maxMarks and enrollments belong to the class.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               results:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     enrollmentId:
 *                       type: string
 *                     marks:
 *                       type: number
 *                     grade:
 *                       type: string
 *     responses:
 *       200:
 *         description: Results updated
 *       400:
 *         description: Invalid marks or references
 *       404:
 *         description: Exam not found
 */
export const updateExamResults = async (req: AuthRequest, res: Response) => {
  try {
    const caller = requireScope(req, res);
    if (!caller) return;
    const { results } = req.body;

    const exam = await Exam.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!exam) {
      return res.status(404).json({ success: false, message: "We couldn't find that exam. It may have been removed." });
    }
    if (!(await classAccessForRecord(req, res, caller, exam.classId, 'Exam'))) return;

    if (!Array.isArray(results)) {
      return res.status(400).json({ success: false, message: 'Please add at least one result.' });
    }

    // Validate each result
    for (const result of results) {
      const { enrollmentId, marks } = result;

      if (marks > exam.maxMarks) {
        return res
          .status(400)
          .json({ success: false, message: `Marks can't be more than the maximum of ${exam.maxMarks}.` });
      }

      // Verify enrollment belongs to this class and tenant
      const enrollment = await StudentEnrollment.findOne({
        _id: enrollmentId,
        classId: exam.classId,
        tenantId: exam.tenantId,
      });
      if (!enrollment) {
        return res
          .status(400)
          .json({ success: false, message: "We couldn't find that student's enrolment in this class." });
      }
    }

    exam.results = results;
    await exam.save();
    await exam.populate('classId', 'name');
    await exam.populate('results.enrollmentId', 'rollNo');

    res.json({ success: true, data: exam });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the exam results. Please try again.');
  }
};
