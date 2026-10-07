import axios from 'axios';
import User from '../models/User';

interface SendPushOptions {
  title: string;
  message: string;
  imageUrl?: string;
  playerIds?: string[];
}

/** Registered device ids for one Mahallu's users - the only audience a push may target. */
export async function getTenantPlayerIds(tenantId: unknown): Promise<string[]> {
  if (!tenantId) return [];
  const users = await User.find({ tenantId, oneSignalPlayerId: { $exists: true, $ne: null } }).select('oneSignalPlayerId');
  return users.map((u: any) => u.oneSignalPlayerId).filter((id: any): id is string => Boolean(id));
}

/** A call to the push provider never waits longer than this. */
export const PUSH_TIMEOUT_MS = 10_000;
/** OneSignal accepts at most this many device ids per request. */
const PUSH_BATCH_SIZE = 2000;

/**
 * Send a push to the given devices.
 *
 * Resolves with the number of devices the provider ACCEPTED the push for; 0 means nothing was sent
 * (credentials missing, or nobody to send to). Throws only when every request failed (timeout,
 * provider error), so a caller that needs to know can tell "nobody reached" from "delivered"; the
 * fire-and-forget `sendPushSilent` never throws. Each request is bounded by PUSH_TIMEOUT_MS.
 */
export async function sendPushNotification({
  title,
  message,
  imageUrl,
  playerIds,
}: SendPushOptions): Promise<number> {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !apiKey) {
    console.warn('[OneSignal] Missing credentials, skipping push notification');
    return 0;
  }

  const payload: Record<string, any> = {
    app_id: appId,
    headings: { en: title },
    contents: { en: message },
  };

  // Never fall back to OneSignal's "Subscribed Users" segment: that is every device of every
  // Mahallu on the platform. An empty audience means there is nobody to notify, not everybody.
  if (!playerIds || playerIds.length === 0) {
    return 0;
  }

  if (imageUrl) {
    payload.chrome_web_image = imageUrl;
    payload.big_picture = imageUrl;
    payload.ios_attachments = { id1: imageUrl };
  }

  let accepted = 0;
  let lastError: unknown;
  for (let i = 0; i < playerIds.length; i += PUSH_BATCH_SIZE) {
    const batch = playerIds.slice(i, i + PUSH_BATCH_SIZE);
    try {
      await axios.post(
        'https://onesignal.com/api/v1/notifications',
        { ...payload, include_player_ids: batch },
        {
          timeout: PUSH_TIMEOUT_MS,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${apiKey}`,
          },
        }
      );
      accepted += batch.length;
    } catch (err) {
      lastError = err;
    }
  }
  if (accepted === 0 && lastError) throw lastError;
  return accepted;
}

export function sendPushSilent(options: SendPushOptions): void {
  sendPushNotification(options).catch((err) => {
    // Only the message is logged: the provider's response body and request config can carry credentials.
    console.error('[OneSignal] Push failed:', err?.code || err?.message);
  });
}
