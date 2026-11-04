import { Response } from 'express';
import Member from '../models/Member';
import Family from '../models/Family';
import { Varisangya, Zakat, Wallet, Transaction, RECEIVED_PAYMENT_STATUS, isReceivedPayment } from '../models/Collectible';
import { NikahRegistration, DeathRegistration, NOC } from '../models/Registration';
import Notification, { notificationForViewer } from '../models/Notification';
import Institute from '../models/Institute';
import { Banner, Feed } from '../models/Social';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import User from '../models/User';
import DocumentFile from '../models/DocumentFile';

import { sendFailure } from '../utils/userMessages';
import { parseAmountInRange } from '../utils/money';
import { isDuplicateKeyError } from '../utils/idCounter';
import { findOrCreateWallet, findWallet } from '../services/walletService';
import { sanitizeRichText } from '../utils/htmlSanitizer';
import { activeBannerFilter } from '../utils/bannerWindow';
import Certificate from '../models/Certificate';
import { getSignedDownloadUrl } from '../services/uploadService';
import { DUPLICATE_DEATH_MESSAGE, hasOpenDeathRecord } from '../services/deathRecordService';

/**
 * Validates that the given document ids were uploaded by this member,
 * links them to the registration, and returns the valid ids.
 */
// Per-type required document checklist (spec B4) — configurable later if a tenant needs it
const REQUIRED_DOCS: Record<'nikah' | 'death', string[]> = {
  nikah: ['id_proof', 'age_proof', 'photo'],
  death: ['id_proof', 'death_proof'],
};

/** Returns the required documentTypes missing from the member's submitted document ids. */
const findMissingRequiredDocs = async (
  docIds: unknown,
  member: { _id: unknown; tenantId: unknown },
  type: 'nikah' | 'death'
): Promise<string[]> => {
  const ids = Array.isArray(docIds) ? docIds : [];
  const docs = ids.length
    ? await DocumentFile.find({
        _id: { $in: ids },
        tenantId: member.tenantId,
        uploadedByMemberId: member._id,
      }).select('documentType')
    : [];
  return REQUIRED_DOCS[type].filter((t) => !docs.some((d) => d.documentType === t));
};

const attachOwnDocuments = async (
  docIds: unknown,
  member: { _id: unknown; tenantId: unknown },
  ownerType: 'nikah' | 'death' | 'noc',
  ownerId: unknown
): Promise<unknown[]> => {
  if (!Array.isArray(docIds) || docIds.length === 0) return [];
  const docs = await DocumentFile.find({
    _id: { $in: docIds },
    tenantId: member.tenantId,
    uploadedByMemberId: member._id,
  }).select('_id');
  const validIds = docs.map((d) => d._id);
  if (validIds.length > 0) {
    await DocumentFile.updateMany({ _id: { $in: validIds } }, { ownerType, ownerId });
  }
  return validIds;
};

/**
 * Fields a member may set when submitting a nikah or death registration (the same
 * per-type list a resubmit may edit). The submit handlers build the saved document from
 * these only: workflow, tenant, ownership and linkage fields (status, tenantId,
 * submittedByMemberId, mahallId, remarks, documents, graveRecordId, the other side's
 * groomId/brideId, approvedBy ...) are always set by the server and never read from the body.
 */
const NIKAH_SUBMIT_FIELDS = [
  'groomName', 'groomNameMl', 'groomAge', 'brideName', 'brideNameMl', 'brideAge',
  'nikahDate', 'venue', 'waliName', 'witness1', 'witness2', 'mahrAmount', 'mahrDescription',
] as const;
const DEATH_SUBMIT_FIELDS = [
  'deathDate', 'placeOfDeath', 'causeOfDeath', 'informantName', 'informantRelation', 'informantPhone',
] as const;

const pickSubmittedFields = (body: unknown, fields: readonly string[]): Record<string, unknown> => {
  const source = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const picked: Record<string, unknown> = {};
  for (const key of fields) {
    if (source[key] !== undefined) picked[key] = source[key];
  }
  return picked;
};

// Get own profile
export const getOwnProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.memberId) {
      return res.status(404).json({
        success: false,
        message: "Your profile isn't linked to a member record yet. Please contact your Mahallu admin.",
      });
    }

    const member = await Member.findById(req.user.memberId)
      .populate('familyId', 'houseName mahallId contactNo address');

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "We couldn't find that member. It may have been removed.",
      });
    }

    res.json({ success: true, data: member });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load your profile right now. Please try again.');
  }
};

