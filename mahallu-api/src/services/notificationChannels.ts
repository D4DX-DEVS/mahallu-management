/**
 * Notification channel layer. Each channel is a pluggable provider that is DISABLED unless
 * its env keys exist, so we never claim a message was delivered through a channel that is
 * not set up. WhatsApp uses the existing DXING mechanism, the app channel uses the existing
 * in-app Notification + OneSignal push, SMS and email are generic providers.
 *
 * Env (placeholders only in .env.example):
 *   WhatsApp: DXING_SECRET, DXING_ACCOUNT
 *   Push:     ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY (optional; in-app works without)
 *   SMS:      SMS_PROVIDER_URL, SMS_PROVIDER_API_KEY, SMS_PROVIDER_SENDER_ID, SMS_PROVIDER_NAME
 *   Email:    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM (needs the `nodemailer` package)
 *   Testing:  NOTIFICATIONS_DRY_RUN=1 -> every provider reports "skipped (test mode)"; nothing is sent.
 */
import axios from 'axios';
import { sendWhatsAppMessage } from './dxingService';
import { sendPushNotification } from './oneSignalService';
import Notification from '../models/Notification';
import Family from '../models/Family';
import User from '../models/User';
import { ACTIVE_FAMILY_FILTER } from '../utils/archiveFilters';

export type DeliveryStatus = 'queued' | 'sent' | 'failed' | 'skipped';
export type ChannelKey = 'push' | 'whatsapp' | 'sms' | 'email';

export interface ChannelAvailability {
  channel: ChannelKey;
  label: string;
  available: boolean;
  /** Plain-language reason when not available */
  reason?: string;
  /** What this channel reaches, for the selector */
  reach: string;
}

export interface DeliveryRecord {
  channel: ChannelKey;
  recipient: string;
  familyId?: any;
  status: DeliveryStatus;
  error?: string;
}

export interface Message {
  title: string;
  body: string;
}

export interface Provider {
  channel: Exclude<ChannelKey, 'push'>;
  label: string;
  isConfigured(): { ok: boolean; reason?: string };
  send(to: string, msg: Message): Promise<void>;
}

const LABELS: Record<ChannelKey, string> = { push: 'The app', whatsapp: 'WhatsApp', sms: 'SMS', email: 'Email' };
const NOT_SET_UP = (c: ChannelKey) => `${c === 'push' ? 'App notifications are' : `${LABELS[c]} is`} not set up for this mahallu.`;

export const isDryRun = () => ['1', 'true'].includes(String(process.env.NOTIFICATIONS_DRY_RUN || '').toLowerCase());

const envSet = (...keys: string[]) => keys.every((k) => !!process.env[k]?.trim());

const whatsappProvider: Provider = {
  channel: 'whatsapp',
  label: 'WhatsApp',
  isConfigured: () => (envSet('DXING_SECRET', 'DXING_ACCOUNT') ? { ok: true } : { ok: false, reason: NOT_SET_UP('whatsapp') }),
  send: async (to, msg) => {
    await sendWhatsAppMessage(to, `*${msg.title}*\n\n${msg.body}`);
  },
};

const smsProvider: Provider = {
  channel: 'sms',
  label: 'SMS',
  isConfigured: () =>
    envSet('SMS_PROVIDER_URL', 'SMS_PROVIDER_API_KEY') ? { ok: true } : { ok: false, reason: NOT_SET_UP('sms') },
  send: async (to, msg) => {
    // Generic JSON-over-HTTPS gateway. Adapt the payload here for the chosen vendor.
    const digits = to.replace(/\D/g, '');
    const phone = digits.length === 10 ? `91${digits}` : digits;
    await axios.post(
      process.env.SMS_PROVIDER_URL as string,
      {
        to: phone,
        sender: process.env.SMS_PROVIDER_SENDER_ID || undefined,
        message: `${msg.title}\n${msg.body}`.slice(0, 600),
      },
      { timeout: 10000, headers: { Authorization: `Bearer ${process.env.SMS_PROVIDER_API_KEY}` } }
    );
  },
};

const loadNodemailer = (): any | null => {
  try {
    // Optional dependency: not bundled, so email stays off until the mahallu's host installs it.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('nodemailer');
  } catch {
    return null;
  }
};

const emailProvider: Provider = {
  channel: 'email',
  label: 'Email',
  isConfigured: () => {
    if (!envSet('SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM')) return { ok: false, reason: NOT_SET_UP('email') };
    if (!loadNodemailer()) return { ok: false, reason: 'Email is not set up for this mahallu (mail library missing on the server).' };
    return { ok: true };
  },
  send: async (to, msg) => {
    const nm = loadNodemailer();
    if (!nm) throw new Error('Mail library not installed');
    const transport = nm.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_PORT === '465',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transport.sendMail({ from: process.env.SMTP_FROM, to, subject: msg.title, text: msg.body });
  },
};

