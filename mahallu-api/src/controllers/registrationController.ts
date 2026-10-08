import { Request, Response } from 'express';
import { NikahRegistration, DeathRegistration, NOC } from '../models/Registration';
import Member from '../models/Member';
import Family from '../models/Family';
import DocumentFile from '../models/DocumentFile';
import { GraveRecord } from '../models/Cemetery';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';

import { sendFailure } from '../utils/userMessages';
import { regexLiteral } from '../utils/queryGuard';
import { verifyTenantOwnership } from '../utils/tenantCheck';
import { sanitizeRichText } from '../utils/htmlSanitizer';
import { refBelongsToTenant, stripImmutable } from '../utils/sanitizeUpdate';
import { isValidId, MSG, tenantFilterFor } from '../utils/scope';
import { runAtomic } from '../utils/transaction';
import {
  DUPLICATE_DEATH_MESSAGE,
  OPEN_DEATH_STATUSES,
  applyDeathToMember,
  hasOpenDeathRecord,
  revertDeathOnMember,
} from '../services/deathRecordService';

type RefProblem = { status: number; message: string };
type RefSpec = [model: mongoose.Model<any>, id: unknown, label: string];

/**
 * The Mahallu a new record is written into, from the SERVER-derived identity only.
 * A Mahallu admin always writes into their own; a body `tenantId` is honoured only for a super
 * admin who has not picked one. A non-super user with no Mahallu gets nothing (fails closed).
 */
const writeTenantOf = (req: AuthRequest): string | undefined => {
  const raw = req.isSuperAdmin ? req.tenantId || req.body?.tenantId : req.tenantId;
  const text = typeof raw === 'string' || raw instanceof mongoose.Types.ObjectId ? String(raw) : '';
  return isValidId(text) ? text : undefined;
};

/**
 * Every id a body links to (member, family, registration, grave, documents) must be a well-formed id
 * of a record in the SAME Mahallu. Absent ids pass; a malformed id is a 400, a foreign or unknown id
 * a plain 404 (it does not reveal whether the record exists in another Mahallu).
 */
const findRefProblem = async (tenantId: string, refs: RefSpec[]): Promise<RefProblem | null> => {
  for (const [model, rawId, label] of refs) {
    if (rawId === undefined || rawId === null || rawId === '') continue;
    if (!isValidId(rawId)) return { status: 400, message: MSG.badId };
    if (!(await refBelongsToTenant(model, rawId, tenantId))) {
      return { status: 404, message: `We couldn't find that ${label} in this Mahallu.` };
    }
  }
  return null;
};

const documentRefs = (documents: unknown): RefSpec[] | RefProblem => {
  if (documents === undefined || documents === null) return [];
  if (!Array.isArray(documents) || documents.length > 20) return { status: 400, message: MSG.badId };
  return documents.map((id): RefSpec => [DocumentFile, id, 'document']);
};

/** Validate the optional refs of a write; answers the 400/404 itself and returns false when refused. */
const refsOk = async (res: Response, tenantId: string, refs: RefSpec[], documents?: unknown): Promise<boolean> => {
  const docs = documentRefs(documents);
  const problem = Array.isArray(docs) ? await findRefProblem(tenantId, [...refs, ...docs]) : docs;
  if (problem) {
    res.status(problem.status).json({ success: false, message: problem.message });
    return false;
  }
  return true;
};

const noMahallu = (res: Response) =>
  res.status(400).json({ success: false, message: 'Please select a Mahallu before continuing.' });

