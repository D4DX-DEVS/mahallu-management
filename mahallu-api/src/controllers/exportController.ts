import { Response } from 'express';
import Family from '../models/Family';
import Member from '../models/Member';
import { Varisangya, Zakat } from '../models/Collectible';
import { NikahRegistration, DeathRegistration, NOC } from '../models/Registration';
import { AuthRequest } from '../middleware/authMiddleware';

import { sendFailure } from '../utils/userMessages';

// ponytail: in-memory CSV capped at 10k rows — stream with cursors if tenants outgrow this
const MAX_EXPORT_ROWS = 10000;

/**
 * One CSV field, safe to open in a spreadsheet. The same rule as the CMS export helper
 * (mahallu-cms/src/utils/exportUtils.ts, toCsvField), because these columns hold user-typed text:
 *
 * - Long digit strings (12+ digits: account numbers, Aadhaar) and digit strings with a leading zero are
 *   written as ="digits" so Excel keeps them as text instead of 1.23E+15 / dropped zeros.
 * - Formula injection: a field starting with = @ TAB or CR, or with + / - that is not a plain number or a
 *   phone-like value ("-500", "+91 98765 43210"), gets a leading apostrophe so it cannot run as a formula.
 * - Commas, quotes and line breaks wrap the field in quotes.
 */
export const csvEscape = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  let s: string;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    s = value.toISOString().slice(0, 10);
  } else {
    s = String(value);
  }
  if (/^\d+$/.test(s) && (s.length >= 12 || (s.length > 1 && s.startsWith('0')))) {
    return `="${s}"`;
  }
  if (/^[=@\t\r]/.test(s) || (/^[+-]/.test(s) && !/^[+-]?[\d\s().,-]*$/.test(s))) {
    s = `'${s}`;
  }
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const toCsv = (headers: string[], rows: unknown[][]): string =>
  [headers.join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\r\n');

interface EntityConfig {
  model: any;
  headers: string[];
  row: (d: any) => unknown[];
  sort?: Record<string, 1 | -1>;
}

const ENTITIES: Record<string, EntityConfig> = {
  families: {
    model: Family,
    headers: ['Mahall ID', 'House Name', 'Family Head', 'Contact', 'Ward', 'House No', 'Area', 'Place', 'Varisangya Grade', 'Status', 'Created'],
    row: (f) => [f.mahallId, f.houseName, f.familyHead, f.contactNo, f.wardNumber, f.houseNo, f.area, f.place, f.varisangyaGrade, f.status, f.createdAt],
  },
  members: {
    model: Member,
    headers: ['Mahall ID', 'Name', 'Family', 'Age', 'Gender', 'Phone', 'Blood Group', 'Education', 'Occupation', 'Marital Status', 'Relationship', 'Family Head', 'Status', 'Created'],
    row: (m) => [m.mahallId, m.name, m.familyName, m.age, m.gender, m.phone, m.bloodGroup, m.education, m.occupation, m.maritalStatus, m.relationship, m.isFamilyHead ? 'yes' : '', m.status, m.createdAt],
  },
  varisangya: {
    model: Varisangya,
    headers: ['Receipt No', 'Amount', 'Payment Date', 'Method', 'Status', 'Source', 'Remarks'],
    row: (v) => [v.receiptNo, v.amount, v.paymentDate, v.paymentMethod, v.status || 'verified', v.source || 'admin', v.remarks],
    sort: { paymentDate: -1 },
  },
  zakat: {
    model: Zakat,
    headers: ['Receipt No', 'Payer', 'Amount', 'Payment Date', 'Method', 'Category', 'Status', 'Source', 'Remarks'],
    row: (z) => [z.receiptNo, z.payerName, z.amount, z.paymentDate, z.paymentMethod, z.category, z.status || 'verified', z.source || 'admin', z.remarks],
    sort: { paymentDate: -1 },
  },
  nikah: {
    model: NikahRegistration,
    headers: ['Groom', 'Groom Age', 'Bride', 'Bride Age', 'Nikah Date', 'Venue', 'Wali', 'Witness 1', 'Witness 2', 'Mahr', 'Status', 'Created'],
    row: (n) => [n.groomName, n.groomAge, n.brideName, n.brideAge, n.nikahDate, n.venue, n.waliName, n.witness1, n.witness2, n.mahrAmount, n.status, n.createdAt],
  },
  death: {
    model: DeathRegistration,
    headers: ['Deceased', 'Death Date', 'Place', 'Cause', 'Informant', 'Informant Phone', 'Status', 'Created'],
    row: (d) => [d.deceasedName, d.deathDate, d.placeOfDeath, d.causeOfDeath, d.informantName, d.informantPhone, d.status, d.createdAt],
  },
  noc: {
    model: NOC,
    headers: ['Applicant', 'Phone', 'Type', 'Purpose', 'Status', 'Issued Date', 'Created'],
    row: (n) => [n.applicantName, n.applicantPhone, n.type, n.purposeTitle || n.purpose, n.status, n.issuedDate, n.createdAt],
  },
};

// GET /api/export/:entity — tenant-scoped CSV download (admin only)
export const exportEntityCsv = async (req: AuthRequest, res: Response) => {
  try {
    // Own keys only: "constructor" or "__proto__" must not resolve to a config.
    const config = Object.prototype.hasOwnProperty.call(ENTITIES, req.params.entity)
      ? ENTITIES[req.params.entity]
      : undefined;
    if (!config) {
      return res.status(400).json({
        success: false,
        message: "That export isn't available. Please choose another.",
      });
    }
    if (!req.tenantId) {
      return res.status(400).json({ success: false, message: 'Please select a Mahallu before continuing.' });
    }

    // One row past the cap, so "exactly at the cap" and "cut off" can be told apart.
    const fetched = await config.model
      .find({ tenantId: req.tenantId })
      .sort(config.sort || { createdAt: -1 })
      .limit(MAX_EXPORT_ROWS + 1)
      .lean();
    const truncated = fetched.length > MAX_EXPORT_ROWS;
    const docs = truncated ? fetched.slice(0, MAX_EXPORT_ROWS) : fetched;

    const csv = toCsv(config.headers, docs.map(config.row));
    const stamp = new Date().toISOString().slice(0, 10);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    // The file holds only the newest MAX_EXPORT_ROWS rows when the Mahallu has more.
    if (truncated) res.setHeader('X-Export-Truncated', 'true');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.entity}-${stamp}.csv"`);
    res.send('﻿' + csv); // BOM so Excel opens UTF-8 correctly
  } catch (error: any) {
    sendFailure(res, error, 'We couldn\'t prepare the entity CSV for download. Please try again.');
  }
};
