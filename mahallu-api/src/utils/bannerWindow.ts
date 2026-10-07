/**
 * Which banners a member may see: status 'active' and inside the date window.
 *
 * Dates are India time (IST, UTC+05:30, no daylight saving). An admin picks `endDate` as a calendar
 * day, and it is stored as that day's midnight, so comparing it to the current instant would hide the
 * banner at the START of its last day. `endDate` is therefore treated as a whole day: the banner stays
 * up until that IST day is over. A missing start or end date means "no limit" on that side.
 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The instant the IST calendar day containing `now` began. */
export const startOfIstDay = (now: Date): Date =>
  new Date(Math.floor((now.getTime() + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS);

/** Mongo filter for banners a member may see right now (add `tenantId` yourself). */
export const activeBannerFilter = (now: Date = new Date()) => ({
  status: 'active',
  $and: [
    { $or: [{ startDate: { $exists: false } }, { startDate: null }, { startDate: { $lte: now } }] },
    { $or: [{ endDate: { $exists: false } }, { endDate: null }, { endDate: { $gte: startOfIstDay(now) } }] },
  ],
});
