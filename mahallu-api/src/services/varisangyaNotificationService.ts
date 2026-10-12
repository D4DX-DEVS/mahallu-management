import mongoose, { Schema } from 'mongoose';
import { IVarisangya, IZakat } from '../models/Collectible';
import Family from '../models/Family';
import Member from '../models/Member';
import Tenant from '../models/Tenant';
import ReminderRun from '../models/ReminderRun';
import { sendWhatsAppMessage, normalizeIndianPhone } from './dxingService';
import { computeFamilyDues, FamilyDue, istParts, monthKey, parseMonthKey, toMonthIndex } from './duesService';

// Re-exported so existing imports keep working; the engine now lives in duesService.ts
export { computeFamilyDues };
export type { FamilyDue };

// Legacy "reminder already sent this month" flag (pre-reminderRuns). Read-only now: honoured so a
// deploy in the middle of a month does not resend what the old scheduler already sent.
const ReminderLog = mongoose.models.ReminderLog || mongoose.model(
  'ReminderLog',
  new Schema(
    { tenantId: { type: Schema.Types.ObjectId, required: true }, month: { type: String, required: true } },
    { timestamps: true }
  ).index({ tenantId: 1, month: 1 }, { unique: true })
);

/**
 * WhatsApp delivery guard. A development server (NODE_ENV=development) never sends real messages
 * unless DUES_WHATSAPP_ENABLED=1; it logs instead. Production behaviour is unchanged.
 */
export const whatsappSendingEnabled = (): boolean =>
  process.env.NODE_ENV !== 'development' || process.env.DUES_WHATSAPP_ENABLED === '1';

export type WhatsAppSender = (phone: string, message: string) => Promise<unknown>;

const deliver: WhatsAppSender = async (phone, message) => {
  if (!whatsappSendingEnabled()) {
    console.info(`[WhatsApp:dev-stub] would send ${message.length} chars to ***${String(phone).slice(-4)}`);
    return { stubbed: true };
  }
  return sendWhatsAppMessage(phone, message);
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

    await deliver(phone, message);
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

    await deliver(phone, message);
  } catch (err: any) {
    console.error('[WhatsApp receipt] zakat send failed:', err?.message || err);
  }
};


// ---------------------------------------------------------------------------
// Monthly dues reminders (catch-up scheduler + manual send)
// ---------------------------------------------------------------------------

const DEFAULT_REMINDER_DAY = Number(process.env.VARISANGYA_REMINDER_DAY || 5);
const REMINDER_HOUR = Number(process.env.VARISANGYA_REMINDER_HOUR || 10); // IST
const STALE_CLAIM_MS = 2 * 60 * 60 * 1000; // a 'sending' claim older than this is presumed crashed
const SEND_GAP_MS = Number(process.env.DUES_REMINDER_GAP_MS || 1000); // gateway rate limit

const MONTH_NAMES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_NAMES_ML = ['ജനുവരി', 'ഫെബ്രുവരി', 'മാർച്ച്', 'ഏപ്രിൽ', 'മേയ്', 'ജൂൺ', 'ജൂലൈ', 'ഓഗസ്റ്റ്', 'സെപ്റ്റംബർ', 'ഒക്ടോബർ', 'നവംബർ', 'ഡിസംബർ'];
const monthLabel = (key: string | null, names: string[]) => {
  const idx = parseMonthKey(key);
  return idx === undefined ? '' : `${names[idx % 12]} ${Math.floor(idx / 12)}`;
};

/** User-centred bilingual reminder: what is due, how much, how to pay, thanks. Pure. */
export const buildReminderMessage = (tenantName: string, due: FamilyDue): string => {
  const amount = `₹${due.dueAmount.toLocaleString('en-IN')}`;
  const sinceEn = monthLabel(due.oldestUnpaidMonth, MONTH_NAMES_EN);
  const sinceMl = monthLabel(due.oldestUnpaidMonth, MONTH_NAMES_ML);
  const partial = due.oldestMonthBalance > 0 && due.oldestMonthBalance < due.monthlyAmount;
  return (
    `*${tenantName}*\n\n` +
    `അസ്സലാമു അലൈക്കും, ${due.houseName}.\n` +
    `നിങ്ങളുടെ മാസവരി (വരിസംഖ്യ) ബാക്കി: *${amount}*` +
    (sinceMl ? ` (${sinceMl} മുതൽ${partial ? ', ഭാഗികമായി അടച്ചത് കുറച്ച്' : ''})` : '') +
    `.\nമഹല്ല് ഓഫീസിൽ, ശേഖരണ പ്രതിനിധിയുടെ അടുത്ത്, അല്ലെങ്കിൽ മെമ്പർ പോർട്ടൽ വഴി അടക്കാം. ` +
    `ഇതിനകം അടച്ചിട്ടുണ്ടെങ്കിൽ ഈ സന്ദേശം ഒഴിവാക്കുക. നന്ദി.\n\n` +
    `Assalamu alaikum, ${due.houseName}.\n` +
    `Your monthly varisangya balance is *${amount}*` +
    (sinceEn ? ` (since ${sinceEn}${partial ? ', after your part payment' : ''})` : '') +
    `.\nYou can pay at the Mahallu office, with your collector, or through the member portal. ` +
    `If you have already paid, please ignore this message. Thank you.`
  );
};

