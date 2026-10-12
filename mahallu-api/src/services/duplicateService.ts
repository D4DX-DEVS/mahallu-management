import mongoose from 'mongoose';
import Family from '../models/Family';
import Member from '../models/Member';
import { normalizeName, normalizePhone } from '../utils/text';
import { ACTIVE_FAMILY_FILTER } from '../utils/archiveFilters';

export interface DuplicateMatch {
  id: string;
  houseName: string;
  familyHead?: string;
  mahallId?: string;
  reason: 'same_contact' | 'same_house_and_head';
  reasonText: string;
}

export interface MemberDuplicateMatch {
  id: string;
  name: string;
  houseName?: string;
  familyHead?: string;
  familyId?: string;
  reason: 'same_name_age_phone' | 'same_name_age_in_family';
  reasonText: string;
}

type FamilyRow = { _id: any; houseName?: string; familyHead?: string; contactNo?: string; mahallId?: string };

const loadFamilies = (tenantId: any): Promise<FamilyRow[]> =>
  Family.find({ tenantId, ...ACTIVE_FAMILY_FILTER }).select('houseName familyHead contactNo mahallId').lean() as any;

function compareFamily(
  cand: { houseName?: string; familyHead?: string; contactNo?: string },
  rows: FamilyRow[],
  excludeId?: string
): DuplicateMatch[] {
  const phone = normalizePhone(cand.contactNo);
  const house = normalizeName(cand.houseName);
  const head = normalizeName(cand.familyHead);
  const out: DuplicateMatch[] = [];
  for (const r of rows) {
    if (excludeId && String(r._id) === String(excludeId)) continue;
    let reason: DuplicateMatch['reason'] | undefined;
    let reasonText = '';
    if (phone && phone.length >= 7 && normalizePhone(r.contactNo) === phone) {
      reason = 'same_contact';
      reasonText = 'Same contact number';
    } else if (house && head && normalizeName(r.houseName) === house && normalizeName(r.familyHead) === head) {
      reason = 'same_house_and_head';
      reasonText = 'Same house name and family head';
    }
    if (reason) {
      out.push({ id: String(r._id), houseName: r.houseName || '', familyHead: r.familyHead, mahallId: r.mahallId, reason, reasonText });
    }
  }
  return out;
}

export async function findFamilyDuplicates(
  tenantId: any,
  cand: { houseName?: string; familyHead?: string; contactNo?: string },
  excludeId?: string
): Promise<DuplicateMatch[]> {
  return compareFamily(cand, await loadFamilies(tenantId), excludeId);
}

/** Bulk import: check each row against the tenant AND against earlier rows of the same file. */
export async function findFamilyDuplicatesForRows(
  tenantId: any,
  rows: Array<{ houseName?: string; familyHead?: string; contactNo?: string }>
): Promise<Array<{ row: number; matches: DuplicateMatch[] }>> {
  const existing = await loadFamilies(tenantId);
  const batch: FamilyRow[] = [];
  const result: Array<{ row: number; matches: DuplicateMatch[] }> = [];
  rows.forEach((r, i) => {
    const matches = compareFamily(r, [...existing, ...batch]);
    if (matches.length) result.push({ row: i + 1, matches });
    batch.push({ _id: `row-${i + 1}`, houseName: r.houseName, familyHead: r.familyHead, contactNo: r.contactNo, mahallId: `row ${i + 1}` });
  });
  return result;
}

export async function findMemberDuplicates(
  tenantId: any,
  cand: { name?: string; age?: number | string; phone?: string; familyId?: any },
  excludeId?: string
): Promise<MemberDuplicateMatch[]> {
  const name = normalizeName(cand.name);
  if (!name) return [];
  const age = cand.age !== undefined && cand.age !== null && cand.age !== '' ? Number(cand.age) : undefined;
  const phone = normalizePhone(cand.phone);
  const q: any = { tenantId, status: { $ne: 'deleted' }, name: { $regex: `^\\s*${name.split(' ').map(escapeRe).join('\\s+')}\\s*$`, $options: 'i' } };
  const rows: any[] = await Member.find(q).select('name age phone familyId familyName').populate('familyId', 'houseName familyHead').lean();
  const out: MemberDuplicateMatch[] = [];
  for (const r of rows) {
    if (excludeId && String(r._id) === String(excludeId)) continue;
    if (normalizeName(r.name) !== name) continue;
    const sameAge = age !== undefined && !Number.isNaN(age) && r.age === age;
    const fam = r.familyId && typeof r.familyId === 'object' ? r.familyId : undefined;
    const base = { id: String(r._id), name: r.name, houseName: fam?.houseName || r.familyName, familyHead: fam?.familyHead, familyId: fam?._id ? String(fam._id) : undefined };
    if (sameAge && phone && normalizePhone(r.phone) === phone) {
      out.push({ ...base, reason: 'same_name_age_phone', reasonText: 'Same name, age and phone number' });
    } else if (sameAge && cand.familyId && String(fam?._id || r.familyId) === String(cand.familyId)) {
      out.push({ ...base, reason: 'same_name_age_in_family', reasonText: 'Same name and age already in this family' });
    }
  }
  return out;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Tenant-wide report of suspicious family pairs (same contact, or same house+head). */
export async function buildFamilyDuplicateReport(tenantId: any) {
  const rows = await loadFamilies(tenantId);
  const byPhone = new Map<string, FamilyRow[]>();
  const byHouseHead = new Map<string, FamilyRow[]>();
  for (const r of rows) {
    const p = normalizePhone(r.contactNo);
    if (p.length >= 7) byPhone.set(p, [...(byPhone.get(p) || []), r]);
    const h = normalizeName(r.houseName);
    const f = normalizeName(r.familyHead);
    if (h && f) byHouseHead.set(`${h}|${f}`, [...(byHouseHead.get(`${h}|${f}`) || []), r]);
  }
  const pairs = new Map<string, any>();
  const add = (list: FamilyRow[], reason: string, reasonText: string) => {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const key = [String(a._id), String(b._id)].sort().join('|');
        const entry = pairs.get(key) || { a: brief(a), b: brief(b), reasons: [] as any[] };
        if (!entry.reasons.some((x: any) => x.reason === reason)) entry.reasons.push({ reason, reasonText });
        pairs.set(key, entry);
      }
    }
  };
  byPhone.forEach((l) => l.length > 1 && add(l, 'same_contact', 'Same contact number'));
  byHouseHead.forEach((l) => l.length > 1 && add(l, 'same_house_and_head', 'Same house name and family head'));
  return Array.from(pairs.values());
}

const brief = (r: FamilyRow) => ({ id: String(r._id), houseName: r.houseName || '', familyHead: r.familyHead, mahallId: r.mahallId, contactNo: r.contactNo });

export const isValidId = (v: unknown) => mongoose.Types.ObjectId.isValid(String(v));
