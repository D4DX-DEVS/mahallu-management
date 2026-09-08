import { Response } from 'express';
import Member from '../models/Member';
import Family from '../models/Family';
import { Varisangya, Zakat, Wallet, Transaction } from '../models/Collectible';
import { NikahRegistration, DeathRegistration, NOC } from '../models/Registration';
import Notification from '../models/Notification';
import Institute from '../models/Institute';
import { Banner, Feed } from '../models/Social';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import User from '../models/User';
import DocumentFile from '../models/DocumentFile';

import { sendFailure } from '../utils/userMessages';

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
            status: { $ne: 'pending' },
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
            status: { $ne: 'pending' },
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

    // Only allow updating specific fields
    const allowedFields = ['phone', 'email'];
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

    const { type, page, limit } = req.query;
    const { skip } = getPaginationParams(req);

    const member = await Member.findById(req.user.memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: "We couldn't find that member. It may have been removed.",
      });
    }

    const query: any = {
      tenantId: member.tenantId,
      $or: [
        { memberId: member._id },
        { familyId: member.familyId },
      ],
    };

    let payments: any[] = [];
    let total = 0;

    if (!type || type === 'varisangya') {
      const varisangyas = await Varisangya.find({
        ...query,
        memberId: member._id,
      })
        .populate('familyId', 'houseName')
        .sort({ paymentDate: -1 })
        .skip(skip)
        .limit(Number(limit) || 10);

      const varisangyaTotal = await Varisangya.countDocuments({
        ...query,
        memberId: member._id,
      });

      payments = varisangyas.map((v) => ({
        ...v.toObject(),
        type: 'varisangya',
      }));
      total = varisangyaTotal;
    }

    if (!type || type === 'zakat') {
      const zakats = await Zakat.find({
        tenantId: member.tenantId,
        payerId: member._id,
      })
        .sort({ paymentDate: -1 })
        .skip(skip)
        .limit(Number(limit) || 10);

      const zakatTotal = await Zakat.countDocuments({
        tenantId: member.tenantId,
        payerId: member._id,
      });

      if (type === 'zakat') {
        payments = zakats.map((z) => ({
          ...z.toObject(),
          type: 'zakat',
        }));
        total = zakatTotal;
      } else {
        payments = [
          ...payments,
          ...zakats.map((z) => ({
            ...z.toObject(),
            type: 'zakat',
          })),
        ];
        total += zakatTotal;
      }
    }

    payments.sort((a, b) => {
      const dateA = a.paymentDate || a.createdAt;
      const dateB = b.paymentDate || b.createdAt;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    res.json(createPaginationResponse(payments, total, Number(page) || 1, Number(limit) || 10));
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

    const memberTotal = memberVarisangya.reduce((sum: number, v: any) => sum + (v.amount || 0), 0);
    const familyTotal = familyVarisangya.reduce((sum: number, v: any) => sum + (v.amount || 0), 0);

    res.json({
      success: true,
      data: {
        memberVarisangya: memberVarisangya.map((v: any) => ({ ...v, status: 'paid' })),
        familyVarisangya: familyVarisangya.map((v: any) => ({ ...v, status: 'paid' })),
        summary: {
          memberTotal,
          memberCount: memberVarisangya.length,
          familyTotal,
          familyCount: familyVarisangya.length,
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

    let wallet = await Wallet.findOne({
      tenantId: member.tenantId,
      memberId: member._id,
    });

    if (!wallet) {
      wallet = new Wallet({
        tenantId: member.tenantId,
        memberId: member._id,
        balance: 0,
      });
      await wallet.save();
    }

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

    let wallet = await Wallet.findOne({
      tenantId: member.tenantId,
      memberId: member._id,
    });

    if (!wallet) {
      wallet = new Wallet({
        tenantId: member.tenantId,
        memberId: member._id,
        balance: 0,
      });
      await wallet.save();
    }

    const { page, limit } = req.query;
    const { skip } = getPaginationParams(req);

    const [transactions, total] = await Promise.all([
      Transaction.find({ walletId: wallet._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit) || 10),
      Transaction.countDocuments({ walletId: wallet._id }),
    ]);

    res.json(createPaginationResponse(transactions, total, Number(page) || 1, Number(limit) || 10));
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t load your wallet transactions right now. Please try again.');
  }
};

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

    const varisangyaData = {
      ...req.body,
      tenantId: member.tenantId,
      memberId: member._id,
      familyId: member.familyId,
      receiptNo: undefined, // assigned when the admin verifies
      status: 'pending',
      source: 'member',
    };

    const varisangya = new Varisangya(varisangyaData);
    await varisangya.save();

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

    const zakatData = {
      ...req.body,
      tenantId: member.tenantId,
      payerId: member._id,
      payerName: member.name,
      receiptNo: undefined, // assigned when the admin verifies
      status: 'pending',
      source: 'member',
    };

    const zakat = new Zakat(zakatData);
    await zakat.save();

    res.status(201).json({
      success: true,
      data: zakat,
      message: 'Zakat payment request submitted',
    });
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t save the zakat payment. Please try again.');
  }
};

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
      const nikahQuery = {
        tenantId: member.tenantId,
        $or: [
          { groomId: member._id },
          { brideId: member._id },
          { submittedByMemberId: member._id },
        ],
      };
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
      const deathQuery = {
        tenantId: member.tenantId,
        $or: [
          { deceasedId: member._id },
          { submittedByMemberId: member._id },
        ],
      };
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
      const nocQuery = {
        tenantId: member.tenantId,
        $or: [
          { applicantId: member._id },
          { submittedByMemberId: member._id },
        ],
      };
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

    const nikahData = {
      ...req.body,
      tenantId: member.tenantId,
      mahallMemberType: side,
      submittedByMemberId: member._id,
      ...(side === 'groom'
        ? { groomId: subject._id, groomName: subject.name, groomAge: req.body.groomAge ?? subject.age }
        : { brideId: subject._id, brideName: subject.name, brideAge: req.body.brideAge ?? subject.age }),
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
      ...req.body,
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

      const nikahReg = new NikahRegistration({
        tenantId: member.tenantId,
        mahallMemberType: side,
        submittedByMemberId: member._id,
        ...(side === 'groom'
          ? { groomId: subject._id, groomName: subject.name, groomAge: groomAge ?? subject.age, brideName, brideAge }
          : { brideId: subject._id, brideName: subject.name, brideAge: brideAge ?? subject.age, groomName, groomAge }),
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
      purposeDescription,
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
        (reg as any)[key] = req.body[key];
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
        { recipientType: 'all' },
      ],
    };

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments(query),
    ]);

    res.json(createPaginationResponse(notifications, total, page, limit));
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

    const now = new Date();
    const query: any = {
      tenantId: member.tenantId,
      status: 'active',
      $or: [
        { startDate: { $exists: false } },
        { startDate: null },
        { startDate: { $lte: now } },
      ],
      $and: [
        {
          $or: [
            { endDate: { $exists: false } },
            { endDate: null },
            { endDate: { $gte: now } },
          ],
        },
      ],
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