// Get member overview (own details + family + mahallu stats + varusankhya + assigned options)
export const getOwnOverview = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.memberId) {
      return res.status(404).json({
        success: false,
        message: "Your profile isn't linked to a member record yet. Please contact your Mahallu admin.",
      });
    }

    const member = await Member.findById(req.user.memberId)
      .populate('familyId', 'houseName mahallId contactNo address varisangyaGrade wardNumber houseNo area place status');

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "We couldn't find that member. It may have been removed.",
      });
    }

    const familyDetails = member.familyId && typeof member.familyId === 'object' && 'houseName' in member.familyId
      ? (member.familyId as any)
      : null;

    const familyId = member.familyId && typeof member.familyId === 'object' ? member.familyId._id : member.familyId;

    const [familyMembers, tenantUsersTotal, tenantFamiliesTotal, tenantMembersTotal, varisangyaTotals, zakatTotals, latestVarisangya, latestZakat] = await Promise.all([
      familyId
        ? Member.find({
            familyId,
            tenantId: member.tenantId,
            status: 'active',
          })
            .sort({ createdAt: -1 })
            .select('name phone age gender mahallId familyName status createdAt')
        : Promise.resolve([]),
      User.countDocuments({ tenantId: member.tenantId }),
      Family.countDocuments({ tenantId: member.tenantId }),
      Member.countDocuments({ tenantId: member.tenantId }),
      Varisangya.aggregate([
        {
          $match: {
            tenantId: member.tenantId,
            status: RECEIVED_PAYMENT_STATUS,
            ...(familyId ? { familyId } : { memberId: member._id }),
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            paymentCount: { $sum: 1 },
          },
        },
      ]),
      Zakat.aggregate([
        {
          $match: {
            tenantId: member.tenantId,
            payerId: member._id,
            status: RECEIVED_PAYMENT_STATUS,
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            paymentCount: { $sum: 1 },
          },
        },
      ]),
      Varisangya.findOne({
        tenantId: member.tenantId,
        $or: [
          { memberId: member._id },
          ...(familyId ? [{ familyId }] : []),
        ],
      })
        .sort({ paymentDate: -1, createdAt: -1 })
        .select('receiptNo paymentDate amount'),
      Zakat.findOne({
        tenantId: member.tenantId,
        payerId: member._id,
      })
        .sort({ paymentDate: -1, createdAt: -1 })
        .select('receiptNo paymentDate amount'),
    ]);

    const varisangyaSummary = varisangyaTotals[0] || { totalAmount: 0, paymentCount: 0 };
    const zakatSummary = zakatTotals[0] || { totalAmount: 0, paymentCount: 0 };

    const data = {
      member,
      isFamilyHead: member.isFamilyHead === true,
      family: {
        details: familyDetails,
        members: familyMembers,
        financialSummary: {
          varisangyaTotal: varisangyaSummary.totalAmount,
          varisangyaCount: varisangyaSummary.paymentCount,
          zakatTotal: zakatSummary.totalAmount,
          zakatCount: zakatSummary.paymentCount,
        },
      },
      mahalluStatistics: {
        users: tenantUsersTotal,
        families: tenantFamiliesTotal,
        members: tenantMembersTotal,
      },
      varusankhyaDetails: {
        familyMahallId: familyDetails?.mahallId || null,
        memberMahallId: member.mahallId || null,
        varisangyaGrade: familyDetails?.varisangyaGrade || null,
        latestVarisangyaReceiptNo: latestVarisangya?.receiptNo || null,
        latestZakatReceiptNo: latestZakat?.receiptNo || null,
        latestVarisangyaPaymentDate: latestVarisangya?.paymentDate || null,
        latestZakatPaymentDate: latestZakat?.paymentDate || null,
      },
      assignedOptions: {
        view: req.user.permissions?.view ?? false,
        add: req.user.permissions?.add ?? false,
        edit: req.user.permissions?.edit ?? false,
        delete: req.user.permissions?.delete ?? false,
      },
    };

    res.json({ success: true, data });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load your overview right now. Please try again.');
  }
};

// Update own profile (limited fields)
export const updateOwnProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.memberId) {
      return res.status(404).json({
        success: false,
        message: "Your profile isn't linked to a member record yet. Please contact your Mahallu admin.",
      });
    }

    // Only allow updating specific fields. The phone number is deliberately NOT one of them: it is
    // the key to the member's login and account switching, so changing it requires the OTP-verified
    // change-request flow (POST /api/change-requests), never a plain profile edit.
    const allowedFields = ['email'];
    const updateData: any = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    const member = await Member.findByIdAndUpdate(
      req.user.memberId,
      updateData,
      { new: true, runValidators: true }
    ).populate('familyId', 'houseName mahallId');

    if (!member) {
      return res.status(404).json({
        success: false,
        message: "We couldn't find that member. It may have been removed.",
      });
    }

    res.json({ success: true, data: member });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t update your profile. Please try again.');
  }
};

// Get own payment history
export const getOwnPayments = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.memberId) {
      return res.status(404).json({
        success: false,
        message: "Your profile isn't linked to a member record yet. Please contact your Mahallu admin.",
      });
    }

    const { type } = req.query;
    const { page, limit, skip } = getPaginationParams(req);

    const member = await Member.findById(req.user.memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: "We couldn't find that member. It may have been removed.",
      });
    }

    const wantVarisangya = !type || type === 'varisangya';
    const wantZakat = !type || type === 'zakat';
    const varisangyaFilter = { tenantId: member.tenantId, memberId: member._id };
    const zakatFilter = { tenantId: member.tenantId, payerId: member._id };

    // Two collections are merged into one date-ordered list. Applying skip/limit to each collection
    // separately (as before) returned up to 2x the page size and made later pages skip or repeat rows.
    // Instead each source is read up to the END of the requested page, merged, and the page is sliced
    // from the merged list, so page N really is the N-th slice of the combined history.
    const upTo = skip + limit;
    const [varisangyas, varisangyaTotal, zakats, zakatTotal] = await Promise.all([
      wantVarisangya
        ? Varisangya.find(varisangyaFilter).populate('familyId', 'houseName').sort({ paymentDate: -1, _id: -1 }).limit(upTo)
        : Promise.resolve([] as any[]),
      wantVarisangya ? Varisangya.countDocuments(varisangyaFilter) : Promise.resolve(0),
      wantZakat ? Zakat.find(zakatFilter).sort({ paymentDate: -1, _id: -1 }).limit(upTo) : Promise.resolve([] as any[]),
      wantZakat ? Zakat.countDocuments(zakatFilter) : Promise.resolve(0),
    ]);

    const when = (p: any) => new Date(p.paymentDate || p.createdAt).getTime();
    const merged = [
      ...varisangyas.map((v: any) => ({ ...v.toObject(), type: 'varisangya' })),
      ...zakats.map((z: any) => ({ ...z.toObject(), type: 'zakat' })),
    ].sort((a, b) => when(b) - when(a) || String(b._id).localeCompare(String(a._id)));

    // Each row carries its own `status` ('pending' until an admin verifies it), so the app can tell
    // submitted payments from received ones.
    res.json(createPaginationResponse(merged.slice(skip, upTo), varisangyaTotal + zakatTotal, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load your payments right now. Please try again.');
  }
};

