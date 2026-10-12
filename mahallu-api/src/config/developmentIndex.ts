/**
 * Task C2 — Mahallu Development Index (spec §32).
 *
 * Every dimension score is a simple ratio scaled to 0–100 and clamped. All the
 * knobs live here so the formulas stay auditable and tunable without touching
 * the controller. Targets are per-year unless the name says otherwise.
 */

/** Months a family record may go untouched before it stops counting as "current". */
export const FAMILY_FRESHNESS_MONTHS = 12;

/** Age band used for the youth dimension (inclusive). */
export const YOUTH_AGE_MIN = 15;
export const YOUTH_AGE_MAX = 35;

/** Age band used for the education dimension (inclusive) — school-age members. */
export const STUDENT_AGE_MIN = 5;
export const STUDENT_AGE_MAX = 18;

/** Annual activity targets. A dimension hitting its target scores 100. */
export const TARGETS = {
  /** Friday khutbahs recorded as delivered in the last 12 months. */
  khutbahsPerYear: 52,
  /** Share of school-age members expected to be enrolled somewhere. */
  educationEnrollmentRatio: 0.8,
  /** Share of youth-age members expected to be registered volunteers. */
  youthVolunteerRatio: 0.15,
  /** Share of adult women expected to be volunteers. */
  womenParticipationRatio: 0.15,
  /** Doctors / blood donors / palliative entries on file. */
  healthResources: 20,
  /** Medical camps held in the last 12 months. */
  healthCampsPerYear: 2,
  /** Job vacancies posted + training participants in the last 12 months. */
  economyOpportunities: 20,
  /** Programs + sent announcements + active projects. */
  communityInitiatives: 24,
  /** Committee meetings per active committee in the last 12 months. */
  meetingsPerCommitteePerYear: 6,
} as const;

/** Dimension keys and labels, in display order. */
export const DIMENSIONS = [
  { key: 'familyData', label: 'Family Data' },
  { key: 'worship', label: 'Worship' },
  { key: 'education', label: 'Education' },
  { key: 'welfare', label: 'Welfare' },
  { key: 'zakat', label: 'Zakat' },
  { key: 'economy', label: 'Economy' },
  { key: 'youth', label: 'Youth' },
  { key: 'women', label: 'Women' },
  { key: 'health', label: 'Health' },
  { key: 'finance', label: 'Finance' },
  { key: 'governance', label: 'Governance' },
  { key: 'community', label: 'Community' },
] as const;

export type DimensionKey = (typeof DIMENSIONS)[number]['key'];

/**
 * Ratio → 0–100 score. A zero target means "nothing to measure against", which
 * scores 0 rather than NaN — an empty Mahallu has not done the work either.
 */
export const score = (value: number, target: number): number => {
  if (!target || target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / target) * 100)));
};
