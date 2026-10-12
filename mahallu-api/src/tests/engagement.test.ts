/**
 * Campaigns, cash closing, Hijri, permissions and notification channels (no DB needed).
 *   npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { toHijri, formatHijri, upcomingIslamicEvents } from '../utils/hijri';
import { dayWindow, todayKey } from '../utils/dayWindow';
import { hasPermission, requirePermission } from '../middleware/authMiddleware';
import { Campaign, CampaignContribution } from '../models/Campaign';
import CashClosing from '../models/CashClosing';
import {
  deliverAnnouncement,
  getChannelAvailability,
  setProviderForTest,
  maskPhone,
} from '../services/notificationChannels';

test('hijri: 20 Mar 2026 is 1 Shawwal 1447 (Eid al-Fitr)', () => {
  const h = toHijri(new Date('2026-03-20T06:00:00Z'));
  assert.deepEqual([h.year, h.month, h.day], [1447, 10, 1]);
  assert.equal(formatHijri(new Date('2026-03-20T06:00:00Z')), '1 Shawwal 1447 AH');
});

test('hijri: upcoming events include Ramadan and Eid in the next 400 days', () => {
  const keys = upcomingIslamicEvents(new Date('2026-10-12'), 400).map((e) => e.key);
  assert.ok(keys.includes('ramadan') && keys.includes('eid_fitr') && keys.includes('eid_adha'));
});

test('day window is the IST calendar day by default', () => {
  const { start, end } = dayWindow('2026-10-12');
  assert.equal(start.toISOString(), '2026-10-11T18:30:00.000Z');
  assert.equal(end.getTime() - start.getTime(), 86400000);
  assert.match(todayKey(), /^\d{4}-\d{2}-\d{2}$/);
});

test('permission defaults keep mahall behaviour and lock other roles', () => {
  const mahall = { role: 'mahall', permissions: {} };
  assert.equal(hasPermission(mahall, 'canManageCampaigns'), true);
  assert.equal(hasPermission(mahall, 'canCancelReceipts'), true);
  assert.equal(hasPermission(mahall, 'canDeleteReceipts'), false);
  assert.equal(hasPermission({ role: 'survey', permissions: {} }, 'canCloseCashDay'), false);
  assert.equal(hasPermission({ role: 'mahall', permissions: { canCloseCashDay: false } }, 'canCloseCashDay'), false);
  assert.equal(hasPermission({ role: 'survey', permissions: { canCloseCashDay: true } }, 'canCloseCashDay'), true);
  assert.equal(hasPermission({ role: 'mahall', isSuperAdmin: true }, 'canDeleteReceipts'), true);
});

test('requirePermission answers 403 with the flag name', () => {
  let status = 0;
  let body: any;
  const res: any = { status: (s: number) => ({ json: (b: any) => { status = s; body = b; } }) };
  let called = false;
  requirePermission('canVerifyCashDay')({ user: { role: 'mahall', permissions: { canVerifyCashDay: false } } } as any, res, () => { called = true; });
  assert.equal(called, false);
  assert.equal(status, 403);
  assert.equal(body.permission, 'canVerifyCashDay');
});

test('campaign and closing schemas guard the money fields', () => {
  assert.ok((Campaign.schema.paths.tenantId as any).isRequired);
  assert.ok((CampaignContribution.schema.paths.receiptNo as any).isRequired);
  assert.deepEqual((CampaignContribution.schema.paths.status as any).options.enum, ['approved', 'cancelled']);
  assert.deepEqual((CashClosing.schema.paths.status as any).options.enum, ['submitted', 'verified', 'reopened']);
});

const fakeAnnouncement = (channels: string[], audience = 'all') =>
  ({ _id: 'a1', tenantId: '000000000000000000000001', title: 'Hi', body: 'Body', channels, audience, audienceRefIds: [] } as any);

test('notifications: unconfigured SMS is skipped, never claimed as sent', async () => {
  for (const k of ['SMS_PROVIDER_URL', 'SMS_PROVIDER_API_KEY', 'SMTP_HOST']) delete process.env[k];
  const av = getChannelAvailability();
  assert.equal(av.find((c) => c.channel === 'sms')!.available, false);
  assert.equal(av.find((c) => c.channel === 'email')!.available, false);
  const out = await deliverAnnouncement(fakeAnnouncement(['sms', 'email']));
  assert.equal(out.anySent, false);
  assert.equal(out.summary.sms.skipped, 1);
  assert.match(out.message, /SMS is not set up for this mahallu/);
  assert.match(out.message, /No message was sent/);
});

test('notifications: dry run sends nothing and says so', async () => {
  process.env.NOTIFICATIONS_DRY_RUN = '1';
  try {
    const out = await deliverAnnouncement(fakeAnnouncement(['push']));
    assert.equal(out.anySent, false);
    assert.equal(out.deliveries[0].status, 'skipped');
    assert.match(out.message, /Test mode/);
  } finally {
    delete process.env.NOTIFICATIONS_DRY_RUN;
  }
});

test('notifications: committee audience has no contacts and is skipped honestly', async () => {
  const calls: string[] = [];
  setProviderForTest({
    channel: 'whatsapp', label: 'WhatsApp', isConfigured: () => ({ ok: true }),
    send: async (to) => { calls.push(to); },
  });
  try {
    const out = await deliverAnnouncement(fakeAnnouncement(['whatsapp'], 'committee'));
    assert.equal(calls.length, 0);
    assert.equal(out.summary.whatsapp.skipped, 1);
    assert.equal(out.anySent, false);
  } finally {
    setProviderForTest(undefined, 'whatsapp');
  }
});

test('phone numbers are masked in delivery rows', () => {
  assert.equal(maskPhone('9876543210'), '98*****210');
});
