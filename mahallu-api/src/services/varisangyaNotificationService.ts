import mongoose, { Schema } from 'mongoose';
import { Varisangya, IVarisangya, IZakat } from '../models/Collectible';
import Family from '../models/Family';
import Member from '../models/Member';
import Tenant from '../models/Tenant';
import { sendWhatsAppMessage } from './dxingService';

// Durable "reminder already sent this month" flag, survives restarts
const ReminderLog = mongoose.model(
  'ReminderLog',
  new Schema(
    {
      tenantId: { type: Schema.Types.ObjectId, required: true },
      month: { type: String, required: true }, // 'YYYY-MM'
    },
    { timestamps: true }
  ).index({ tenantId: 1, month: 1 }, { unique: true })
);

export interface FamilyDue {
  familyId: string;
  houseName: string;
  familyHead?: string;
  contactNo?: string;
  varisangyaGrade?: string;
  monthlyAmount: number;
  expectedAmount: number;
  paidAmount: number;
  dueAmount: number;
}

const monthlyAmountFor = (
  grade: string | undefined,
  tenant: { settings?: { varisangyaAmount?: number; varisangyaGrades?: Array<{ name: string; amount: number }> } }
): number => {
  const grades = tenant.settings?.varisangyaGrades || [];
  const match = grade ? grades.find((g) => g.name === grade) : undefined;
  return match?.amount ?? tenant.settings?.varisangyaAmount ?? 0;
};

/**
 * Live dues per family for the current calendar year:
 * due = monthlyAmount * monthsElapsed - paidThisYear
 */
// ponytail: dues scoped to current calendar year; carry-forward of past-year arrears needs an opening-balance field if ever required
export const computeFamilyDues = async (tenantId: string | mongoose.Types.ObjectId): Promise<FamilyDue[]> => {
  const tenant = await Tenant.findById(tenantId).select('settings').lean();
  if (!tenant) return [];

  const now = new Date();
  const monthsElapsed = now.getMonth() + 1;
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [families, paidRows] = await Promise.all([
    Family.find({ tenantId, status: 'approved' })
      .select('houseName familyHead contactNo varisangyaGrade')
      .lean(),
    Varisangya.aggregate([
      {
        $match: {
          tenantId: new mongoose.Types.ObjectId(String(tenantId)),
          familyId: { $ne: null },
          paymentDate: { $gte: yearStart },
        },
      },
      { $group: { _id: '$familyId', paid: { $sum: '$amount' } } },
    ]),
  ]);

  const paidMap = new Map<string, number>(paidRows.map((r: any) => [String(r._id), r.paid]));

  return families.map((f: any) => {
    const monthlyAmount = monthlyAmountFor(f.varisangyaGrade, tenant as any);
    const expectedAmount = monthlyAmount * monthsElapsed;
    const paidAmount = paidMap.get(String(f._id)) || 0;
    return {
      familyId: String(f._id),
      houseName: f.houseName,
      familyHead: f.familyHead,
      contactNo: f.contactNo,
      varisangyaGrade: f.varisangyaGrade,
      monthlyAmount,
      expectedAmount,
      paidAmount,
      dueAmount: Math.max(0, expectedAmount - paidAmount),
    };
  });
};

const tenantName = async (tenantId: mongoose.Types.ObjectId): Promise<string> => {
  const t = await Tenant.findById(tenantId).select('name').lean();
  return t?.name || 'Mahallu';
};

