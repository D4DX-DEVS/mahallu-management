import type { GuideChapter, GuideGroup } from './types';
import { startChapters } from './chapters/start';
import { peopleChapters } from './chapters/people';
import { mahalluChapters } from './chapters/mahallu';
import { recordsChapters } from './chapters/records';
import { moneyChapters } from './chapters/money';
import { manageChapters } from './chapters/manage';

/** Chapters appear in the order a new Mahallu is set up; groups keep that order. */
export const guideGroups: GuideGroup[] = [
  { id: 'start', title: 'തുടക്കം' },
  { id: 'people', title: 'കുടുംബങ്ങളും അംഗങ്ങളും' },
  { id: 'mahallu', title: 'മഹല്ല് പ്രവർത്തനങ്ങൾ' },
  { id: 'records', title: 'രജിസ്ട്രേഷനുകളും സർട്ടിഫിക്കറ്റുകളും' },
  { id: 'money', title: 'പിരിവും കണക്കുകളും' },
  { id: 'manage', title: 'സ്ഥാപനങ്ങൾ, അറിയിപ്പുകൾ, യൂസർമാർ' },
];

export const guideChapters: GuideChapter[] = [
  ...startChapters,
  ...peopleChapters,
  ...mahalluChapters,
  ...recordsChapters,
  ...moneyChapters,
  ...manageChapters,
];
