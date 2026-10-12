/** Adds institute bank accounts + a fresh survey snapshot to the demo tenant; appends ids to the same manifest. */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import { connectDatabase } from '../config/database';
import Tenant from '../models/Tenant';
import Institute from '../models/Institute';
import SurveySnapshot from '../models/SurveySnapshot';
import { InstituteAccount } from '../models/MasterAccount';
dotenv.config();
const MANIFEST = process.env.DEMO_MANIFEST || 'demo-seed-manifest.json';
(async () => {
  const manifest: Record<string, string[]> = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const rec = (M: any, d: any) => { (manifest[M.collection.name] ||= []).push(String(d._id)); fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1)); };
  await connectDatabase();
  const tenant = await Tenant.findOne({ code: 'ZDM001' });
  if (!tenant) throw new Error('demo tenant missing');
  const insts = await Institute.find({ tenantId: tenant._id, type: { $ne: 'program' } });
  const bal = [265400, 148200, 72600];
  for (const [i, inst] of insts.entries()) {
    const a = new InstituteAccount({ tenantId: tenant._id, instituteId: inst._id, accountName: `${inst.name} Account`, accountNumber: `4410 22${i}8 7731`, bankName: 'Kerala Gramin Bank', balance: bal[i % 3], status: 'active' });
    await a.save(); rec(InstituteAccount, a);
  }
  const d = new Date(); d.setMonth(d.getMonth() - 2);
  const next = new Date(); next.setMonth(next.getMonth() + 10);
  const s = new SurveySnapshot({ tenantId: tenant._id, surveyDate: d, type: 'comprehensive', nextReviewDate: next, notes: 'Demo snapshot', stats: { totalHouseholds: 28, totalPopulation: 96, men: 46, women: 50, children: 24, youth: 22, seniorCitizens: 6, students: 36, married: 44, unmarried: 52, employed: 31, unemployed: 8, widows: 3, orphans: 2, disabled: 2, familiesNeedingAssistance: 9 } });
  await s.save(); rec(SurveySnapshot, s);
  console.log('patched', Object.fromEntries(Object.entries(manifest).map(([k, v]) => [k, v.length])));
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