// Get own varisangya list (member-level + family-level, with optional year filter)
export const getOwnVarisangya = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.memberId) {
      return res.status(404).json({
        success: false,
        message: "Your profile isn't linked to a member record yet. Please contact your Mahallu admin.",
      });
    }

    const member = await Member.findById(req.user.memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: "We couldn't find that member. It may have been removed.",
      });
    }

    const { year } = req.query;
    let dateFilter: any = {};
    if (year) {
      const y = Number(year);
      dateFilter = {
        paymentDate: {
          $gte: new Date(`${y}-01-01T00:00:00.000Z`),
          $lte: new Date(`${y}-12-31T23:59:59.999Z`),
        },
      };
    }

    const baseQuery = { tenantId: member.tenantId, ...dateFilter };

    const [memberVarisangya, familyVarisangya] = await Promise.all([
      Varisangya.find({ ...baseQuery, memberId: member._id })
        .sort({ paymentDate: -1 })
        .lean(),
      member.familyId
        ? Varisangya.find({ ...baseQuery, familyId: member.familyId })
            .sort({ paymentDate: -1 })
            .lean()
        : Promise.resolve([]),
    ]);

    // Only a verified payment is 'paid' and counts towards the totals; a submission still waiting for
    // an admin is 'pending' and is reported separately, a rejected one counts nowhere.
    // (No status = an older, received payment.)
    const isPending = (v: any) => v.status === 'pending';
    const received = (rows: any[]) => rows.filter(isReceivedPayment);
    const sum = (rows: any[]) => rows.reduce((total: number, v: any) => total + (v.amount || 0), 0);
    const memberReceived = received(memberVarisangya);
    const familyReceived = received(familyVarisangya);
    const memberPending = memberVarisangya.filter(isPending);
    const familyPending = familyVarisangya.filter(isPending);
    const label = (v: any) => ({ ...v, status: isReceivedPayment(v) ? 'paid' : v.status });

    res.json({
      success: true,
      data: {
        memberVarisangya: memberVarisangya.map(label),
        familyVarisangya: familyVarisangya.map(label),
        summary: {
          memberTotal: sum(memberReceived),
          memberCount: memberReceived.length,
          familyTotal: sum(familyReceived),
          familyCount: familyReceived.length,
          memberPendingTotal: sum(memberPending),
          memberPendingCount: memberPending.length,
          familyPendingTotal: sum(familyPending),
          familyPendingCount: familyPending.length,
        },
      },
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load your varisangya right now. Please try again.');
  }
};

// Get own wallet balance
export const getOwnWallet = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.memberId) {
      return res.status(404).json({
        success: false,
        message: "Your profile isn't linked to a member record yet. Please contact your Mahallu admin.",
      });
    }

    const member = await Member.findById(req.user.memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: "We couldn't find that member. It may have been removed.",
      });
    }

    // The same wallet an admin verification credits (member wallet, one atomic find-or-create), so the
    // member can never be shown a different, empty duplicate.
    const wallet = await findOrCreateWallet({ tenantId: member.tenantId, memberId: member._id });

    res.json({ success: true, data: wallet });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load your wallet right now. Please try again.');
  }
};

// Get own wallet transactions
export const getOwnWalletTransactions = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.memberId) {
      return res.status(404).json({
        success: false,
        message: "Your profile isn't linked to a member record yet. Please contact your Mahallu admin.",
      });
    }

    const member = await Member.findById(req.user.memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: "We couldn't find that member. It may have been removed.",
      });
    }

    const { page, limit, skip } = getPaginationParams(req);

    // Same wallet as getOwnWallet / admin verification. A read does not need to create one: with no
    // wallet there are simply no transactions.
    const wallet = await findWallet({ tenantId: member.tenantId, memberId: member._id });
    if (!wallet) {
      return res.json(createPaginationResponse([], 0, page, limit));
    }

    const [transactions, total] = await Promise.all([
      Transaction.find({ walletId: wallet._id })
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit),
      Transaction.countDocuments({ walletId: wallet._id }),
    ]);

    res.json(createPaginationResponse(transactions, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load your wallet transactions right now. Please try again.');
  }
};

const MEMBER_CLIENT_REQUEST_ID = /^[A-Za-z0-9_\-:.]{8,64}$/;

/**
 * The fields a member may put on a payment submission. Everything else (status, source, receiptNo,
 * tenant, verifier, ids) is set by the server, so a member cannot submit a payment as verified or choose
 * its receipt number.
 */
function parseMemberPayment(body: any): { data: Record<string, any> } | { error: string } {
  const src = body && typeof body === 'object' ? body : {};
  const amount = parseAmountInRange(src.amount, 0.01);
  if (amount === null) return { error: 'Please enter an amount greater than zero (at most two decimal places).' };
  const paymentDate = typeof src.paymentDate === 'string' ? new Date(src.paymentDate) : null;
  if (!paymentDate || Number.isNaN(paymentDate.getTime())) return { error: 'Please choose a valid payment date.' };
  const data: Record<string, any> = { amount, paymentDate };
  for (const field of ['paymentMethod', 'remarks', 'remarksMl'] as const) {
    if (typeof src[field] === 'string') data[field] = src[field].trim().slice(0, field === 'paymentMethod' ? 100 : 2000);
  }
  if (src.clientRequestId !== undefined && src.clientRequestId !== null && src.clientRequestId !== '') {
    if (typeof src.clientRequestId !== 'string' || !MEMBER_CLIENT_REQUEST_ID.test(src.clientRequestId)) {
      return { error: 'The request id must be 8 to 64 letters, numbers, dashes or underscores.' };
    }
    data.clientRequestId = src.clientRequestId;
  }
  return { data };
}

