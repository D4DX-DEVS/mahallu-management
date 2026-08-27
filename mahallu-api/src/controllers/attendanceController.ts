import { Response } from 'express';
import { ClassAttendance, Exam } from '../models/Attendance';
import { StudentEnrollment, MadrasaClass } from '../models/Madrasa';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { refBelongsToTenant } from '../utils/sanitizeUpdate';

const tenantScope = (req: AuthRequest): Record<string, any> =>
  req.tenantId ? { tenantId: req.tenantId } : {};

const normalizeDate = (date: string | Date): Date => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

/**
 * @swagger
 * /class-attendance:
 *   post:
 *     summary: Create or update class attendance
 *     tags: [Education]
 *     description: |
 *       Upsert attendance for a class on a given date. One document per class per date.
 *       Records array contains presence marking for each enrolled student.
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
 *               date:
 *                 type: string
 *                 format: date
 *               records:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     enrollmentId:
 *                       type: string
 *                     present:
 *                       type: boolean
 *     responses:
 *       200:
 *         description: Attendance record created/updated
 *       400:
 *         description: Invalid input or references
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
export const upsertAttendance = async (req: AuthRequest, res: Response) => {
  try {
    const { classId, date, records } = req.body;

    if (!classId || !date) {
      return res.status(400).json({ success: false, message: 'Class ID and date are required' });
    }

    // Validate classId belongs to tenant
    if (!(await refBelongsToTenant(MadrasaClass, classId, req.tenantId))) {
      return res.status(400).json({ success: false, message: 'Class does not belong to this Mahallu' });
    }

    // Validate all enrollmentIds belong to this class and tenant
    if (records && Array.isArray(records)) {
      for (const record of records) {
        if (record.enrollmentId) {
          const enrollment = await StudentEnrollment.findOne({
            _id: record.enrollmentId,
            classId,
            tenantId: req.tenantId,
          });
          if (!enrollment) {
            return res
              .status(400)
              .json({ success: false, message: `Enrollment ${record.enrollmentId} not found in this class` });
          }
        }
      }
    }

    const normalizedDate = normalizeDate(date);
    const attendance = await ClassAttendance.findOneAndUpdate(
      { tenantId: req.tenantId, classId, date: normalizedDate },
      { tenantId: req.tenantId, classId, date: normalizedDate, records, markedBy: req.user?._id },
      { upsert: true, new: true }
    ).populate('records.enrollmentId', 'rollNo memberId');

    res.json({ success: true, data: attendance });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @swagger
 * /class-attendance:
 *   get:
 *     summary: List class attendance records
 *     tags: [Education]
 *     description: |
 *       List attendance records, filtered by classId and/or month (YYYY-MM).
 *       **Access:** Super Admin, Mahall Admin, Institute
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: classId
 *         schema:
 *           type: string
 *       - in: query
 *         name: month
 *         schema:
 *           type: string
 *           pattern: 'YYYY-MM'
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
 *         description: Paginated attendance records
 */