const providers: Record<Provider['channel'], Provider> = { whatsapp: whatsappProvider, sms: smsProvider, email: emailProvider };

/** Test hook: swap a provider for a fake. Pass undefined to restore. */
const originals = { ...providers };
export const setProviderForTest = (p: Provider | undefined, channel?: Provider['channel']) => {
  if (p) providers[p.channel] = p;
  else if (channel) providers[channel] = originals[channel];
};

export const getChannelAvailability = (): ChannelAvailability[] => {
  const dry = isDryRun();
  const base: ChannelAvailability[] = [
    {
      channel: 'push',
      label: LABELS.push,
      available: true,
      reach: envSet('ONESIGNAL_APP_ID', 'ONESIGNAL_REST_API_KEY')
        ? 'Everyone with the mahallu app (in-app list and phone alert)'
        : 'Everyone with the mahallu app (in-app list; phone alert is not set up)',
    },
  ];
  (['whatsapp', 'sms', 'email'] as const).forEach((c) => {
    const cfg = providers[c].isConfigured();
    base.push({
      channel: c,
      label: LABELS[c],
      available: cfg.ok,
      reason: cfg.ok ? (dry ? 'Test mode: messages are not actually sent.' : undefined) : cfg.reason,
      reach: c === 'email' ? 'Members with an email on their app account' : 'Family contact numbers',
    });
  });
  return base;
};

export const maskPhone = (p: string): string => {
  const d = String(p || '').replace(/\D/g, '');
  return d.length >= 6 ? `${d.slice(0, 2)}${'*'.repeat(d.length - 5)}${d.slice(-3)}` : '***';
};
export const maskEmail = (e: string): string => {
  const [u, h] = String(e).split('@');
  return h ? `${u.slice(0, 1)}***@${h}` : '***';
};

interface Recipient { to: string; familyId?: any; masked: string }

/** Contacts for the audience. `unsupported` explains why a channel has nobody to send to. */
const resolveRecipients = async (
  announcement: any,
  kind: 'phone' | 'email'
): Promise<{ recipients: Recipient[]; unsupported?: string }> => {
  if (announcement.audience === 'committee' || announcement.audience === 'custom') {
    return { recipients: [], unsupported: 'This audience has no contact list yet, so nothing could be sent.' };
  }
  if (kind === 'phone') {
    const q: any = { tenantId: announcement.tenantId, contactNo: { $exists: true, $ne: '' } };
    if (announcement.audience === 'cluster' && announcement.audienceRefIds?.length) q.clusterId = { $in: announcement.audienceRefIds };
    const fams: any[] = await Family.find({ ...q, ...ACTIVE_FAMILY_FILTER }).select('contactNo').lean();
    const seen = new Set<string>();
    const recipients: Recipient[] = [];
    for (const f of fams) {
      const key = String(f.contactNo).replace(/\D/g, '').slice(-10);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      recipients.push({ to: f.contactNo, familyId: f._id, masked: maskPhone(f.contactNo) });
    }
    return { recipients };
  }
  if (announcement.audience === 'cluster') {
    return { recipients: [], unsupported: 'Email cannot be limited to a cluster yet.' };
  }
  const users: any[] = await User.find({ tenantId: announcement.tenantId, status: 'active', email: { $exists: true, $ne: '' } }).select('email').lean();
  const seen = new Set<string>();
  const recipients: Recipient[] = [];
  for (const u of users) {
    const e = String(u.email).toLowerCase();
    if (seen.has(e)) continue;
    seen.add(e);
    recipients.push({ to: e, masked: maskEmail(e) });
  }
  return { recipients };
};

export interface SendOutcome {
  deliveries: DeliveryRecord[];
  summary: Record<string, { total: number; sent: number; failed: number; skipped: number; queued: number; note?: string }>;
  message: string;
  anySent: boolean;
}

const emptyCounts = () => ({ total: 0, sent: 0, failed: 0, skipped: 0, queued: 0 });

/**
 * Sends one announcement on its selected channels and reports exactly what happened per
 * recipient. Nothing is reported as sent unless the provider call succeeded.
 */
