/** ZAAD tokens used by the KPI-card graphics. */
export const Z = {
  deep: '#0B4837',
  green: '#04563A',
  lime: '#8EC13E',
  yellow: '#FDD817',
  gold: '#E0B400',
  red: '#B3261E',
  track: '#E7EEEA',
  soft: '#CFE2D8',
  line: '#E3EAE6',
} as const;

export interface VizBox {
  /** Scale factor (1 = 72x30). Compact cards use ~0.78. */
  scale?: number;
}

export const dim = (scale = 1) => ({ w: Math.round(72 * scale), h: Math.round(30 * scale) });