// Nikah Registration
export const getAllNikahRegistrations = async (req: AuthRequest, res: Response) => {
  try {
    const { status, search, tenantId } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = {};

    // Tenant filter from the server-derived identity; refuses (403) a non-super user with no Mahallu.
    const scopeFilter = tenantFilterFor(req, res);
    if (!scopeFilter) return;
    Object.assign(query, scopeFilter);

    if (status) query.status = status;
    if (search) {
      query.$or = [
        { groomName: { $regex: regexLiteral(search), $options: 'i' } },
        { brideName: { $regex: regexLiteral(search), $options: 'i' } },
      ];
    }

    const [registrations, total] = await Promise.all([
      NikahRegistration.find(query)
        .populate('groomId', 'name')
        .populate('brideId', 'name')
        .sort({ nikahDate: -1 })
        .skip(skip)
        .limit(limit),
      NikahRegistration.countDocuments(query),
    ]);

    res.json(createPaginationResponse(registrations, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the nikah registrations right now. Please try again.');
  }
};

export const getNikahRegistrationById = async (req: AuthRequest, res: Response) => {
  try {
    const registration = await NikahRegistration.findById(req.params.id)
      .populate('groomId', 'name')
      .populate('brideId', 'name');
    
    if (!registration) {
      return res.status(404).json({ success: false, message: "We couldn't find that nikah registration. It may have been removed." });
    }

    // Check tenant access
    if (!req.isSuperAdmin && registration.tenantId.toString() !== req.tenantId) {
      return res.status(403).json({ success: false, message: "You don't have permission to do this. Please contact your Mahallu admin." });
    }

    res.json({ success: true, data: registration });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the nikah registration right now. Please try again.');
  }
};

export const createNikahRegistration = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = writeTenantOf(req);
    if (!tenantId) return noMahallu(res);

    if (!(await refsOk(res, tenantId, [
      [Member, req.body.groomId, 'groom'],
      [Member, req.body.brideId, 'bride'],
      [Member, req.body.submittedByMemberId, 'member'],
    ], req.body.documents))) return;

    const registration = new NikahRegistration({ ...stripImmutable(req.body), tenantId });
    await registration.save();
    res.status(201).json({ success: true, data: registration });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the nikah registration. Please try again.');
  }
};

export const updateNikahRegistration = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      groomName, groomAge, groomId, brideName, brideAge, brideId,
      mahallMemberType, nikahDate, mahallId, waliName, witness1, witness2,
      mahrAmount, mahrDescription, status, remarks,
    } = req.body;

    const registration = await NikahRegistration.findById(id);
    if (!registration) {
      return res.status(404).json({ success: false, message: "We couldn't find that nikah registration. It may have been removed." });
    }

    // Check tenant access
    if (!req.isSuperAdmin && registration.tenantId.toString() !== req.tenantId) {
      return res.status(403).json({ success: false, message: "You don't have permission to do this. Please contact your Mahallu admin." });
    }

    // The people linked to a registration must belong to the registration's own Mahallu.
    if (!(await refsOk(res, String(registration.tenantId), [
      [Member, groomId, 'groom'],
      [Member, brideId, 'bride'],
    ]))) return;

    const updated = await NikahRegistration.findOneAndUpdate(
      { _id: id, tenantId: registration.tenantId },
      {
        groomName, groomAge, groomId, brideName, brideAge, brideId,
        mahallMemberType, nikahDate, mahallId, waliName, witness1, witness2,
        mahrAmount, mahrDescription, status, remarks,
      },
      { new: true, runValidators: true }
    )
      .populate('groomId', 'name')
      .populate('brideId', 'name');

    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the nikah registration. Please try again.');
  }
};

// Death Registration
export const getAllDeathRegistrations = async (req: AuthRequest, res: Response) => {
  try {
    const { status, search, tenantId } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = {};

    // Tenant filter from the server-derived identity; refuses (403) a non-super user with no Mahallu.
    const scopeFilter = tenantFilterFor(req, res);
    if (!scopeFilter) return;
    Object.assign(query, scopeFilter);

    if (status) query.status = status;
    if (search) {
      query.deceasedName = { $regex: regexLiteral(search), $options: 'i' };
    }

    const [registrations, total] = await Promise.all([
      DeathRegistration.find(query)
        .populate('deceasedId', 'name')
        .populate('familyId', 'houseName')
        .sort({ deathDate: -1 })
        .skip(skip)
        .limit(limit),
      DeathRegistration.countDocuments(query),
    ]);

    res.json(createPaginationResponse(registrations, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the death registrations right now. Please try again.');
  }
};

export const getDeathRegistrationById = async (req: AuthRequest, res: Response) => {
  try {
    const registration = await DeathRegistration.findById(req.params.id)
      .populate('deceasedId', 'name')
      .populate('familyId', 'houseName');
    
    if (!registration) {
      return res.status(404).json({ success: false, message: "We couldn't find that death registration. It may have been removed." });
    }

    // Check tenant access
    if (!req.isSuperAdmin && registration.tenantId.toString() !== req.tenantId) {
      return res.status(403).json({ success: false, message: "You don't have permission to do this. Please contact your Mahallu admin." });
    }

    res.json({ success: true, data: registration });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the death registration right now. Please try again.');
  }
};

export const createDeathRegistration = async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = writeTenantOf(req);
    if (!tenantId) return noMahallu(res);

    // The deceased (and every other linked record) must be a record of THIS Mahallu: an unchecked
    // id here let any admin mark any Mahallu's member as deceased.
    if (!(await refsOk(res, tenantId, [
      [Member, req.body.deceasedId, 'member'],
      [Family, req.body.familyId, 'family'],
      [GraveRecord, req.body.graveRecordId, 'grave record'],
      [Member, req.body.submittedByMemberId, 'member'],
    ], req.body.documents))) return;

    if (await hasOpenDeathRecord(tenantId, req.body.deceasedId)) {
      return res.status(409).json({ success: false, message: DUPLICATE_DEATH_MESSAGE });
    }

    // Always saved as pending: the member is only marked deceased when the record is approved
    // (updateDeathRegistration), never on create.
    const registration = new DeathRegistration({ ...stripImmutable(req.body), tenantId, status: 'pending' });
    await registration.save();
    res.status(201).json({ success: true, data: registration });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the death registration. Please try again.');
  }
};