export const listAttendance = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { ...tenantScope(req) };

    if (req.query.classId) {
      query.classId = req.query.classId;
    }

    if (req.query.month) {
      // month format: YYYY-MM
      const month = String(req.query.month);
      const [year, monthNum] = month.split('-');
      if (year && monthNum) {
        const startDate = new Date(`${year}-${monthNum}-01`);
        startDate.setUTCHours(0, 0, 0, 0);
        const endDate = new Date(startDate);
        endDate.setUTCMonth(endDate.getUTCMonth() + 1);
        query.date = { $gte: startDate, $lt: endDate };
      }
    }

    const [records, total] = await Promise.all([
      ClassAttendance.find(query)
        .populate('classId', 'name')
        .populate('records.enrollmentId', 'rollNo memberId')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit),
      ClassAttendance.countDocuments(query),
    ]);

    res.json(createPaginationResponse(records, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @swagger
 * /class-attendance/{id}:
 *   get:
 *     summary: Get attendance record by ID
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
 *         description: Attendance record
 *       404:
 *         description: Record not found
 */
export const getAttendanceById = async (req: AuthRequest, res: Response) => {
  try {
    const record = await ClassAttendance.findOne({ _id: req.params.id, ...tenantScope(req) })
      .populate('classId', 'name')
      .populate('records.enrollmentId', 'rollNo memberId');

    if (!record) {
      return res.status(404).json({ success: false, message: 'Attendance record not found' });
    }

    res.json({ success: true, data: record });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @swagger
 * /madrasa/classes/{classId}/progress:
 *   get:
 *     summary: Get class progress (attendance % and exam averages per student)
 *     tags: [Education]
 *     description: |
 *       Returns per-student attendance percentage and exam score averages for the class.
 *       **Access:** Super Admin, Mahall Admin, Institute
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Student progress data
 *       404:
 *         description: Class not found
 */
export const getClassProgress = async (req: AuthRequest, res: Response) => {
  try {
    const { id: classId } = req.params;

    // Verify class exists and belongs to tenant
    const cls = await MadrasaClass.findOne({ _id: classId, tenantId: req.tenantId });
    if (!cls) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    // Get all enrollments for the class
    const enrollments = await StudentEnrollment.find({ classId, tenantId: req.tenantId })
      .populate('memberId', 'name');

    if (enrollments.length === 0) {
      return res.json({
        success: true,
        data: {
          classId,
          totalStudents: 0,
          students: [],
        },
      });
    }

    const enrollmentIds = enrollments.map((e) => e._id);

    // Calculate attendance per student
    const attendanceRecords = await ClassAttendance.find({
      classId,
      tenantId: req.tenantId,
    });

    const attendanceByEnrollment: Record<string, { present: number; total: number }> = {};
    enrollmentIds.forEach((id) => {
      attendanceByEnrollment[id.toString()] = { present: 0, total: 0 };
    });

    attendanceRecords.forEach((record) => {
      record.records.forEach((r) => {
        const idStr = r.enrollmentId.toString();
        if (attendanceByEnrollment[idStr]) {
          attendanceByEnrollment[idStr].total += 1;
          if (r.present) {
            attendanceByEnrollment[idStr].present += 1;
          }
        }
      });
    });

    // Calculate exam averages per student
    const exams = await Exam.find({ classId, tenantId: req.tenantId });

    const examsByEnrollment: Record<string, { marks: number[]; count: number }> = {};
    enrollmentIds.forEach((id) => {
      examsByEnrollment[id.toString()] = { marks: [], count: 0 };
    });

    exams.forEach((exam: any) => {
      exam.results.forEach((r: any) => {
        const idStr = r.enrollmentId.toString();
        if (examsByEnrollment[idStr]) {
          examsByEnrollment[idStr].marks.push(r.marks);
          examsByEnrollment[idStr].count += 1;
        }
      });
    });

    // Build response
    const students = enrollments.map((enrollment) => {
      const idStr = enrollment._id.toString();
      const att = attendanceByEnrollment[idStr];
      const exm = examsByEnrollment[idStr];

      const attendancePercent = att.total > 0 ? Math.round((att.present / att.total) * 100) : 0;
      const examAverage =
        exm.marks.length > 0
          ? Math.round((exm.marks.reduce((a, b) => a + b, 0) / exm.marks.length) * 10) / 10
          : null;

      const memberObj = enrollment.memberId && typeof enrollment.memberId === 'object' ? enrollment.memberId : null;
      return {
        enrollmentId: enrollment._id,
        studentName: memberObj ? (memberObj as any).name : '-',
        rollNo: enrollment.rollNo,
        attendance: attendancePercent,
        attendanceCount: `${att.present}/${att.total}`,
        examAverage,
        examCount: exm.count,
      };
    });

    res.json({
      success: true,
      data: {
        classId,
        totalStudents: enrollments.length,
        students: students.sort((a, b) => (a.studentName > b.studentName ? 1 : -1)),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
