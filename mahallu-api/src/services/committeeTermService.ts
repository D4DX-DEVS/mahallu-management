import Committee from '../models/Committee';
import Notification from '../models/Notification';

/** Committees are flagged this many days before their term ends (spec 29). */
export const TERM_WARNING_DAYS = 60;

export const termWarningCutoff = (from: Date = new Date()): Date =>
  new Date(from.getTime() + TERM_WARNING_DAYS * 24 * 60 * 60 * 1000);

/**
 * One notification per committee per term-end date. Re-running the sweep is
 * safe: the existing-notification check keeps it idempotent across restarts.
 */
export const runCommitteeTermExpiryCheck = async (): Promise<number> => {
  const expiring = await Committee.find({
    status: 'active',
    termEndDate: { $ne: null, $lte: termWarningCutoff(), $gte: new Date() },
  }).select('tenantId name termEndDate');

  let created = 0;

  for (const committee of expiring) {
    const endsOn = committee.termEndDate as Date;
    const link = `/committees/${committee._id}`;
    const title = 'Committee term ending';
    const message = `${committee.name} term ends on ${endsOn.toISOString().slice(0, 10)}. Schedule the re-election or extend the term.`;

    const already = await Notification.findOne({
      tenantId: committee.tenantId,
      link,
      title,
      message,
    }).select('_id');

    if (already) continue;

    await Notification.create({
      tenantId: committee.tenantId,
      recipientType: 'user',
      title,
      message,
      type: 'warning',
      link,
    });
    created += 1;
  }

  if (created > 0) {
    console.info(`[CommitteeTerm] created ${created} term-expiry notification(s)`);
  }
  return created;
};

export const startCommitteeTermScheduler = (): void => {
  // ponytail: setInterval like the varisangya reminder; idempotent check replaces a cron dep
  const DAY_MS = 24 * 60 * 60 * 1000;
  runCommitteeTermExpiryCheck().catch((err) =>
    console.error('[CommitteeTerm] check failed:', err?.message || err)
  );
  setInterval(() => {
    runCommitteeTermExpiryCheck().catch((err) =>
      console.error('[CommitteeTerm] check failed:', err?.message || err)
    );
  }, DAY_MS);
  console.info(`[CommitteeTerm] expiry scheduler started (${TERM_WARNING_DAYS}-day window)`);
};
