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
/** OneSignal accepts at most this many ids per request. */
export const PUSH_BATCH_SIZE = 2000;
export const ONESIGNAL_URL = 'https://api.onesignal.com/notifications';

const credentials = (): { appId: string; apiKey: string } | null => {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;
  if (!appId || !apiKey) return null;
  return { appId, apiKey };
};

/** v2 App API keys (os_v2_...) use the `Key` scheme; older REST API keys still use `Basic`. */
const authHeader = (apiKey: string): string => (apiKey.startsWith('os_v2_') ? `Key ${apiKey}` : `Basic ${apiKey}`);

const chunk = <T>(items: T[], size = PUSH_BATCH_SIZE): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

const post = (apiKey: string, body: Record<string, any>) =>
  axios.post(ONESIGNAL_URL, body, {
    timeout: PUSH_TIMEOUT_MS,
    headers: { 'Content-Type': 'application/json', Authorization: authHeader(apiKey) },
  });

const contentOf = (title: string, message: string, imageUrl?: string): Record<string, any> => ({
  target_channel: 'push',
  headings: { en: title },
  contents: { en: message },
  ...(imageUrl ? { big_picture: imageUrl, chrome_web_image: imageUrl, ios_attachments: { id1: imageUrl } } : {}),
});

/**
 * Send a push to the given devices (OneSignal subscription / player ids).
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
  const creds = credentials();
  if (!creds) {
    console.warn('[OneSignal] Missing credentials, skipping push notification');
    return 0;
  }

  // Never fall back to OneSignal's "Subscribed Users" segment: that is every device of every
  // Mahallu on the platform. An empty audience means there is nobody to notify, not everybody.
  if (!playerIds || playerIds.length === 0) {
    return 0;
  }

  const payload = { app_id: creds.appId, ...contentOf(title, message, imageUrl) };
  let accepted = 0;
  let lastError: unknown;
  for (const batch of chunk(playerIds)) {
    try {
      await post(creds.apiKey, { ...payload, include_subscription_ids: batch });
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

export interface PushUser {
  _id: unknown;
  oneSignalPlayerId?: string | null;
}

export interface PushResult {
  /** sent: every target reached; partial: some; failed: none (provider error); skipped: nothing to send. */
  status: 'sent' | 'partial' | 'failed' | 'skipped';
  /** OneSignal notification ids, one per accepted request. */
  ids: string[];
  /** Users the push was accepted for. */
  recipients: number;
  error?: string;
}

/** External ids OneSignal did not know (the user never signed in on a device with OneSignal.login). */
const invalidExternalIds = (data: any, batch: string[]): string[] => {
  const errors = data?.errors;
  if (Array.isArray(errors) && !data?.id) return batch; // e.g. "All included players are not subscribed"
  const invalid = errors?.invalid_aliases?.external_id;
  return Array.isArray(invalid) ? invalid.map(String) : [];
};

/**
 * Why a push failed, as stored in the notification's pushError: the HTTP status plus OneSignal's own
 * explanation when it sent one ("403: Access denied …"). A bare "403" could not say whether the key,
 * the app id or the audience was wrong. Anything shaped like an API key is masked, because pushError
 * is returned to admins.
 */
const reason = (err: any): string => {
  const status = err?.response?.status;
  const errors = err?.response?.data?.errors;
  const detail = Array.isArray(errors)
    ? errors.join('; ')
    : errors && typeof errors === 'object'
      ? JSON.stringify(errors)
      : '';
  const text = status ? (detail ? `${status}: ${detail}` : String(status)) : String(err?.code || err?.message || 'error');
  return text.replace(/os_v2_[A-Za-z0-9_-]+/g, '[key]').slice(0, 200);
};

/**
 * Push to users of the app, addressed by their user id: the app calls OneSignal.login(userId), so the
 * user id is the OneSignal external_id. A user OneSignal does not know by external_id is retried by the
 * device id saved through PUT /auth/register-device (oneSignalPlayerId), if there is one.
 *
 * Never throws: the outcome (and any provider error, without credentials) is in the result.
 */
export async function sendPushToUsers(
  users: PushUser[],
  content: { title: string; message: string; imageUrl?: string; data?: Record<string, any> }
): Promise<PushResult> {
  const creds = credentials();
  if (!creds) return { status: 'skipped', ids: [], recipients: 0, error: 'not_configured' };

  const byId = new Map<string, PushUser>();
  for (const u of users) if (u?._id) byId.set(String(u._id), u);
  if (byId.size === 0) return { status: 'skipped', ids: [], recipients: 0 };

  const base = { app_id: creds.appId, ...contentOf(content.title, content.message, content.imageUrl), ...(content.data ? { data: content.data } : {}) };
  const ids: string[] = [];
  let recipients = 0;
  let lastError: string | undefined;
  const fallback: string[] = [];

  for (const batch of chunk([...byId.keys()])) {
    try {
      const { data } = await post(creds.apiKey, { ...base, include_aliases: { external_id: batch } });
      if (data?.id) ids.push(String(data.id));
      const invalid = invalidExternalIds(data, batch);
      recipients += batch.length - invalid.length;
      fallback.push(...invalid);
    } catch (err) {
      lastError = reason(err);
      fallback.push(...batch);
    }
  }

  const playerIds = Array.from(
    new Set(fallback.map((id) => byId.get(id)?.oneSignalPlayerId).filter((v): v is string => Boolean(v)))
  );
  for (const batch of chunk(playerIds)) {
    try {
      const { data } = await post(creds.apiKey, { ...base, include_subscription_ids: batch });
      if (data?.id) ids.push(String(data.id));
      const invalid = data?.errors?.invalid_player_ids;
      recipients += batch.length - (Array.isArray(invalid) ? invalid.length : Array.isArray(data?.errors) && !data?.id ? batch.length : 0);
    } catch (err) {
      lastError = reason(err);
    }
  }

  const status: PushResult['status'] =
    recipients >= byId.size ? 'sent' : recipients > 0 ? 'partial' : lastError ? 'failed' : 'skipped';
  const error = lastError || (recipients === 0 ? 'no_registered_devices' : undefined);
  return { status, ids, recipients, ...(error ? { error } : {}) };
}