// Request Varisangya payment (creates pending payment request)
export const requestVarisangyaPayment = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.memberId) {
      return res.status(404).json({
        success: false,
        message: "Your profile isn't linked to a member record yet. Please contact your Mahallu admin.",
      });
    }

    const member = await Member.findById(req.user.memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: "We couldn't find that member. It may have been removed.",
      });
    }

    const parsed = parseMemberPayment(req.body);
    if ('error' in parsed) return res.status(400).json({ success: false, message: parsed.error });

    const varisangyaData: Record<string, any> = {
      ...parsed.data,
      tenantId: member.tenantId,
      memberId: member._id,
      familyId: member.familyId,
      status: 'pending', // no wallet, ledger or receipt number until an admin verifies it
      source: 'member',
    };

    // The same clientRequestId again (a double tap, a retry after a timeout) returns the first submission.
    const existingFor = async () =>
      varisangyaData.clientRequestId
        ? Varisangya.findOne({ tenantId: member.tenantId, clientRequestId: varisangyaData.clientRequestId })
        : null;
    const replay = async (existing: any) => {
      if (String(existing.memberId) !== String(member._id)) {
        return res.status(409).json({ success: false, message: 'That request id was already used. Please try again.' });
      }
      return res.status(200).json({
        success: true,
        data: existing,
        idempotent: true,
        message: 'Varisangya payment request submitted',
      });
    };
    const earlier = await existingFor();
    if (earlier) return await replay(earlier);

    const varisangya = new Varisangya(varisangyaData);
    try {
      await varisangya.save();
    } catch (err) {
      if (varisangyaData.clientRequestId && isDuplicateKeyError(err, 'clientRequestId')) {
        const winner = await existingFor();
        if (winner) return await replay(winner);
      }
      throw err;
    }

    res.status(201).json({
      success: true,
      data: varisangya,
      message: 'Varisangya payment request submitted',
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the varisangya payment. Please try again.');
  }
};

// Request Zakat payment
export const requestZakatPayment = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.memberId) {
      return res.status(404).json({
        success: false,
        message: "Your profile isn't linked to a member record yet. Please contact your Mahallu admin.",
      });
    }

    const member = await Member.findById(req.user.memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: "We couldn't find that member. It may have been removed.",
      });
    }

    const parsed = parseMemberPayment(req.body);
    if ('error' in parsed) return res.status(400).json({ success: false, message: parsed.error });
    if (typeof req.body?.category === 'string') parsed.data.category = req.body.category.trim().slice(0, 100);

    const zakatData: Record<string, any> = {
      ...parsed.data,
      tenantId: member.tenantId,
      payerId: member._id,
      payerName: member.name,
      status: 'pending', // no ledger entry or receipt number until an admin verifies it
      source: 'member',
    };

    const existingFor = async () =>
      zakatData.clientRequestId
        ? Zakat.findOne({ tenantId: member.tenantId, clientRequestId: zakatData.clientRequestId })
        : null;
    const replay = async (existing: any) => {
      if (String(existing.payerId) !== String(member._id)) {
        return res.status(409).json({ success: false, message: 'That request id was already used. Please try again.' });
      }
      return res.status(200).json({
        success: true,
        data: existing,
        idempotent: true,
        message: 'Zakat payment request submitted',
      });
    };
    const earlier = await existingFor();
    if (earlier) return await replay(earlier);

    const zakat = new Zakat(zakatData);
    try {
      await zakat.save();
    } catch (err) {
      if (zakatData.clientRequestId && isDuplicateKeyError(err, 'clientRequestId')) {
        const winner = await existingFor();
        if (winner) return await replay(winner);
      }
      throw err;
    }

    res.status(201).json({
      success: true,
      data: zakat,
      message: 'Zakat payment request submitted',
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the zakat payment. Please try again.');
  }
};

/**
 * Which registrations are a member's own. The ONE definition: GET /member-user/registrations lists
 * them and the member certificate endpoints derive certificate ownership from them, so the two
 * screens can never disagree about what belongs to a member.
 */
const ownRegistrationQueries = (member: { _id: unknown; tenantId: unknown }) => ({
  nikah: {
    tenantId: member.tenantId,
    $or: [
      { groomId: member._id },
      { brideId: member._id },
      { submittedByMemberId: member._id },
    ],
  },
  death: {
    tenantId: member.tenantId,
    $or: [
      { deceasedId: member._id },
      { submittedByMemberId: member._id },
    ],
  },
  noc: {
    tenantId: member.tenantId,
    $or: [
      { applicantId: member._id },
      { submittedByMemberId: member._id },
    ],
  },
});

