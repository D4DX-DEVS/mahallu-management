/**
 * Seeds a self-contained DEMO tenant ("ZAAD Demo Mahallu") for the launch video.
 * Every inserted document id is recorded in demo-seed-manifest.json so that
 * revertDemoZaad.ts can delete exactly those documents and nothing else.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { connectDatabase } from '../config/database';
import Tenant from '../models/Tenant';
import User from '../models/User';
import Family from '../models/Family';
import Member from '../models/Member';
import Institute from '../models/Institute';
import Committee from '../models/Committee';
import Meeting from '../models/Meeting';
import Khateeb from '../models/Khateeb';
import Announcement from '../models/Announcement';
import { Varisangya, Zakat } from '../models/Collectible';
import { MahalluAccount, Category, MasterWallet, Ledger, LedgerItem } from '../models/MasterAccount';
import { WelfareScheme, WelfareApplication } from '../models/Welfare';

dotenv.config();

const MANIFEST = process.env.DEMO_MANIFEST || 'demo-seed-manifest.json';
const manifest: Record<string, string[]> = {};
const rec = (M: any, d: any) => {
  const c = M.collection.name;
  (manifest[c] ||= []).push(String(d._id));
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
};
async function ins<T = any>(M: any, data: any): Promise<any> {
  const d = new M(data);
  await d.save();
  rec(M, d);
  return d;
}

let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const monthsAgo = (m: number, day = 5) => {
  const d = new Date();
  d.setMonth(d.getMonth() - m, day);
  d.setHours(10, 0, 0, 0);
  return d;
};

const MALE = ['Abdul Rahman', 'Muhammed Ashraf', 'Hamza Koya', 'Shihab Thangal', 'Faisal Kunnummal', 'Yusuf Madathil', 'Ibrahim Kutty', 'Noushad Parambil', 'Sulaiman Haji', 'Rashid Pulikkal', 'Abubacker Kodiyathur', 'Salim Cheruvadi', 'Mustafa Vengara', 'Jaleel Mannarkad', 'Basheer Valiyaparamba', 'Anwar Sadath', 'Saidalavi Kappil', 'Kunhahammed Melattur', 'Musthafa Edavannappara', 'Unais Thaha'];
const FEMALE = ['Fathima Beevi', 'Aisha Naseer', 'Khadeeja Hameed', 'Zainaba Latheef', 'Rukhiya Majeed', 'Safiya Noushad', 'Nafeesa Basheer', 'Shamsiya Koya', 'Muneera Salim', 'Rahmath Yusuf', 'Haseena Faisal', 'Jameela Ashraf', 'Suhara Kutty', 'Fousiya Anwar', 'Mariyam Hamza', 'Shifana Rashid', 'Nasreen Jaleel', 'Sajna Ibrahim', 'Ramla Mustafa', 'Thahira Unais'];
const HOUSES = ['Madathil', 'Kunnummal', 'Parambil', 'Pulikkal', 'Cheruvadi', 'Valiyaparamba', 'Kappil', 'Melattur', 'Thekkepurath', 'Kizhakkayil', 'Puthiyaveettil', 'Arakkal', 'Moothedath', 'Kodiyathur', 'Manjeri House', 'Palliyalil', 'Chalil', 'Thottathil', 'Karuvally', 'Edakkandy', 'Nellikkal', 'Orakkottil', 'Poovathingal', 'Vadakkepurath'];
const AREAS = ['Palliyangadi', 'Kunnath Road', 'Market Junction', 'Eastside', 'Riverside'];
const BLOOD = ['A +ve', 'B +ve', 'O +ve', 'AB +ve', 'O -ve', 'B -ve'];

async function main() {
  await connectDatabase();
  if (await Tenant.findOne({ code: 'ZDM001' })) throw new Error('Demo tenant ZDM001 already exists, revert first');
  console.log('Seeding demo tenant...');

  const tenant = await ins(Tenant, {
    name: 'ZAAD Demo Mahallu', code: 'ZDM001', type: 'premium', location: 'Kozhikode',
    address: { state: 'Kerala', district: 'Kozhikode', pinCode: '673001', postOffice: 'Kozhikode', lsgName: 'Kozhikode Corporation', village: 'Palliyangadi' },
    status: 'active', subscription: { plan: 'premium', startDate: new Date(), isActive: true },
    settings: { varisangyaAmount: 200, features: {} },
  });
  const tenantId = tenant._id;
  const pw = await bcrypt.hash('123456', 10);
  const perms = { view: true, add: true, edit: true, delete: true };

  // Families + members
  const families: any[] = []; const members: any[] = [];
  for (let i = 0; i < 28; i++) {
    const house = HOUSES[i % HOUSES.length] + (i >= HOUSES.length ? ' II' : '');
    const headName = pick(MALE);
    const grade = pick(['Grade A', 'Grade B', 'Grade C']);
    const fam = await ins(Family, {
      tenantId, mahallId: `ZDM001-F${String(i + 1).padStart(3, '0')}`, houseName: house, familyHead: headName,
      contactNo: `90000${String(10000 + i * 7).slice(-5)}`, wardNumber: `Ward ${int(1, 6)}`, houseNo: `H-${100 + i}`,
      area: pick(AREAS), place: 'Kozhikode', varisangyaGrade: grade,
      economicStatus: i % 9 === 0 ? 'needs_assistance' : i % 5 === 0 ? 'struggling' : 'stable',
      welfareStatus: i % 9 === 0 ? 'receiving' : 'none', housingType: pick(['own', 'own', 'rented']),
      status: i < 22 ? 'approved' : i < 25 ? 'pending' : 'unapproved',
    });
    families.push(fam);
    const size = int(2, 5);
    for (let j = 0; j < size; j++) {
      const female = j === 1 || (j > 2 && rnd() > 0.5);
      const age = j === 0 ? int(38, 62) : j === 1 ? int(32, 58) : int(3, 24);
      const nm = j === 0 ? headName : female ? pick(FEMALE) : pick(MALE).split(' ')[0] + ' ' + house.split(' ')[0];
      const m = await ins(Member, {
        tenantId, mahallId: `ZDM001-M${String(members.length + 1).padStart(3, '0')}`, name: nm, familyId: fam._id, familyName: house,
        age, gender: female ? 'female' : 'male', bloodGroup: pick(BLOOD), healthStatus: 'Good',
        phone: j < 2 ? `91000${String(10000 + members.length * 3).slice(-5)}` : undefined,
        education: age < 18 ? 'School' : pick(['Graduate', 'Higher Secondary', 'Post Graduate', 'Diploma']),
        maritalStatus: age < 22 ? 'single' : 'married', isFamilyHead: j === 0,
        occupationSector: age < 22 ? 'student' : female ? 'homemaker' : pick(['private', 'self_employed', 'abroad', 'government']),
        isZakatPayer: j === 0 && grade === 'Grade A', isZakatEligible: j === 0 && fam.economicStatus === 'needs_assistance',
        isVolunteer: age > 18 && age < 45 && rnd() > 0.75, isJobSeeker: age > 20 && age < 30 && rnd() > 0.8,
        isMarriageable: age >= 22 && age <= 30 && rnd() > 0.7, status: 'active',
      });
      members.push(m);
    }
  }

  // Users
  const adminMember = members[0];
  await ins(User, { name: 'Abdul Rahman', phone: '9000000001', email: 'admin@zaad-demo.test', password: pw, role: 'mahall', isSuperAdmin: false, tenantId, status: 'active', permissions: perms });
  await ins(User, { name: 'Survey Coordinator', phone: '9000000004', password: pw, role: 'survey', isSuperAdmin: false, tenantId, status: 'active', permissions: { view: true, add: true, edit: true, delete: false } });
  await ins(User, { name: adminMember.name, phone: '9000000003', password: pw, role: 'member', isSuperAdmin: false, tenantId, memberId: members[1]._id, status: 'active', permissions: { view: true, add: false, edit: false, delete: false } });

  // Institutes, accounts
  const inst = await ins(Institute, { tenantId, name: 'Darul Huda Madrasa', place: 'Kozhikode', type: 'madrasa', joinDate: new Date('2022-06-01'), description: 'Madrasa with 180 students', contactNo: '04952000001', status: 'active' });
  await ins(Institute, { tenantId, name: 'Al-Noor Orphanage', place: 'Kozhikode', type: 'orphanage', joinDate: new Date('2021-03-10'), description: 'Care home for 40 children', contactNo: '04952000002', status: 'active' });
  await ins(Institute, { tenantId, name: 'Rahma Charity Clinic', place: 'Kozhikode', type: 'hospital', joinDate: new Date('2023-01-15'), description: 'Free weekend clinic', contactNo: '04952000003', status: 'active' });
  await ins(Institute, { tenantId, name: 'Quran Study Circle', place: 'Kozhikode', type: 'program', joinDate: new Date('2024-02-01'), programType: 'quran_class', audience: 'all', description: 'Weekly tafsir class', status: 'active' });
  await ins(User, { name: 'Madrasa Manager', phone: '9000000002', password: pw, role: 'institute', isSuperAdmin: false, tenantId, instituteId: inst._id, status: 'active', permissions: perms });

  // Committees, meetings
  const exec = await ins(Committee, { tenantId, name: 'Executive Committee', description: 'Main governing committee', members: members.slice(0, 7).map((m) => m._id), status: 'active' });
  const edu = await ins(Committee, { tenantId, name: 'Education Committee', description: 'Madrasa and scholarship oversight', members: members.slice(8, 13).map((m) => m._id), status: 'active' });
  await ins(Committee, { tenantId, name: 'Welfare Committee', description: 'Zakat and welfare distribution', members: members.slice(14, 19).map((m) => m._id), status: 'active' });
  for (let k = 0; k < 4; k++) {
    await ins(Meeting, { tenantId, committeeId: k % 2 ? edu._id : exec._id, title: k % 2 ? 'Education Review' : 'Monthly Executive Meeting', meetingDate: monthsAgo(3 - k, 12), attendance: members.slice(0, 5).map((m) => m._id), totalMembers: 7, attendancePercent: 71, agenda: 'Budget, upcoming programs, welfare cases', status: k < 3 ? 'completed' : 'scheduled' });
  }

  // Khateebs / announcements
  await ins(Khateeb, { tenantId, name: 'Ustad Abdul Latheef Faizy', qualifications: 'Faizy, MA Islamic Studies', contactNo: '9000000101', status: 'active' });
  await ins(Khateeb, { tenantId, name: 'Ustad Shamsudheen Nadwi', qualifications: 'Nadwi', contactNo: '9000000102', status: 'active' });
  await ins(Announcement, { tenantId, title: 'Ramadan Relief Kit Distribution', body: 'Relief kits will be distributed from the mahallu office after Asr. Families on the welfare list please collect.', category: 'welfare', audience: 'all', status: 'sent' });
  await ins(Announcement, { tenantId, title: 'Madrasa Annual Day', body: 'Annual day celebration next Sunday 4 PM at the mahallu hall. All families welcome.', category: 'program', audience: 'all', status: 'sent' });
  await ins(Announcement, { tenantId, title: 'Blood Donation Camp', body: 'Blood donation camp in association with the district blood bank. Register through the app.', category: 'announcement', audience: 'all', status: 'sent' });

  // Collections: 6 months
  const approved = families.filter((f) => f.status === 'approved');
  let receipt = 1;
  for (let mo = 5; mo >= 0; mo--) {
    for (const f of approved) {
      if (rnd() > 0.82) continue;
      const head = members.find((m) => String(m.familyId) === String(f._id) && m.isFamilyHead);
      await ins(Varisangya, { tenantId, familyId: f._id, memberId: head?._id, amount: f.varisangyaGrade === 'Grade A' ? 300 : f.varisangyaGrade === 'Grade B' ? 200 : 100, paymentDate: monthsAgo(mo, int(3, 20)), paymentMethod: pick(['Cash', 'Online', 'UPI']), receiptNo: `ZVAR${String(receipt++).padStart(4, '0')}`, remarks: 'Monthly varisangya' });
    }
  }
  const payers = members.filter((m) => m.isZakatPayer);
  let zr = 1;
  for (const p of payers) await ins(Zakat, { tenantId, payerName: p.name, payerId: p._id, amount: int(5, 40) * 1000, paymentDate: monthsAgo(int(0, 3), int(2, 25)), paymentMethod: pick(['Online', 'Cash', 'Bank']), receiptNo: `ZZAK${String(zr++).padStart(4, '0')}`, category: 'Zakat al-Mal', remarks: 'Annual zakat' });

  // Finance
  await ins(MahalluAccount, { tenantId, accountName: 'Mahallu Main Account', accountNumber: '3021 4455 8890', bankName: 'Kerala Gramin Bank', balance: 482350, status: 'active' });
  await ins(MasterWallet, { tenantId, name: 'General Fund', balance: 215000, type: 'main' });
  await ins(MasterWallet, { tenantId, name: 'Zakat Fund', balance: 168500, type: 'charity' });
  await ins(MasterWallet, { tenantId, name: 'Reserve Fund', balance: 98000, type: 'reserve' });
  const incCats = await Promise.all(['Varisangya', 'Zakat', 'Donations', 'Rent'].map((n) => ins(Category, { tenantId, name: n, type: 'income' })));
  const expCats = await Promise.all(['Salaries', 'Maintenance', 'Welfare Aid', 'Education'].map((n) => ins(Category, { tenantId, name: n, type: 'expense' })));
  const lIn = await ins(Ledger, { tenantId, name: 'Mahallu Income', type: 'income' });
  const lEx = await ins(Ledger, { tenantId, name: 'Mahallu Expenses', type: 'expense' });
  for (let mo = 5; mo >= 0; mo--) {
    for (const [i, c] of incCats.entries()) await ins(LedgerItem, { tenantId, ledgerId: lIn._id, date: monthsAgo(mo, 8 + i), amount: [38000, 22000, 15000, 12000][i] + int(0, 6000), type: 'income', description: `${c.name} - ${monthsAgo(mo).toLocaleString('en', { month: 'long' })}`, categoryId: c._id, paymentMethod: 'Bank', source: 'manual' });
    for (const [i, c] of expCats.entries()) await ins(LedgerItem, { tenantId, ledgerId: lEx._id, date: monthsAgo(mo, 12 + i), amount: [30000, 9000, 14000, 11000][i] + int(0, 4000), type: 'expense', description: `${c.name} - ${monthsAgo(mo).toLocaleString('en', { month: 'long' })}`, categoryId: c._id, paymentMethod: 'Bank', source: 'manual' });
  }

  // Welfare
  const schemes = [
    await ins(WelfareScheme, { tenantId, name: 'Medical Assistance', category: 'medical', description: 'Support for treatment costs', budgetAmount: 200000, status: 'active' }),
    await ins(WelfareScheme, { tenantId, name: 'Housing Repair Aid', category: 'housing', description: 'Roof and wall repairs', budgetAmount: 300000, status: 'active' }),
    await ins(WelfareScheme, { tenantId, name: 'Marriage Assistance', category: 'marriage_assistance', description: 'Support for daughters of needy families', budgetAmount: 150000, status: 'active' }),
    await ins(WelfareScheme, { tenantId, name: 'Monthly Food Kit', category: 'food', description: 'Ration kits for needy families', budgetAmount: 120000, status: 'active' }),
  ];
  const stat = ['pending', 'verified', 'approved', 'disbursed', 'disbursed', 'rejected'];
  const needy = families.filter((f) => f.economicStatus !== 'stable');
  for (const [i, f] of needy.entries()) {
    const s = stat[i % stat.length];
    await ins(WelfareApplication, { tenantId, schemeId: schemes[i % 4]._id, familyId: f._id, requestedAmount: int(5, 40) * 1000, reason: 'Family in need of support', priority: pick(['medium', 'high', 'urgent']), status: s, approvedAmount: ['approved', 'disbursed'].includes(s) ? int(5, 30) * 1000 : undefined, history: [{ status: 'pending', changedAt: monthsAgo(2) }] });
  }

  console.log('Done. Counts:', Object.fromEntries(Object.entries(manifest).map(([k, v]) => [k, v.length])));
  await mongoose.disconnect();
}
main().catch(async (e) => { console.error('SEED FAILED:', e.message); console.error('Partial manifest saved; run revert to clean.'); await mongoose.disconnect(); process.exit(1); });
