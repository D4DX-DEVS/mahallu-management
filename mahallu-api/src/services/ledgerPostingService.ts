import mongoose from 'mongoose';
import { LedgerItem, Ledger, InstituteAccount, MahalluAccount } from '../models/MasterAccount';

interface PostLedgerEntryParams {
  tenantId: string | mongoose.Types.ObjectId;
  instituteId?: string | mongoose.Types.ObjectId;
  ledgerName: string;
  ledgerType: 'income' | 'expense';
  amount: number;
  description: string;
  date: Date;
  source: 'salary' | 'varisangya' | 'zakat' | 'petty_cash' | 'manual' | 'welfare' | 'zakat_distribution';
  sourceId: mongoose.Types.ObjectId;
  paymentMethod?: string;
  referenceNo?: string;
  categoryName?: string;
}

/**
 * Find or create a ledger by name and type for the given tenant.
 * This avoids requiring pre-configuration of ledgers for auto-posting.
 */
async function findOrCreateLedger(
  tenantId: mongoose.Types.ObjectId,
  instituteId: mongoose.Types.ObjectId | undefined,
  name: string,
  type: 'income' | 'expense'
): Promise<mongoose.Types.ObjectId> {
  const query: any = { tenantId, name, type };
  if (instituteId) query.instituteId = instituteId;

  let ledger = await Ledger.findOne(query);
  if (!ledger) {
    ledger = new Ledger({
      tenantId,
      instituteId: instituteId || null,
      name,
      type,
      description: `Auto-created ledger for ${type} - ${name}`,
    });
    await ledger.save();
  }
  return ledger._id as mongoose.Types.ObjectId;
}

/**
 * Post a ledger entry automatically when a transaction occurs.
 * Also updates the InstituteAccount balance if applicable.
 */
export async function postLedgerEntry(params: PostLedgerEntryParams): Promise<void> {
  const tenantId = new mongoose.Types.ObjectId(String(params.tenantId));
  const instituteId = params.instituteId
    ? new mongoose.Types.ObjectId(String(params.instituteId))
    : undefined;

  // Find or create the appropriate ledger
  const ledgerId = await findOrCreateLedger(tenantId, instituteId, params.ledgerName, params.ledgerType);

  // Create the ledger item
  const item = new LedgerItem({
    tenantId,
    instituteId: instituteId || null,
    ledgerId,
    date: params.date,
    amount: params.amount,
    type: params.ledgerType,
    description: params.description,
    paymentMethod: params.paymentMethod,
    referenceNo: params.referenceNo,
    source: params.source,
    sourceId: params.sourceId,
  });
  await item.save();

  // Update the first active institute account balance (not all accounts)
  if (instituteId) {
    const balanceChange = params.ledgerType === 'income' ? params.amount : -params.amount;
    const account = await InstituteAccount.findOne({ tenantId, instituteId, status: 'active' }).sort({ createdAt: 1 });
    if (account) {
      await InstituteAccount.findByIdAndUpdate(account._id, { $inc: { balance: balanceChange } });
    }
  } else {
    // Mahallu-level entry: update MahalluAccount balance
    const balanceChange = params.ledgerType === 'income' ? params.amount : -params.amount;
    const account = await MahalluAccount.findOne({ tenantId, status: 'active' }).sort({ createdAt: 1 });
    if (account) {
      await MahalluAccount.findByIdAndUpdate(account._id, { $inc: { balance: balanceChange } });
    }
  }
}

/**
 * Reverse a previously posted ledger entry (e.g., when deleting the source transaction).
 */
export async function reverseLedgerEntry(
  source: 'salary' | 'varisangya' | 'zakat',
  sourceId: mongoose.Types.ObjectId
): Promise<void> {
  const entries = await LedgerItem.find({ source, sourceId });

  for (const entry of entries) {
    // Reverse the balance change on the first active institute account
    if (entry.instituteId) {
      const reverseChange = entry.type === 'income' ? -entry.amount : entry.amount;
      const account = await InstituteAccount.findOne(
        { tenantId: entry.tenantId, instituteId: entry.instituteId, status: 'active' }
      ).sort({ createdAt: 1 });
      if (account) {
        await InstituteAccount.findByIdAndUpdate(account._id, { $inc: { balance: reverseChange } });
      }
    } else {
      // Mahallu-level: reverse MahalluAccount balance
      const reverseChange = entry.type === 'income' ? -entry.amount : entry.amount;
      const account = await MahalluAccount.findOne({ tenantId: entry.tenantId, status: 'active' }).sort({ createdAt: 1 });
      if (account) {
        await MahalluAccount.findByIdAndUpdate(account._id, { $inc: { balance: reverseChange } });
      }
    }
  }

  // Delete the auto-posted entries
  await LedgerItem.deleteMany({ source, sourceId });
}