export interface ReminderRecipient {
  familyId: string;
  houseName: string;
  phone: string;
  amount: number;
  message: string;
}
export interface ReminderOutcome {
  dryRun: boolean;
  totalWithDues: number;
  recipients: ReminderRecipient[]; // who would be / was messaged
  sent: number;
  failed: number;
  skippedNoPhone: number;
}

/** Collect who should be reminded: dues > 0 and a valid phone number. Pure given its input. */
export const selectRecipients = (tenantName: string, dues: FamilyDue[], familyIds?: string[]) => {
  const wanted = familyIds?.length ? new Set(familyIds.map(String)) : null;
  const withDues = dues.filter((d) => d.dueAmount > 0 && (!wanted || wanted.has(d.familyId)));
  const recipients: ReminderRecipient[] = [];
  let skippedNoPhone = 0;
  for (const d of withDues) {
    let phone: string | undefined;
    try {
      phone = d.contactNo ? normalizeIndianPhone(d.contactNo).normalized : undefined;
    } catch {
      phone = undefined;
    }
    if (!phone) {
      skippedNoPhone += 1;
      continue;
    }
    recipients.push({ familyId: d.familyId, houseName: d.houseName, phone, amount: d.dueAmount, message: buildReminderMessage(tenantName, d) });
  }
  return { totalWithDues: withDues.length, recipients, skippedNoPhone };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const deliverAll = async (recipients: ReminderRecipient[], sender: WhatsAppSender, gapMs: number) => {
  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    try {
      await sender(r.phone, r.message);
      sent += 1;
    } catch (err: any) {
      failed += 1;
      console.error(`[Reminder] failed for ${r.houseName}:`, err?.message || err);
    }
    if (gapMs > 0) await sleep(gapMs);
  }
  return { sent, failed };
};

/**
 * Preview or send reminders for one tenant right now (used by the admin endpoint).
 * dryRun computes recipients and messages and sends nothing. Real sends are logged as a 'manual' run.
 */
export const sendRemindersNow = async (
  tenantId: string,
  opts: { dryRun?: boolean; familyIds?: string[]; triggeredBy?: string; sender?: WhatsAppSender; gapMs?: number; background?: boolean } = {}
): Promise<ReminderOutcome & { runId?: string }> => {
  const tenant = await Tenant.findById(tenantId).select('name').lean();
  if (!tenant) throw new Error('Tenant not found');
  const dues = await computeFamilyDues(tenantId);
  const sel = selectRecipients(tenant.name || 'Mahallu', dues, opts.familyIds);
  const base = { totalWithDues: sel.totalWithDues, recipients: sel.recipients, skippedNoPhone: sel.skippedNoPhone };
  if (opts.dryRun) return { dryRun: true, ...base, sent: 0, failed: 0 };

  const p = istParts();
  const run = await ReminderRun.create({
    tenantId, mode: 'manual', month: monthKey(toMonthIndex(p.year, p.month0)), state: 'sending',
    skipped: sel.skippedNoPhone, triggeredBy: opts.triggeredBy,
  });
  const work = async () => {
    const r = await deliverAll(sel.recipients, opts.sender || deliver, opts.gapMs ?? SEND_GAP_MS);
    await ReminderRun.updateOne({ _id: run._id }, { $set: { state: 'sent', sentAt: new Date(), count: r.sent, failed: r.failed } });
    return r;
  };
  if (opts.background) {
    work().catch((e) => console.error('[Reminder] manual run error:', e?.message || e));
    return { dryRun: false, ...base, sent: 0, failed: 0, runId: String(run._id) };
  }
  const r = await work();
  return { dryRun: false, ...base, ...r, runId: String(run._id) };
};

