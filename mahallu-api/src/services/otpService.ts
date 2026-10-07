import crypto from 'crypto';
import OTP from '../models/OTP';

export const MAX_OTP_ATTEMPTS = 5;

export type OtpCheck = 'ok' | 'invalid' | 'locked' | 'none';

const safeEqual = (a: string, b: string): boolean => {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};

/**
 * Check a one-time code and consume it, atomically.
 *
 * The attempt is counted BEFORE the code is compared, with a single conditional update. The previous
 * read -> compare -> save sequence let a burst of parallel requests all read the same attempt count
 * and each get a guess; now at most MAX_OTP_ATTEMPTS comparisons can ever happen per code, however
 * the requests interleave. A correct code is consumed with a second conditional update, so two
 * simultaneous requests cannot both succeed with it.
 */
export const verifyAndConsumeOtp = async (normalizedPhone: string, code: unknown): Promise<OtpCheck> => {
  const candidate = await OTP.findOne({
    phone: normalizedPhone,
    isUsed: false,
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .select('_id attempts');

  if (!candidate) return 'none';

  const claimed: any = await OTP.findOneAndUpdate(
    { _id: candidate._id, isUsed: false, attempts: { $lt: MAX_OTP_ATTEMPTS } },
    { $inc: { attempts: 1 } },
    { new: true }
  );
  if (!claimed) return 'locked';

  if (typeof code !== 'string' || !safeEqual(claimed.code, code)) {
    return claimed.attempts >= MAX_OTP_ATTEMPTS ? 'locked' : 'invalid';
  }

  const consumed = await OTP.findOneAndUpdate({ _id: claimed._id, isUsed: false }, { isUsed: true });
  return consumed ? 'ok' : 'none';
};