export const updateDeathRegistration = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      deceasedName, deceasedId, deathDate, placeOfDeath, causeOfDeath,
      mahallId, familyId, informantName, informantRelation, informantPhone,
      status, remarks,
    } = req.body;

    const registration = await DeathRegistration.findById(id);
    if (!registration) {
      return res.status(404).json({ success: false, message: "We couldn't find that death registration. It may have been removed." });
    }

    // Check tenant access
    if (!req.isSuperAdmin && registration.tenantId.toString() !== req.tenantId) {
      return res.status(403).json({ success: false, message: "You don't have permission to do this. Please contact your Mahallu admin." });
    }

    if (!(await refsOk(res, String(registration.tenantId), [
      [Member, deceasedId, 'member'],
      [Family, familyId, 'family'],
    ]))) return;

    const wasApproved = registration.status === 'approved';
    const nextStatus = status ?? registration.status;
    const nextDeceased = deceasedId ?? registration.deceasedId;
    const deceasedChanged = deceasedId !== undefined && String(deceasedId) !== String(registration.deceasedId ?? '');

    // One open death record per member: moving this record onto a member, reopening or approving it
    // must not leave a second one.
    if (
      nextDeceased &&
      (OPEN_DEATH_STATUSES as readonly string[]).includes(nextStatus) &&
      (deceasedChanged || nextStatus !== registration.status) &&
      (await hasOpenDeathRecord(registration.tenantId, nextDeceased, registration._id))
    ) {
      return res.status(409).json({ success: false, message: DUPLICATE_DEATH_MESSAGE });
    }

    // The record and the member change together: approve marks the member deceased, leaving 'approved'
    // (or moving an approved record to another member) reactivates the member this record had marked.
    const updated = await runAtomic(
      async (session, comp) => {
        const saved: any = await DeathRegistration.findOneAndUpdate(
          { _id: id, tenantId: registration.tenantId },
          {
            deceasedName, deceasedId, deathDate, placeOfDeath, causeOfDeath,
            mahallId, familyId, informantName, informantRelation, informantPhone,
            status, remarks,
          },
          { new: true, runValidators: true, session }
        );
        if (!saved) return null;
        comp.push('death registration', () =>
          DeathRegistration.updateOne(
            { _id: id, tenantId: registration.tenantId },
            {
              $set: {
                deceasedName: registration.deceasedName, deceasedId: registration.deceasedId,
                deathDate: registration.deathDate, placeOfDeath: registration.placeOfDeath,
                causeOfDeath: registration.causeOfDeath, mahallId: registration.mahallId,
                familyId: registration.familyId, informantName: registration.informantName,
                informantRelation: registration.informantRelation, informantPhone: registration.informantPhone,
                status: registration.status, remarks: registration.remarks,
              },
            }
          )
        );

        const isApproved = saved.status === 'approved';
        if (wasApproved && (!isApproved || deceasedChanged)) {
          await revertDeathOnMember(registration, session, comp);
        }
        if (isApproved) {
          await applyDeathToMember(saved, session, comp);
        }
        return saved;
      },
      {
        description: 'death registration update',
        reconcile: { entity: 'DeathRegistration', entityId: id, tenantId: registration.tenantId },
      }
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: "We couldn't find that death registration. It may have been removed." });
    }

    updated.$session?.(null); // the transaction's session has ended; populate must not reuse it
    await updated.populate([
      { path: 'deceasedId', select: 'name' },
      { path: 'familyId', select: 'houseName' },
    ]);

    res.json({ success: true, data: updated });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the death registration. Please try again.');
  }
};