/** Atomically claim this tenant's automatic run for `month`. True = this caller owns the send. */
export const claimAutoRun = async (tenantId: mongoose.Types.ObjectId | string, month: string, now = new Date()): Promise<boolean> => {
  const tid = new mongoose.Types.ObjectId(String(tenantId));
  if (await ReminderLog.exists({ tenantId: tid, month })) return false; // legacy scheduler already sent
  try {
    const existing = await ReminderRun.findOneAndUpdate(
      { tenantId: tid, month, mode: 'auto' },
      { $setOnInsert: { state: 'sending', claimedAt: now, count: 0, failed: 0, skipped: 0 } },
      { upsert: true, new: false }
    );
    if (existing === null) return true; // we inserted it: we own it
  } catch (e: any) {
    if (e?.code !== 11000) throw e; // lost the upsert race to another instance
    return false;
  }
  // Someone claimed it earlier. Take over only a crashed claim (still 'sending' and stale).
  const stale = await ReminderRun.findOneAndUpdate(
    { tenantId: tid, month, mode: 'auto', state: 'sending', claimedAt: { $lt: new Date(now.getTime() - STALE_CLAIM_MS) } },
    { $set: { claimedAt: now } }
  );
  return !!stale;
};

/**
 * Catch-up check for one tenant. Sends once per month when today >= configured day and hour >= 10 IST,
 * so a server that was down on the 5th still sends on the 6th, 7th, ... Idempotent via claimAutoRun.
 */
export const runTenantMonthlyReminder = async (
  tenant: { _id: any; name?: string; settings?: any },
  opts: { now?: Date; sender?: WhatsAppSender; dryRun?: boolean; gapMs?: number } = {}
): Promise<{ status: 'not_yet' | 'disabled' | 'already_sent' | 'dry_run' | 'sent'; count: number; failed: number; recipients?: number }> => {
  const now = opts.now || new Date();
  if (tenant.settings?.varisangyaRemindersEnabled === false) return { status: 'disabled', count: 0, failed: 0 };
  const p = istParts(now);
  const day = Math.min(28, Math.max(1, Number(tenant.settings?.varisangyaReminderDay) || DEFAULT_REMINDER_DAY));
  if (p.day < day || p.hour < REMINDER_HOUR) return { status: 'not_yet', count: 0, failed: 0 };

  const month = monthKey(toMonthIndex(p.year, p.month0));
  const name = tenant.name || 'Mahallu';

  if (opts.dryRun) {
    const sel = selectRecipients(name, await computeFamilyDues(tenant._id, now));
    console.info(`[Reminder:dry-run] ${name}: ${sel.recipients.length} reminders would go out for ${month}`);
    return { status: 'dry_run', count: 0, failed: 0, recipients: sel.recipients.length };
  }

  if (!(await claimAutoRun(tenant._id, month, now))) return { status: 'already_sent', count: 0, failed: 0 };

  const sel = selectRecipients(name, await computeFamilyDues(tenant._id, now));
  console.info(`[Reminder] ${name}: sending ${sel.recipients.length} varisangya reminders for ${month}`);
  const r = await deliverAll(sel.recipients, opts.sender || deliver, opts.gapMs ?? SEND_GAP_MS);
  await ReminderRun.updateOne(
    { tenantId: tenant._id, month, mode: 'auto' },
    { $set: { state: 'sent', sentAt: new Date(), count: r.sent, failed: r.failed, skipped: sel.skippedNoPhone } }
  );
  return { status: 'sent', count: r.sent, failed: r.failed, recipients: sel.recipients.length };
};

export const runMonthlyReminders = async (): Promise<void> => {
  // A dev server (WhatsApp stubbed) or DUES_REMINDER_DRY_RUN=1 must never claim a month: dev instances
  // often share the production database, and a claim would stop the real scheduler from sending.
  const dryRun = process.env.DUES_REMINDER_DRY_RUN === '1' || !whatsappSendingEnabled();
  const tenants = await Tenant.find({ status: 'active' }).select('name settings').lean();
  for (const t of tenants) {
    try {
      await runTenantMonthlyReminder(t as any, { dryRun });
    } catch (err: any) {
      console.error(`[Reminder] ${t.name} failed:`, err?.message || err);
    }
  }
};

/** Hourly catch-up tick (plus one shortly after boot). Safe on many instances: the DB claim decides. */
export const startVarisangyaReminderScheduler = (): void => {
  const tick = () => runMonthlyReminders().catch((err) => console.error('[Reminder] scheduler error:', err?.message || err));
  setInterval(tick, 60 * 60 * 1000);
  setTimeout(tick, 60 * 1000); // catch up after a restart/outage without waiting a full hour
  console.info(
    `[Reminder] Varisangya catch-up scheduler started (from day ${DEFAULT_REMINDER_DAY}, ${REMINDER_HOUR}:00 IST` +
      `${process.env.DUES_REMINDER_DRY_RUN === '1' ? ', DRY RUN' : ''}${whatsappSendingEnabled() ? '' : ', dev: WhatsApp stubbed'})`
  );
};