// Get own registrations
export const getOwnRegistrations = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.memberId) {
      return res.status(404).json({
        success: false,
        message: "Your profile isn't linked to a member record yet. Please contact your Mahallu admin.",
      });
    }

    const member = await Member.findById(req.user.memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: "We couldn't find that member. It may have been removed.",
      });
    }

    const { type } = req.query;
    const { page, limit, skip } = getPaginationParams(req);

    const registrations: any = {};

    if (!type || type === 'nikah') {
      const nikahQuery = ownRegistrationQueries(member).nikah;
      const nikahRegs = await NikahRegistration.find(nikahQuery)
        .populate('documents', 'fileName documentType status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit) || 10);

      if (type === 'nikah') {
        const total = await NikahRegistration.countDocuments(nikahQuery);
        return res.json(createPaginationResponse(nikahRegs, total, page, limit));
      }
      registrations.nikah = nikahRegs;
    }

    if (!type || type === 'death') {
      const deathQuery = ownRegistrationQueries(member).death;
      const deathRegs = await DeathRegistration.find(deathQuery)
        .populate('documents', 'fileName documentType status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit) || 10);

      if (type === 'death') {
        const total = await DeathRegistration.countDocuments(deathQuery);
        return res.json(createPaginationResponse(deathRegs, total, page, limit));
      }
      registrations.death = deathRegs;
    }

    if (!type || type === 'noc') {
      const nocQuery = ownRegistrationQueries(member).noc;
      const nocs = await NOC.find(nocQuery)
        .populate({
          path: 'nikahRegistrationId',
          populate: { path: 'documents', select: 'fileName documentType status' },
        })
        .populate('tenantId', 'name')
        .populate('documents', 'fileName documentType status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit) || 10);

      // Backfill approvedBy for older approved NOCs that were saved before the field existed
      const nocObjects = nocs.map(n => n.toObject()) as any[];
      const needsApprover = nocObjects.some(n => n.status === 'approved' && !n.approvedBy);
      if (needsApprover) {
        const adminUser = await User.findOne({ tenantId: member.tenantId, role: 'mahall' }).select('name');
        if (adminUser?.name) {
          nocObjects.forEach(n => {
            if (n.status === 'approved' && !n.approvedBy) {
              n.approvedBy = adminUser.name;
            }
          });
        }
      }

      if (type === 'noc') {
        const total = await NOC.countDocuments(nocQuery);
        return res.json(createPaginationResponse(nocObjects, total, page, limit));
      }
      registrations.noc = nocObjects;
    }

    res.json({ success: true, data: registrations });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load your registrations right now. Please try again.');
  }
};

// Request Nikah registration
export const requestNikahRegistration = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.memberId) {
      return res.status(404).json({
        success: false,
        message: "Your profile isn't linked to a member record yet. Please contact your Mahallu admin.",
      });
    }

    const member = await Member.findById(req.user.memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: "We couldn't find that member. It may have been removed.",
      });
    }

    // Family head may apply on behalf of another active member of their own family
    const { subjectMemberId, mahallMemberType } = req.body;
    let subject = member;
    if (subjectMemberId && String(subjectMemberId) !== String(member._id)) {
      if (member.isFamilyHead !== true) {
        return res.status(403).json({
          success: false,
          message: 'Only the family head can apply on behalf of another family member.',
        });
      }
      const found = await Member.findOne({
        _id: subjectMemberId,
        familyId: member.familyId,
        tenantId: member.tenantId,
        status: 'active',
      });
      if (!found) {
        return res.status(404).json({
          success: false,
          message: "We couldn't find that person in your family.",
        });
      }
      subject = found;
    }

    // The mahallu member can be on either side of the nikah (groom or bride)
    const side: 'groom' | 'bride' = mahallMemberType === 'bride' ? 'bride' : 'groom';
    const otherSideName = side === 'groom' ? req.body.brideName : req.body.groomName;
    if (!otherSideName) {
      return res.status(400).json({
        success: false,
        message: side === 'groom' ? 'Please enter the bride’s name.' : 'Please enter the groom’s name.',
      });
    }

    const missingDocs = await findMissingRequiredDocs(req.body.documents, member, 'nikah');
    if (missingDocs.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Please attach these documents: ${missingDocs.join(', ')}.`,
        code: 'DOCUMENTS_REQUIRED',
        missing: missingDocs,
      });
    }

    // The groom's name is whatever was entered on the form. The member record
    // supplies the *link* (groomId), not the name - copying subject.name over the
    // submitted value saved the signed-in member's own name no matter what was
    // typed. It is only a fallback for a client that sent no groom name at all.
    // The same holds on the bride side: the form has an editable bride name, so
    // the member record only supplies brideId and a fallback.
    const enteredGroomName = typeof req.body.groomName === 'string' ? req.body.groomName.trim() : '';
    const enteredBrideName = typeof req.body.brideName === 'string' ? req.body.brideName.trim() : '';

    const nikahData = {
      ...pickSubmittedFields(req.body, NIKAH_SUBMIT_FIELDS),
      tenantId: member.tenantId,
      mahallMemberType: side,
      submittedByMemberId: member._id,
      ...(side === 'groom'
        ? { groomId: subject._id, groomName: enteredGroomName || subject.name, groomAge: req.body.groomAge ?? subject.age }
        : { brideId: subject._id, brideName: enteredBrideName || subject.name, brideAge: req.body.brideAge ?? subject.age }),
      status: 'pending',
    };

    const nikah = new NikahRegistration(nikahData);
    await nikah.save();

    const attachedDocs = await attachOwnDocuments(req.body.documents, member, 'nikah', nikah._id);
    if (attachedDocs.length > 0) {
      nikah.documents = attachedDocs as any;
      await nikah.save();
    }

    res.status(201).json({
      success: true,
      data: nikah,
      message: 'Nikah registration request submitted',
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the nikah registration. Please try again.');
  }
};

// Request Death registration
export const requestDeathRegistration = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.memberId) {
      return res.status(404).json({
        success: false,
        message: "Your profile isn't linked to a member record yet. Please contact your Mahallu admin.",
      });
    }

    const member = await Member.findById(req.user.memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: "We couldn't find that member. It may have been removed.",
      });
    }

    // Any member can report a death within their own family (they are the informant)
    const { deceasedMemberId } = req.body;
    let deceased = member;
    if (deceasedMemberId && String(deceasedMemberId) !== String(member._id)) {
      const found = await Member.findOne({
        _id: deceasedMemberId,
        familyId: member.familyId,
        tenantId: member.tenantId,
        status: { $ne: 'deleted' },
      });
      if (!found) {
        return res.status(404).json({
          success: false,
          message: "We couldn't find that person in your family.",
        });
      }
      deceased = found;
    }

    if (await hasOpenDeathRecord(member.tenantId, deceased._id)) {
      return res.status(409).json({ success: false, message: DUPLICATE_DEATH_MESSAGE });
    }

    const missingDeathDocs = await findMissingRequiredDocs(req.body.documents, member, 'death');
    if (missingDeathDocs.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Please attach these documents: ${missingDeathDocs.join(', ')}.`,
        code: 'DOCUMENTS_REQUIRED',
        missing: missingDeathDocs,
      });
    }

    const deathData = {
      ...pickSubmittedFields(req.body, DEATH_SUBMIT_FIELDS),
      tenantId: member.tenantId,
      deceasedId: deceased._id,
      deceasedName: deceased.name,
      familyId: member.familyId,
      informantName: req.body.informantName || member.name,
      informantPhone: req.body.informantPhone || member.phone,
      submittedByMemberId: member._id,
      status: 'pending',
    };

    const death = new DeathRegistration(deathData);
    await death.save();

    const attachedDeathDocs = await attachOwnDocuments(req.body.documents, member, 'death', death._id);
    if (attachedDeathDocs.length > 0) {
      death.documents = attachedDeathDocs as any;
      await death.save();
    }

    res.status(201).json({
      success: true,
      data: death,
      message: 'Death registration request submitted',
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the death registration. Please try again.');
  }
};

