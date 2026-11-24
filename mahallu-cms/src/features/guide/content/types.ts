import type { ComponentType } from 'react';

/**
 * The user guide is written in Malayalam. Text may mark a control's on-screen
 * name with **double asterisks**: those names are kept in English, exactly as
 * the screen prints them, so the reader can match the word to the button.
 */

export interface GuideSection {
  id: string;
  title: string;
  intro?: string;
  /** Sidebar trail to the page, as printed in the menu: ['Community', 'Families']. */
  menu?: string[];
  /** Route of the page the section describes; renders an "open this page" link. */
  to?: string;
  /** Screenshot id: a file in /public/guide and a key in shots.json. */
  figure?: string;
  caption?: string;
  /**
   * Numbered from 1. A step is tied to a screenshot indicator by its number:
   * step 3 lights indicator 3, when the screenshot has one.
   */
  steps?: string[];
  /** Plain bullet points, for sections that explain rather than instruct. */
  points?: string[];
  tip?: string;
  note?: string;
  warn?: string;
}

export type GuideGroupId = 'start' | 'people' | 'mahallu' | 'records' | 'money' | 'manage';

export interface GuideChapter {
  id: string;
  group: GuideGroupId;
  /** Malayalam title. */
  title: string;
  /** The module's name as the menu prints it. */
  titleEn: string;
  summary: string;
  icon: ComponentType<{ className?: string }>;
  sections: GuideSection[];
}

export interface GuideGroup {
  id: GuideGroupId;
  title: string;
}

export interface ShotMark {
  n: number;
  /** Percentages of the image box. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Shot {
  w: number;
  h: number;
  marks: ShotMark[];
}
