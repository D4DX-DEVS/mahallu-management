/**
 * Central "archived" exclusion for family queries.
 *
 * Archived families (soft-deleted, see familyLifecycleService) must not show up in
 * lists, counts or dashboards by default. A missing `isArchived` field counts as
 * "not archived", so documents written before this field existed keep working.
 *
 * Usage: Family.find({ tenantId, ...ACTIVE_FAMILY_FILTER })
 */
export const ACTIVE_FAMILY_FILTER = { isArchived: { $ne: true } } as const;

/** Spread-friendly variant for queries that may opt in to archived records. */
export const familyArchiveFilter = (includeArchived?: unknown): Record<string, any> =>
  includeArchived === 'true' || includeArchived === true ? {} : { isArchived: { $ne: true } };

/**
 * "Live" members for counts, dashboards and reports: not soft-deleted, not deceased.
 * Mirrors what the members list shows. Spread it: Member.find({ tenantId, ...ACTIVE_MEMBER_FILTER }).
 */
export const ACTIVE_MEMBER_FILTER = { status: { $ne: 'deleted' }, isDead: { $ne: true } } as const;
