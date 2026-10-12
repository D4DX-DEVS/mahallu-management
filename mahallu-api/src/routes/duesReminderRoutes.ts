import express, { Response } from 'express';
import mongoose from 'mongoose';
import { authMiddleware, allowRoles, AuthRequest } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';
import ReminderRun from '../models/ReminderRun';
import { sendRemindersNow, whatsappSendingEnabled } from '../services/varisangyaNotificationService';

/**
 * Mounted at /api/collectibles/dues/reminders (see index.ts), registered before collectibleRoutes.
 *  POST /send    {dryRun?, familyIds?}  preview or send reminders now
 *  GET  /history                        recent runs (automatic and manual)
 */
const router = express.Router();
router.use(authMiddleware, tenantMiddleware, tenantFilter);
router.use(allowRoles(['super_admin', 'mahall']));

// Small in-memory limiter: real sends 1 per 2 minutes per tenant, previews 20 per minute.
const lastSend = new Map<string, number>();
const previewHits = new Map<string, number[]>();
const SEND_COOLDOWN_MS = 2 * 60 * 1000;

const tenantOf = (req: AuthRequest) => req.tenantId || (req.isSuperAdmin ? (req.query.tenantId as string) : undefined);

router.post('/send', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = tenantOf(req);
    if (!tenantId || !mongoose.Types.ObjectId.isValid(tenantId)) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }
    // Safe default: anything but an explicit dryRun:false is a preview
    const dryRun = !(req.body?.dryRun === false || req.body?.dryRun === 'false');
    const familyIds: string[] | undefined = Array.isArray(req.body?.familyIds)
      ? req.body.familyIds.map(String).filter((id: string) => mongoose.Types.ObjectId.isValid(id)).slice(0, 2000)
      : undefined;

    const now = Date.now();
    if (dryRun) {
      const hits = (previewHits.get(tenantId) || []).filter((t) => t > now - 60_000);
      if (hits.length >= 20) return res.status(429).json({ success: false, message: 'Too many previews. Please wait a minute.' });
      previewHits.set(tenantId, [...hits, now]);
    } else {
      const last = lastSend.get(tenantId) || 0;
      if (now - last < SEND_COOLDOWN_MS) {
        return res.status(429).json({ success: false, message: 'Reminders were just sent. Please wait two minutes before sending again.' });
      }
      lastSend.set(tenantId, now);
    }

    const out = await sendRemindersNow(tenantId, {
      dryRun,
      familyIds,
      triggeredBy: req.user?._id ? String(req.user._id) : undefined,
      background: true, // a big list takes minutes at the gateway's pace: respond now, progress is in /history
    });
    // The full message list is only returned for previews (and trimmed for real sends)
    res.json({
      success: true,
      data: {
        dryRun: out.dryRun,
        totalWithDues: out.totalWithDues,
        willSend: out.recipients.length,
        skippedNoPhone: out.skippedNoPhone,
        sent: out.sent,
        failed: out.failed,
        runId: out.runId,
        delivery: whatsappSendingEnabled() ? 'whatsapp' : 'dev-stub',
        sample: out.recipients.slice(0, dryRun ? 200 : 0).map((r) => ({
          familyId: r.familyId, houseName: r.houseName, phone: `******${r.phone.slice(-4)}`, amount: r.amount, message: r.message,
        })),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/history', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = tenantOf(req);
    if (!tenantId || !mongoose.Types.ObjectId.isValid(tenantId)) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required' });
    }
    const runs = await ReminderRun.find({ tenantId: new mongoose.Types.ObjectId(tenantId) })
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(req.query.limit) || 24, 100))
      .lean();
    res.json({ success: true, data: runs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