// Request NOC
export const requestNOC = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.memberId) {
      return res.status(404).json({
        success: false,
        message: "Your profile isn't linked to a member record yet. Please contact your Mahallu admin.",
      });
    }

    const member = await Member.findById(req.user.memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: "We couldn't find that member. It may have been removed.",
      });
    }

    const {
      type, brideName, brideAge, groomName, groomAge, nikahDate, venue,
      subjectMemberId, mahallMemberType, waliName, witness1, witness2, mahrAmount, mahrDescription,
      purposeTitle, purposeDescription, remarks,
    } = req.body;

    let nikahRegistrationId: any = undefined;

    // For nikah NOC, create a linked NikahRegistration record first — same fields/validation as
    // the standalone Register Nikah flow so a nikah NOC captures the full ceremony details.
    if (type === 'nikah') {
      let subject = member;
      if (subjectMemberId && String(subjectMemberId) !== String(member._id)) {
        if (member.isFamilyHead !== true) {
          return res.status(403).json({
            success: false,
            message: 'Only the family head can apply on behalf of another family member.',
          });
        }
        const found = await Member.findOne({
          _id: subjectMemberId,
          familyId: member.familyId,
          tenantId: member.tenantId,
          status: 'active',
        });
        if (!found) {
          return res.status(404).json({
            success: false,
            message: "We couldn't find that person in your family.",
          });
        }
        subject = found;
      }

      const side: 'groom' | 'bride' = mahallMemberType === 'bride' ? 'bride' : 'groom';
      const otherSideName = side === 'groom' ? brideName : groomName;
      if (!otherSideName || !nikahDate) {
        return res.status(400).json({
          success: false,
          message: side === 'groom'
            ? 'Please enter the bride’s name and the nikah date.'
            : 'Please enter the groom’s name and the nikah date.',
        });
      }

      const missingDocs = await findMissingRequiredDocs(req.body.documents, member, 'nikah');
      if (missingDocs.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Please attach these documents: ${missingDocs.join(', ')}.`,
          code: 'DOCUMENTS_REQUIRED',
          missing: missingDocs,
        });
      }

      // As on the standalone nikah request: the member record supplies the id
      // link, the names are whatever was typed on the form.
      const typedGroom = typeof groomName === 'string' ? groomName.trim() : '';
      const typedBride = typeof brideName === 'string' ? brideName.trim() : '';
      const nikahReg = new NikahRegistration({
        tenantId: member.tenantId,
        mahallMemberType: side,
        submittedByMemberId: member._id,
        ...(side === 'groom'
          ? { groomId: subject._id, groomName: typedGroom || subject.name, groomAge: groomAge ?? subject.age, brideName, brideAge }
          : { brideId: subject._id, brideName: typedBride || subject.name, brideAge: brideAge ?? subject.age, groomName, groomAge }),
        nikahDate,
        venue,
        waliName,
        witness1,
        witness2,
        mahrAmount,
        mahrDescription,
        status: 'pending',
      });
      await nikahReg.save();
      nikahRegistrationId = nikahReg._id;
    }

    const nocData: any = {
      tenantId: member.tenantId,
      applicantId: member._id,
      applicantName: member.name,
      applicantPhone: member.phone || req.user.phone,
      type: type || 'common',
      purposeTitle,
      purposeDescription: sanitizeRichText(purposeDescription),
      remarks,
      submittedByMemberId: member._id,
      status: 'pending',
    };

    if (nikahRegistrationId) {
      nocData.nikahRegistrationId = nikahRegistrationId;
    }

    const noc = new NOC(nocData);
    await noc.save();

    const attachedNocDocs = await attachOwnDocuments(req.body.documents, member, 'noc', noc._id);
    if (attachedNocDocs.length > 0) {
      noc.documents = attachedNocDocs as any;
      await noc.save();
    }

    const populated = await NOC.findById(noc._id).populate('nikahRegistrationId');

    res.status(201).json({
      success: true,
      data: populated,
      message: 'NOC request submitted',
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the NOC. Please try again.');
  }
};

// Resubmit / edit an own registration while it is pending or needs correction
export const resubmitRegistration = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.memberId) {
      return res.status(404).json({
        success: false,
        message: "Your profile isn't linked to a member record yet. Please contact your Mahallu admin.",
      });
    }

    const member = await Member.findById(req.user.memberId);
    if (!member) {
      return res.status(404).json({ success: false, message: "We couldn't find that member. It may have been removed." });
    }

    const { type, id } = req.params;
    const models: Record<string, any> = {
      nikah: NikahRegistration,
      death: DeathRegistration,
      noc: NOC,
    };
    const Model = models[type];
    if (!Model) {
      return res.status(400).json({ success: false, message: 'Please choose a registration type.' });
    }

    const reg = await Model.findOne({
      _id: id,
      tenantId: member.tenantId,
      status: { $in: ['pending', 'correction_required'] },
      $or: [
        { submittedByMemberId: member._id },
        ...(type === 'nikah' ? [{ groomId: member._id }, { brideId: member._id }] : []),
        ...(type === 'death' ? [{ deceasedId: member._id }] : []),
        ...(type === 'noc' ? [{ applicantId: member._id }] : []),
      ],
    });

    if (!reg) {
      return res.status(404).json({ success: false, message: "We couldn't find a registration that can be edited." });
    }

    // Allowlist per type — members may edit details, never workflow/identity/linkage fields
    const editableFields: Record<string, string[]> = {
      nikah: ['groomName', 'groomNameMl', 'groomAge', 'brideName', 'brideNameMl', 'brideAge', 'nikahDate', 'venue', 'waliName', 'witness1', 'witness2', 'mahrAmount', 'mahrDescription'],
      death: ['deathDate', 'placeOfDeath', 'causeOfDeath', 'informantName', 'informantRelation', 'informantPhone'],
      noc: ['purposeTitle', 'purposeTitleMl', 'purposeDescription', 'purpose', 'applicantPhone'],
    };
    editableFields[type].forEach((key) => {
      if (req.body[key] !== undefined) {
        // NOC purpose / description are rendered as HTML by the CMS: keep only allow-listed markup.
        (reg as any)[key] = type === 'noc' && (key === 'purposeDescription' || key === 'purpose')
          ? sanitizeRichText(req.body[key])
          : req.body[key];
      }
    });

    const attachedDocs = await attachOwnDocuments(req.body.documents, member, type as any, reg._id);
    if (attachedDocs.length > 0) {
      reg.documents = [...new Set([...(reg.documents || []).map(String), ...attachedDocs.map(String)])];
    }

    reg.status = 'pending'; // corrections go back into the review queue
    await reg.save();

    res.json({ success: true, data: reg, message: 'Registration resubmitted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the registration. Please try again.');
  }
};

// Cancel/delete an own registration — only while it hasn't been approved yet
export const deleteOwnRegistration = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.memberId) {
      return res.status(404).json({
        success: false,
        message: "Your profile isn't linked to a member record yet. Please contact your Mahallu admin.",
      });
    }

    const member = await Member.findById(req.user.memberId);
    if (!member) {
      return res.status(404).json({ success: false, message: "We couldn't find that member. It may have been removed." });
    }

    const { type, id } = req.params;
    const models: Record<string, any> = {
      nikah: NikahRegistration,
      death: DeathRegistration,
      noc: NOC,
    };
    const Model = models[type];
    if (!Model) {
      return res.status(400).json({ success: false, message: 'Please choose a registration type.' });
    }

    const reg = await Model.findOne({
      _id: id,
      tenantId: member.tenantId,
      status: { $in: ['pending', 'correction_required', 'rejected'] },
      $or: [
        { submittedByMemberId: member._id },
        ...(type === 'nikah' ? [{ groomId: member._id }, { brideId: member._id }] : []),
        ...(type === 'death' ? [{ deceasedId: member._id }] : []),
        ...(type === 'noc' ? [{ applicantId: member._id }] : []),
      ],
    });

    if (!reg) {
      return res.status(404).json({ success: false, message: "We couldn't find a registration that can be deleted." });
    }

    await Model.deleteOne({ _id: reg._id });

    // A nikah-type NOC also owns a linked NikahRegistration draft — remove it too, it has no
    // independent purpose once the NOC that created it is gone.
    if (type === 'noc' && (reg as any).nikahRegistrationId) {
      await NikahRegistration.deleteOne({ _id: (reg as any).nikahRegistrationId, tenantId: member.tenantId });
    }

    res.json({ success: true, message: 'Registration deleted' });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t delete your registration. Please try again.');
  }
};

// Get own notifications
export const getOwnNotifications = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.memberId) {
      return res.status(404).json({
        success: false,
        message: "Your profile isn't linked to a member record yet. Please contact your Mahallu admin.",
      });
    }

    const member = await Member.findById(req.user.memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: "We couldn't find that member. It may have been removed.",
      });
    }

    const { page, limit, skip } = getPaginationParams(req);

    const query: any = {
      tenantId: member.tenantId,
      $or: [
        { recipientType: 'member', recipientId: member._id },
        ...(req.user?._id ? [{ recipientType: 'user', recipientId: req.user._id }] : []),
        // A group this member is in (several people, their family, a committee).
        { recipientIds: { $in: [member._id, ...(req.user?._id ? [req.user._id] : [])] } },
        { recipientType: 'all' },
      ],
    };

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .select('+readBy')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments(query),
    ]);

    // A broadcast is read per user: show this member's own state and never the list of other readers.
    const viewerId = req.user?._id;
    res.json(createPaginationResponse(notifications.map((n: any) => notificationForViewer(n, viewerId)), total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load your notifications right now. Please try again.');
  }
};

// Get community programs (view only)
export const getCommunityPrograms = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.memberId) {
      return res.status(404).json({
        success: false,
        message: "Your profile isn't linked to a member record yet. Please contact your Mahallu admin.",
      });
    }

    const member = await Member.findById(req.user.memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: "We couldn't find that member. It may have been removed.",
      });
    }

    const { page, limit, skip } = getPaginationParams(req);

    const query: any = {
      tenantId: member.tenantId,
      type: 'program',
      status: 'active',
    };

    const [programs, total] = await Promise.all([
      Institute.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Institute.countDocuments(query),
    ]);

    res.json(createPaginationResponse(programs, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the community programs right now. Please try again.');
  }
};

// Get public banners
export const getPublicBanners = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.memberId) {
      return res.status(404).json({
        success: false,
        message: "Your profile isn't linked to a member record yet. Please contact your Mahallu admin.",
      });
    }

    const member = await Member.findById(req.user.memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: "We couldn't find that member. It may have been removed.",
      });
    }

    const { page, limit, skip } = getPaginationParams(req);

    const query: any = {
      tenantId: member.tenantId,
      ...activeBannerFilter(),
    };

    const [banners, total] = await Promise.all([
      Banner.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Banner.countDocuments(query),
    ]);

    res.json(createPaginationResponse(banners, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the public banners right now. Please try again.');
  }
};

// Get public feeds
export const getPublicFeeds = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.memberId) {
      return res.status(404).json({
        success: false,
        message: "Your profile isn't linked to a member record yet. Please contact your Mahallu admin.",
      });
    }

    const member = await Member.findById(req.user.memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: "We couldn't find that member. It may have been removed.",
      });
    }

    const { page, limit, skip } = getPaginationParams(req);

    const query: any = {
      tenantId: member.tenantId,
      status: 'published',
      isDeleted: { $ne: true },
    };

    const [feeds, total] = await Promise.all([
      Feed.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Feed.countDocuments(query),
    ]);

    res.json(createPaginationResponse(feeds, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load the public feeds right now. Please try again.');
  }
};

// Get own family members
export const getOwnFamilyMembers = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.memberId) {
      return res.status(404).json({
        success: false,
        message: "Your profile isn't linked to a member record yet. Please contact your Mahallu admin.",
      });
    }

    const member = await Member.findById(req.user.memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: "We couldn't find that member. It may have been removed.",
      });
    }

    if (!member.familyId) {
      return res.status(404).json({
        success: false,
        message: "This member isn't linked to a family yet. Please add them to a family first.",
      });
    }

    const { page, limit, skip } = getPaginationParams(req);

    // Get all active members from the same family
    const [familyMembers, total] = await Promise.all([
      Member.find({ 
        familyId: member.familyId,
        tenantId: member.tenantId,
        status: 'active', // Only show active members
      })
        .populate('familyId', 'houseName mahallId contactNo')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Member.countDocuments({ 
        familyId: member.familyId,
        tenantId: member.tenantId,
        status: 'active', // Only count active members
      }),
    ]);

    res.json(createPaginationResponse(familyMembers, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load your family members right now. Please try again.');
  }
};

const REGISTRATION_MODELS = { nikah: NikahRegistration, death: DeathRegistration, noc: NOC } as const;
type RegistrationType = keyof typeof REGISTRATION_MODELS;
const REGISTRATION_TYPES = Object.keys(REGISTRATION_MODELS) as RegistrationType[];

/**
 * The certificates a member may see: those concerning anyone in their family/house, plus those of
 * registrations GET /member-user/registrations returns to them (and death registrations of their house).
 * Always inside the member's own Mahallu.
 */
const ownCertificateScope = async (member: any): Promise<Record<string, any>> => {
  const family = member.familyId
    ? await Member.find({ tenantId: member.tenantId, familyId: member.familyId, status: { $ne: 'deleted' } }).select('_id').lean()
    : [];
  const familyIds = [member._id, ...family.map((m: any) => m._id)];

  const queries = ownRegistrationQueries(member);
  if (member.familyId) (queries.death.$or as any[]).push({ familyId: member.familyId });
  const owned = await Promise.all(
    REGISTRATION_TYPES.map(async (type) => {
      const rows: any[] = await (REGISTRATION_MODELS[type] as any).find(queries[type]).select('_id').lean();
      return { type, ids: rows.map((r) => r._id) };
    })
  );

  return {
    tenantId: member.tenantId,
    $or: [
      { subjectMemberIds: { $in: familyIds } },
      ...owned.filter((o) => o.ids.length > 0).map((o) => ({ type: o.type, registrationId: { $in: o.ids } })),
    ],
  };
};

/** Who the certificate is for, from its registration (bride & groom, the deceased, the applicant). */
const subjectNames = async (certs: any[]): Promise<Map<string, string>> => {
  const names = new Map<string, string>();
  const idsOf = (type: string) => certs.filter((c) => c.type === type).map((c) => c.registrationId);
  const [nikahs, deaths, nocs] = await Promise.all([
    NikahRegistration.find({ _id: { $in: idsOf('nikah') } }).select('groomName brideName').lean(),
    DeathRegistration.find({ _id: { $in: idsOf('death') } }).select('deceasedName').lean(),
    NOC.find({ _id: { $in: idsOf('noc') } }).select('applicantName').lean(),
  ]);
  for (const r of nikahs as any[]) names.set(String(r._id), [r.groomName, r.brideName].filter(Boolean).join(' & '));
  for (const r of deaths as any[]) names.set(String(r._id), r.deceasedName);
  for (const r of nocs as any[]) names.set(String(r._id), r.applicantName);
  return names;
};

// GET /api/member-user/certificates?page&limit&type
// Issued (not revoked) certificates of the member and their family/house:
// { _id, type, certificateNo, issuedAt, subjectName, status: 'issued' }.
export const getOwnCertificates = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.memberId) {
      return res.status(404).json({
        success: false,
        message: "Your profile isn't linked to a member record yet. Please contact your Mahallu admin.",
      });
    }

    const member = await Member.findById(req.user.memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: "We couldn't find that member. It may have been removed.",
      });
    }

    const { page, limit, skip } = getPaginationParams(req);
    const requested = req.query.type as RegistrationType | undefined;
    const query = {
      ...(await ownCertificateScope(member)),
      status: 'valid',
      ...(requested ? { type: requested } : {}),
    };
    const [certs, total] = await Promise.all([
      Certificate.find(query).select('certificateNo type issueDate registrationId').sort({ issueDate: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      Certificate.countDocuments(query),
    ]);

    const names = await subjectNames(certs);
    const data = certs.map((c: any) => ({
      _id: c._id,
      type: c.type,
      certificateNo: c.certificateNo,
      issuedAt: c.issueDate,
      subjectName: names.get(String(c.registrationId)) || null,
      status: 'issued',
    }));

    res.json(createPaginationResponse(data, total, page, limit));
  } catch (error: any) {
    sendFailure(res, error, "We couldn't load your certificates right now. Please try again.");
  }
};

// GET /api/member-user/certificates/:id/download — a short-lived link to the PDF the admin issue stored.
// Not the member's (or their family's) certificate answers 404, exactly like one that doesn't exist;
// a revoked one answers 410.
export const downloadOwnCertificate = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.memberId) {
      return res.status(404).json({
        success: false,
        message: "Your profile isn't linked to a member record yet. Please contact your Mahallu admin.",
      });
    }

    const member = await Member.findById(req.user.memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: "We couldn't find that member. It may have been removed.",
      });
    }

    const cert = await Certificate.findOne({ ...(await ownCertificateScope(member)), _id: req.params.id });
    if (!cert) {
      return res.status(404).json({ success: false, message: "We couldn't find that certificate. It may have been removed." });
    }

    if (cert.status === 'revoked') {
      return res.status(410).json({
        success: false,
        message: 'This certificate has been revoked and can no longer be downloaded.',
      });
    }

    const url = await getSignedDownloadUrl(cert.pdfKey);
    res.json({ success: true, data: { url, fileName: `${cert.certificateNo}.pdf`, expiresIn: 300 } });
  } catch (error: any) {
    sendFailure(res, error, "We couldn't prepare the certificate for download. Please try again.");
  }
};

