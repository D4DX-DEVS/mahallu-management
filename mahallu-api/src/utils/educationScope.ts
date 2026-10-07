import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/authMiddleware';
import { MadrasaClass } from '../models/Madrasa';
import Institute from '../models/Institute';
import {
  CallerScope,
  MSG,
  isValidId,
  parseIdParam,
  refsInScope,
  sendBadRequest,
  verifyRecordAccess,
} from './scope';

/**
 * Institute scoping shared by the madrasa, attendance and exam controllers.
 *
 * MadrasaClass is the only education record that carries an instituteId. Enrollments, attendance
 * sheets and exams reach their institute through `classId`, so for an institute account every read
 * and write goes through the class:
 *
 *   - lists are limited to the caller's own class ids;
 *   - by-id access first loads the parent class and refuses (403) unless it is the caller's own;
 *   - a body that names a class must name one of the caller's own.
 *
 * The institute is ALWAYS the one on the session (scope.ts), never a query, body or header value.
 * Classes with no instituteId are Mahallu-level: super admin / Mahallu admin keep them, an institute
 * account never sees them.
 */

export const tenantScope = (req: AuthRequest): Record<string, any> =>
  req.tenantId ? { tenantId: req.tenantId } : {};

const CLASS_NOT_FOUND = "We couldn't find that class. It may have been removed.";

/**
 * The class a by-id request points at, or null after answering 404 (not in this Mahallu) / 403 (an
 * institute account asking for a sibling institute's class or a Mahallu-level one).
 */
export const loadScopedClass = async (
  req: AuthRequest,
  res: Response,
  caller: CallerScope,
  classId: unknown,
  opts: { populate?: boolean } = {}
): Promise<any | null> => {
  let query: any = MadrasaClass.findOne({ _id: classId, ...tenantScope(req) });
  if (opts.populate) {
    query = query.populate('teacherEmployeeId', 'name nameMl designation').populate('instituteId', 'name');
  }
  const cls = await query;
  if (!cls) {
    res.status(404).json({ success: false, message: CLASS_NOT_FOUND });
    return null;
  }
  if (caller.isInstitute && !verifyRecordAccess(req, res, cls, 'Class')) return null;
  return cls;
};

/**
 * For a record that belongs to a class (enrollment, attendance sheet, exam): true when the caller
 * may touch it, otherwise 403 has been answered. Only an institute account needs the class lookup;
 * a record whose class is missing is not theirs.
 */
export const classAccessForRecord = async (
  req: AuthRequest,
  res: Response,
  caller: CallerScope,
  classId: unknown,
  name: string
): Promise<boolean> => {
  if (!caller.isInstitute) return true;
  const cls: any = classId
    ? await MadrasaClass.findOne({ _id: classId, ...tenantScope(req) }).select('tenantId instituteId')
    : null;
  return verifyRecordAccess(req, res, cls, name);
};

/**
 * The ids of the classes an institute account owns (an empty list when it owns none), or undefined
 * for every other role, whose class access is the whole Mahallu.
 */
export const ownClassIds = async (
  req: AuthRequest,
  caller: CallerScope
): Promise<mongoose.Types.ObjectId[] | undefined> => {
  if (!caller.isInstitute) return undefined;
  const rows: any[] = await MadrasaClass.find({
    ...tenantScope(req),
    instituteId: caller.instituteId,
  }).select('_id');
  return rows.map((row) => row._id as mongoose.Types.ObjectId);
};

/**
 * Narrow a child-collection query (enrollments / attendance / exams) to the caller's classes.
 * A requested classId can only select one of them; anything else matches nothing.
 */
export const limitToClasses = (
  query: Record<string, any>,
  classIds: mongoose.Types.ObjectId[] | undefined,
  requestedClassId?: string
): void => {
  if (!classIds) {
    if (requestedClassId) query.classId = requestedClassId;
    return;
  }
  if (requestedClassId) {
    query.classId = classIds.some((id) => String(id) === requestedClassId) ? requestedClassId : { $in: [] };
  } else {
    query.classId = { $in: classIds };
  }
};

/** `?classId=` as an optional, well-formed id. Answers 400 and returns null when it is malformed. */
export const classIdFilter = (req: AuthRequest, res: Response): { value?: string } | null => {
  const parsed = parseIdParam(req.query.classId);
  if (!parsed.ok) {
    sendBadRequest(res, MSG.badId);
    return null;
  }
  return { value: parsed.value };
};

/**
 * Body reference to a class: it must exist in the Mahallu and, for an institute account, belong to
 * that institute (a Mahallu-level class does not).
 */
export const classRefInScope = (caller: CallerScope, tenantId: string, classId: unknown): Promise<boolean> =>
  refsInScope(caller, tenantId, [{ model: MadrasaClass, id: classId }]);

export const CLASS_REF_MESSAGE = 'This class belongs to another Mahallu or institute.';

/**
 * Optional `?instituteId=` for a super admin / Mahallu admin: a filter on classes. It must be an id
 * and an institute of the caller's Mahallu. Returns `{}` when absent, `{ instituteId }` when valid,
 * null after answering 400. An institute account never filters: its own institute is fixed.
 */
export const parseInstituteFilter = async (
  req: AuthRequest,
  res: Response,
  caller: CallerScope
): Promise<{ instituteId?: string } | null> => {
  if (caller.isInstitute) return {};
  const raw = (req.query as any)?.instituteId;
  if (raw === undefined || raw === '') return {};
  if (!isValidId(raw)) {
    sendBadRequest(res, MSG.badId);
    return null;
  }
  const institute = await Institute.findOne({ _id: raw, ...tenantScope(req) }).select('_id');
  if (!institute) {
    sendBadRequest(res, MSG.foreignRef);
    return null;
  }
  return { instituteId: raw };
};
