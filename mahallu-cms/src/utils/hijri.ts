/**
 * Mirrors mahallu-api/src/utils/hijri.ts (keep the two in sync).
 * Hijri (Umm al-Qura) helpers via Intl. No dependencies. The Umm al-Qura calendar is the
 * civil calendar; the actual month start can differ by a day from local moon sighting, so
 * callers should present it as "approximate" where it matters (Eid, Ramadan start).
 */
export interface HijriParts {
  year: number;
  month: number; // 1-12
  day: number;
  monthName: string;
  monthNameMl: string;
}

export const HIJRI_MONTHS_EN = [
  'Muharram', 'Safar', "Rabi' al-awwal", "Rabi' al-thani", 'Jumada al-awwal', 'Jumada al-thani',
  'Rajab', "Sha'ban", 'Ramadan', 'Shawwal', "Dhu al-Qi'dah", 'Dhu al-Hijjah',
];
export const HIJRI_MONTHS_ML = [
  'മുഹർറം', 'സഫർ', 'റബീഉൽ അവ്വൽ', 'റബീഉൽ ആഖിർ', 'ജമാദുൽ അവ്വൽ', 'ജമാദുൽ ആഖിർ',
  'റജബ്', 'ശഅബാൻ', 'റമദാൻ', 'ശവ്വാൽ', 'ദുൽ ഖഅദ്', 'ദുൽ ഹിജ്ജ',
];

const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
  day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata',
});

export const toHijri = (input: Date | string | number): HijriParts => {
  const d = input instanceof Date ? input : new Date(input);
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value || '0', 10);
  const month = get('month');
  return {
    year: get('year'),
    month,
    day: get('day'),
    monthName: HIJRI_MONTHS_EN[month - 1] || '',
    monthNameMl: HIJRI_MONTHS_ML[month - 1] || '',
  };
};

export const formatHijri = (input: Date | string | number, lang: 'en' | 'ml' = 'en'): string => {
  const h = toHijri(input);
  return `${h.day} ${lang === 'ml' ? h.monthNameMl : h.monthName} ${h.year} AH`;
};

export interface IslamicEvent {
  key: 'muharram' | 'ramadan' | 'eid_fitr' | 'arafah' | 'eid_adha';
  label: string;
  date: Date;
  hijri: string;
  suggestedCampaignType?: 'fitr' | 'udhiya' | 'ramadan_relief';
}

const EVENT_RULES: Array<{ key: IslamicEvent['key']; month: number; day: number; label: string; type?: IslamicEvent['suggestedCampaignType'] }> = [
  { key: 'muharram', month: 1, day: 1, label: 'Islamic New Year (1 Muharram)' },
  { key: 'ramadan', month: 9, day: 1, label: 'Ramadan begins', type: 'ramadan_relief' },
  { key: 'eid_fitr', month: 10, day: 1, label: 'Eid al-Fitr', type: 'fitr' },
  { key: 'arafah', month: 12, day: 9, label: 'Day of Arafah' },
  { key: 'eid_adha', month: 12, day: 10, label: 'Eid al-Adha', type: 'udhiya' },
];

/** Upcoming Islamic dates in the next `days` days (default 400), earliest first. */
export const upcomingIslamicEvents = (from: Date = new Date(), days = 400): IslamicEvent[] => {
  const out: IslamicEvent[] = [];
  const day = 24 * 3600 * 1000;
  for (let i = 0; i <= days; i++) {
    const date = new Date(from.getTime() + i * day);
    const h = toHijri(date);
    for (const r of EVENT_RULES) {
      if (h.month === r.month && h.day === r.day) {
        out.push({ key: r.key, label: r.label, date, hijri: formatHijri(date), suggestedCampaignType: r.type });
      }
    }
  }
  return out;
};

/** "12 Oct 2026 · 29 Rabi' al-awwal 1448 AH" */
export const formatDual = (input: Date | string | number, lang: 'en' | 'ml' = 'en'): string => {
  const d = input instanceof Date ? input : new Date(input);
  const g = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${g} · ${formatHijri(d, lang)}`;
};