/** WhatsApp receipt after an admin records a varisangya payment. Fire-and-forget. */
export const sendVarisangyaReceipt = async (varisangya: IVarisangya): Promise<void> => {
  try {
    let phone: string | undefined;
    let payer = '';

    if (varisangya.familyId) {
      const family = await Family.findById(varisangya.familyId).select('houseName contactNo').lean();
      phone = family?.contactNo;
      payer = family?.houseName || '';
    } else if (varisangya.memberId) {
      const member = await Member.findById(varisangya.memberId).select('name phone').lean();
      phone = member?.phone;
      payer = member?.name || '';
    }
    if (!phone) return;

    const name = await tenantName(varisangya.tenantId);
    const message =
      `*${name}*\n` +
      `Varisangya payment received.\n\n` +
      `Payer: ${payer}\n` +
      `Amount: ₹${varisangya.amount}\n` +
      `Receipt No: ${varisangya.receiptNo || 'N/A'}\n` +
      `Date: ${new Date(varisangya.paymentDate).toLocaleDateString('en-IN')}\n\n` +
      `Thank you. / നന്ദി.`;

    await sendWhatsAppMessage(phone, message);
  } catch (err: any) {
    console.error('[WhatsApp receipt] varisangya send failed:', err?.message || err);
  }
};

/** WhatsApp receipt after an admin records a zakat payment. Fire-and-forget. */
export const sendZakatReceipt = async (zakat: IZakat): Promise<void> => {
  try {
    let phone: string | undefined;
    if (zakat.payerId) {
      const member = await Member.findById(zakat.payerId).select('phone').lean();
      phone = member?.phone;
    }
    if (!phone) return;

    const name = await tenantName(zakat.tenantId);
    const message =
      `*${name}*\n` +
      `Zakat payment received.\n\n` +
      `Payer: ${zakat.payerName}\n` +
      `Amount: ₹${zakat.amount}\n` +
      `Receipt No: ${zakat.receiptNo || 'N/A'}\n` +
      `Date: ${new Date(zakat.paymentDate).toLocaleDateString('en-IN')}\n\n` +
      `Thank you. / നന്ദി.`;

    await sendWhatsAppMessage(phone, message);
  } catch (err: any) {
    console.error('[WhatsApp receipt] zakat send failed:', err?.message || err);
  }
};

const REMINDER_DAY = Number(process.env.VARISANGYA_REMINDER_DAY || 5); // day of month
const REMINDER_HOUR = Number(process.env.VARISANGYA_REMINDER_HOUR || 10); // local hour

const runMonthlyReminders = async (): Promise<void> => {
  const now = new Date();
  if (now.getDate() !== REMINDER_DAY || now.getHours() < REMINDER_HOUR) return;

  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const tenants = await Tenant.find({ status: 'active' }).select('name').lean();

  for (const tenant of tenants) {
    // Unique index makes this the send-once guard per tenant per month
    try {
      await ReminderLog.create({ tenantId: tenant._id, month });
    } catch {
      continue; // already sent this month
    }

    const dues = (await computeFamilyDues(tenant._id as any)).filter((d) => d.dueAmount > 0 && d.contactNo);
    console.info(`[Reminder] ${tenant.name}: sending ${dues.length} varisangya reminders for ${month}`);

    for (const due of dues) {
      const message =
        `*${tenant.name}*\n` +
        `Varisangya reminder / മാസവരി ഓർമ്മപ്പെടുത്തൽ\n\n` +
        `House: ${due.houseName}\n` +
        `Pending amount: ₹${due.dueAmount}\n\n` +
        `Please pay at the Mahallu office or through the member portal.`;
      try {
        await sendWhatsAppMessage(due.contactNo as string, message);
      } catch (err: any) {
        console.error(`[Reminder] failed for ${due.houseName}:`, err?.message || err);
      }
      // ponytail: 1s gap to stay under gateway rate limits; queue it if volumes grow
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
};

/** Hourly tick; sends monthly varisangya reminders on the configured day. */
export const startVarisangyaReminderScheduler = (): void => {
  // ponytail: setInterval instead of a cron dep; durable ReminderLog flag prevents double sends across restarts
  setInterval(() => {
    runMonthlyReminders().catch((err) => console.error('[Reminder] scheduler error:', err?.message || err));
  }, 60 * 60 * 1000);
  console.info(`[Reminder] Varisangya reminder scheduler started (day ${REMINDER_DAY}, hour ${REMINDER_HOUR})`);
};