export const deliverAnnouncement = async (announcement: any): Promise<SendOutcome> => {
  const deliveries: DeliveryRecord[] = [];
  const summary: SendOutcome['summary'] = {};
  const msg: Message = { title: announcement.title, body: announcement.body };
  const dry = isDryRun();

  const skipChannel = (channel: ChannelKey, note: string, recipient = '-') => {
    deliveries.push({ channel, recipient, status: 'skipped', error: note });
    summary[channel] = { ...emptyCounts(), total: 1, skipped: 1, note };
  };

  for (const channel of announcement.channels as ChannelKey[]) {
    if (channel === 'push') {
      if (dry) {
        skipChannel('push', 'Test mode: nothing was sent.', 'app users');
        continue;
      }
      try {
        await Notification.create({
          tenantId: announcement.tenantId,
          recipientType: 'all',
          title: announcement.title,
          titleMl: announcement.titleMl,
          message: announcement.body,
          type: announcement.category === 'emergency' ? 'warning' : 'info',
          link: `/announcements/${announcement._id}`,
        });
        let note: string | undefined;
        if (envSet('ONESIGNAL_APP_ID', 'ONESIGNAL_REST_API_KEY')) {
          try {
            await sendPushNotification({ title: msg.title, message: msg.body });
          } catch (e: any) {
            note = `Phone alert failed: ${e?.message || 'unknown error'}. Shown inside the app.`;
          }
        } else {
          note = 'Shown inside the app. Phone alerts are not set up.';
        }
        deliveries.push({ channel: 'push', recipient: 'app users', status: 'sent', error: note });
        summary.push = { ...emptyCounts(), total: 1, sent: 1, note };
      } catch (e: any) {
        deliveries.push({ channel: 'push', recipient: 'app users', status: 'failed', error: e?.message || 'unknown error' });
        summary.push = { ...emptyCounts(), total: 1, failed: 1 };
      }
      continue;
    }

    const provider = providers[channel as Provider['channel']];
    if (!provider) {
      skipChannel(channel, `Unknown channel "${channel}".`);
      continue;
    }
    const cfg = provider.isConfigured();
    if (!cfg.ok) {
      skipChannel(channel, cfg.reason || NOT_SET_UP(channel));
      continue;
    }
    const { recipients, unsupported } = await resolveRecipients(announcement, channel === 'email' ? 'email' : 'phone');
    if (!recipients.length) {
      skipChannel(channel, unsupported || 'No contact details on file for this audience.');
      continue;
    }
    const counts = emptyCounts();
    counts.total = recipients.length;
    for (const r of recipients) {
      if (dry) {
        deliveries.push({ channel, recipient: r.masked, familyId: r.familyId, status: 'skipped', error: 'Test mode: nothing was sent.' });
        counts.skipped += 1;
        continue;
      }
      try {
        await provider.send(r.to, msg);
        deliveries.push({ channel, recipient: r.masked, familyId: r.familyId, status: 'sent' });
        counts.sent += 1;
      } catch (e: any) {
        deliveries.push({ channel, recipient: r.masked, familyId: r.familyId, status: 'failed', error: String(e?.message || 'unknown error').slice(0, 200) });
        counts.failed += 1;
      }
    }
    summary[channel] = { ...counts, note: dry ? 'Test mode: nothing was sent.' : undefined };
  }

  return { deliveries, summary, message: buildMessage(announcement.channels, summary, dry), anySent: Object.values(summary).some((s) => s.sent > 0) };
};

const NAMES: Record<ChannelKey, string> = { push: 'the app', whatsapp: 'WhatsApp', sms: 'SMS', email: 'email' };

const buildMessage = (channels: ChannelKey[], summary: SendOutcome['summary'], dry: boolean): string => {
  if (dry) return 'Test mode is on, so no message was sent.';
  const notSetUp: string[] = [];
  const skippedOther: string[] = [];
  const sent: string[] = [];
  const failed: string[] = [];
  for (const c of channels) {
    const s = summary[c];
    if (!s) continue;
    if (s.sent > 0) {
      sent.push(NAMES[c]);
      if (s.failed > 0) failed.push(`${NAMES[c]} did not reach ${s.failed} of ${s.total}`);
    } else if (s.failed > 0) failed.push(`${NAMES[c]} failed for ${s.failed} of ${s.total}`);
    else if (s.skipped > 0) {
      if (/not set up/i.test(s.note || '')) notSetUp.push(c === 'push' ? 'App notifications are' : `${LABELS[c]} is`);
      else skippedOther.push(`${LABELS[c]} was skipped: ${s.note || 'no recipients'}`);
    }
  }
  const parts: string[] = [];
  notSetUp.forEach((n) => parts.push(`${n} not set up for this mahallu.`));
  skippedOther.forEach((n) => parts.push(/[.!]$/.test(n) ? n : `${n}.`));
  failed.forEach((n) => parts.push(`${n[0].toUpperCase()}${n.slice(1)}.`));
  if (sent.length) parts.push(`Message sent through ${sent.length > 1 ? `${sent.slice(0, -1).join(', ')} and ${sent[sent.length - 1]}` : sent[0]}.`);
  else parts.push('No message was sent.');
  return parts.join(' ');
};
