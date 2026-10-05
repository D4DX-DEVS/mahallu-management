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

export async function sendPushNotification({
  title,
  message,
  imageUrl,
  playerIds,
}: SendPushOptions): Promise<void> {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !apiKey) {
    console.warn('[OneSignal] Missing credentials, skipping push notification');
    return;
  }

  const payload: Record<string, any> = {
    app_id: appId,
    headings: { en: title },
    contents: { en: message },
  };

  // Never fall back to OneSignal's "Subscribed Users" segment: that is every device of every
  // Mahallu on the platform. An empty audience means there is nobody to notify, not everybody.
  if (!playerIds || playerIds.length === 0) {
    return;
  }
  payload.include_player_ids = playerIds;

  if (imageUrl) {
    payload.chrome_web_image = imageUrl;
    payload.big_picture = imageUrl;
    payload.ios_attachments = { id1: imageUrl };
  }

  await axios.post('https://onesignal.com/api/v1/notifications', payload, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${apiKey}`,
    },
  });
}

export function sendPushSilent(options: SendPushOptions): void {
  sendPushNotification(options).catch((err) => {
    console.error('[OneSignal] Push failed:', err?.response?.data || err.message);
  });
}