// NOC
export const getAllNOCs = async (req: AuthRequest, res: Response) => {
  try {
    const { type, status, search, tenantId } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = {};

    // Tenant filter from the server-derived identity; refuses (403) a non-super user with no Mahallu.
    const scopeFilter = tenantFilterFor(req, res);
    if (!scopeFilter) return;
    Object.assign(query, scopeFilter);

    if (type) query.type = type;
    if (status) query.status = status;
    if (search) {
      query.applicantName = { $regex: regexLiteral(search), $options: 'i' };
    }

    const [nocs, total] = await Promise.all([
      NOC.find(query)
        .populate('applicantId', 'name')
        .populate('nikahRegistrationId')
        .populate('tenantId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      NOC.countDocuments(query),
    ]);

    res.json(createPaginationResponse(nocs, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the no cs right now. Please try again.');
  }
};

export const getNOCById = async (req: AuthRequest, res: Response) => {
  try {
    const noc = await NOC.findById(req.params.id)
      .populate('applicantId', 'name')
      .populate('nikahRegistrationId');
    
    if (!noc) {
      return res.status(404).json({ success: false, message: "We couldn't find that NOC. It may have been removed." });
    }

    // Check tenant access
    if (!req.isSuperAdmin && noc.tenantId.toString() !== req.tenantId) {
      return res.status(403).json({ success: false, message: "You don't have permission to do this. Please contact your Mahallu admin." });
    }

    res.json({ success: true, data: noc });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the NOC right now. Please try again.');
  }
};

export const createNOC = async (req: AuthRequest, res: Response) => {
  try {
    // purposeDescription / purpose are rendered as HTML by the CMS: store only allow-listed markup.
    const purposeTitle = req.body.purposeTitle;
    const purposeDescription = sanitizeRichText(req.body.purposeDescription);
    const purpose = sanitizeRichText(req.body.purpose);
    if (!purposeTitle && !purpose) {
      return res.status(400).json({ success: false, message: 'Please enter the purpose title.' });
    }
    if (!purposeDescription && !purpose) {
      return res.status(400).json({ success: false, message: 'Please enter the purpose description.' });
    }
    const tenantId = writeTenantOf(req);
    if (!tenantId) return noMahallu(res);

    if (!(await refsOk(res, tenantId, [
      [Member, req.body.applicantId, 'applicant'],
      [NikahRegistration, req.body.nikahRegistrationId, 'nikah registration'],
      [Member, req.body.submittedByMemberId, 'member'],
    ], req.body.documents))) return;

    const nocData = {
      ...stripImmutable(req.body),
      tenantId,
      purposeTitle: purposeTitle || purpose,
      purposeDescription: purposeDescription || purpose,
      purpose: purpose || purposeTitle || purposeDescription,
      // Set status to approved for Mahallu admin created NOCs
      status: req.body.status || 'approved',
      // Set issued date to current date if not provided
      issuedDate: req.body.issuedDate || new Date(),
      // Record who approved it
      approvedBy: req.user?.name || undefined,
    };

    const noc = new NOC(nocData);
    await noc.save();
    res.status(201).json({ success: true, data: noc });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the NOC. Please try again.');
  }
};

export const updateNOC = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, issuedDate, expiryDate, remarks, purposeTitle } = req.body;
    const purposeDescription = sanitizeRichText(req.body.purposeDescription);
    const purpose = sanitizeRichText(req.body.purpose);

    const updateData: Record<string, any> = { status, issuedDate, expiryDate, remarks, purposeTitle, purposeDescription, purpose };
    if (status === 'approved') {
      updateData.approvedBy = req.user?.name || undefined;
      if (!issuedDate) updateData.issuedDate = new Date();
    }

    // Only the Mahallu that owns the NOC may change it; by id alone, any admin could approve
    // another Mahallu's NOC under their own name.
    const existing = await NOC.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "We couldn't find that NOC. It may have been removed." });
    }
    if (!verifyTenantOwnership(req, res, existing.tenantId, 'NOC')) return;

    const noc = await NOC.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('applicantId', 'name')
      .populate('nikahRegistrationId');

    if (!noc) {
      return res.status(404).json({ success: false, message: "We couldn't find that NOC. It may have been removed." });
    }

    res.json({ success: true, data: noc });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update the NOC. Please try again.');
  }
};

