import { Request, Response } from 'express';
import { NikahRegistration, DeathRegistration, NOC } from '../models/Registration';
import Member from '../models/Member';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';

import { sendFailure } from '../utils/userMessages';
import { regexLiteral } from '../utils/queryGuard';

// Nikah Registration
export const getAllNikahRegistrations = async (req: AuthRequest, res: Response) => {
  try {
    const { status, search, tenantId } = req.query;
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = {};

    // Apply tenant filter - req.tenantId includes x-tenant-id header for super admin viewing as tenant
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (tenantId && req.isSuperAdmin) {
      query.tenantId = tenantId;
    }

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
    const registrationData = {
      ...req.body,
      tenantId: req.tenantId || req.body.tenantId,
    };

    if (!registrationData.tenantId && !req.isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Please select a Mahallu before continuing.',
      });
    }

    const registration = new NikahRegistration(registrationData);
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

    const updated = await NikahRegistration.findByIdAndUpdate(
      id,
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

    // Apply tenant filter - req.tenantId includes x-tenant-id header for super admin viewing as tenant
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (tenantId && req.isSuperAdmin) {
      query.tenantId = tenantId;
    }

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
    const registrationData = {
      ...req.body,
      tenantId: req.tenantId || req.body.tenantId,
    };

    if (!registrationData.tenantId && !req.isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Please select a Mahallu before continuing.',
      });
    }

    const registration = new DeathRegistration(registrationData);
    await registration.save();

    if (registration.deceasedId) {
      
      await Member.findByIdAndUpdate(registration.deceasedId, {
        isDead: true,
        status: 'inactive',
      });
    }
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

    const updated = await DeathRegistration.findByIdAndUpdate(
      id,
      {
        deceasedName, deceasedId, deathDate, placeOfDeath, causeOfDeath,
        mahallId, familyId, informantName, informantRelation, informantPhone,
        status, remarks,
      },
      { new: true, runValidators: true }
    )
      .populate('deceasedId', 'name')
      .populate('familyId', 'houseName');

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

    // Apply tenant filter - req.tenantId includes x-tenant-id header for super admin viewing as tenant
    if (req.tenantId) {
      query.tenantId = req.tenantId;
    } else if (tenantId && req.isSuperAdmin) {
      query.tenantId = tenantId;
    }

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
    const { purposeTitle, purposeDescription, purpose } = req.body;
    if (!purposeTitle && !purpose) {
      return res.status(400).json({ success: false, message: 'Please enter the purpose title.' });
    }
    if (!purposeDescription && !purpose) {
      return res.status(400).json({ success: false, message: 'Please enter the purpose description.' });
    }
    const nocData = {
      ...req.body,
      tenantId: req.tenantId || req.body.tenantId,
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

    if (!nocData.tenantId && !req.isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Please select a Mahallu before continuing.',
      });
    }

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
    const { status, issuedDate, expiryDate, remarks, purposeTitle, purposeDescription, purpose } = req.body;

    const updateData: Record<string, any> = { status, issuedDate, expiryDate, remarks, purposeTitle, purposeDescription, purpose };
    if (status === 'approved') {
      updateData.approvedBy = req.user?.name || undefined;
      if (!issuedDate) updateData.issuedDate = new Date();
    }

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

