import { Response } from 'express';
import { Exam } from '../models/Attendance';
import { MadrasaClass, StudentEnrollment } from '../models/Madrasa';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { stripImmutable, refBelongsToTenant } from '../utils/sanitizeUpdate';

const tenantScope = (req: AuthRequest): Record<string, any> =>
  req.tenantId ? { tenantId: req.tenantId } : {};

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
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { ...tenantScope(req) };

    if (req.query.classId) {
      query.classId = req.query.classId;
    }
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
    res.status(500).json({ success: false, message: error.message });
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
    const exam = await Exam.findOne({ _id: req.params.id, ...tenantScope(req) })
      .populate('classId', 'name')
      .populate('results.enrollmentId', 'rollNo memberId');

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }

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
    res.status(500).json({ success: false, message: error.message });
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
    const { classId, name, examDate, maxMarks } = req.body;

    if (!classId || !name || !examDate || maxMarks === undefined) {
      return res
        .status(400)
        .json({ success: false, message: 'Class ID, name, date, and max marks are required' });
    }

    // Validate classId belongs to tenant
    if (!(await refBelongsToTenant(MadrasaClass, classId, req.tenantId))) {
      return res.status(400).json({ success: false, message: 'Class does not belong to this Mahallu' });
    }

    const exam = new Exam({
      tenantId: req.tenantId,
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
    res.status(500).json({ success: false, message: error.message });
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
    const exam = await Exam.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }

    const updates = stripImmutable(req.body);
    // Don't allow updating results via this endpoint
    delete updates.results;
    Object.assign(exam, updates);
    await exam.save();
    await exam.populate('classId', 'name');

    res.json({ success: true, data: exam });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
    const exam = await Exam.findOneAndDelete({ _id: req.params.id, ...tenantScope(req) });
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }

    res.json({ success: true, message: 'Exam deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
    const { results } = req.body;

    const exam = await Exam.findOne({ _id: req.params.id, ...tenantScope(req) });
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }

    if (!Array.isArray(results)) {
      return res.status(400).json({ success: false, message: 'Results must be an array' });
    }

    // Validate each result
    for (const result of results) {
      const { enrollmentId, marks } = result;

      if (marks > exam.maxMarks) {
        return res
          .status(400)
          .json({ success: false, message: `Marks (${marks}) cannot exceed max marks (${exam.maxMarks})` });
      }

      // Verify enrollment belongs to this class and tenant
      const enrollment = await StudentEnrollment.findOne({
        _id: enrollmentId,
        classId: exam.classId,
        tenantId: req.tenantId,
      });
      if (!enrollment) {
        return res
          .status(400)
          .json({ success: false, message: `Enrollment ${enrollmentId} not found in this class` });
      }
    }

    exam.results = results;
    await exam.save();
    await exam.populate('classId', 'name');
    await exam.populate('results.enrollmentId', 'rollNo');

    res.json({ success: true, data: exam });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
