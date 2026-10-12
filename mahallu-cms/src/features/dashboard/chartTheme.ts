import type { CSSProperties } from 'react';
import { useThemeStore } from '@/store/themeStore';

/** Chart chrome that follows the active theme (grid, axis labels, tooltip). */
export function useChartTheme() {
  const dark = useThemeStore((s) => s.theme) === 'dark';
  return {
    dark,
    grid: dark ? '#2B3631' : '#E3EAE6',
    tick: dark ? '#A5B0AA' : '#7B8983',
    line: dark ? '#8EC13E' : '#04563A',
    lime: '#8EC13E',
    gold: dark ? '#FDD817' : '#E0B800',
    tooltip: {
      backgroundColor: dark ? '#1E2622' : '#fff',
      color: dark ? '#F1F4F2' : '#18231E',
      border: `1px solid ${dark ? '#2B3631' : '#E3EAE6'}`,
      borderRadius: '10px',
      boxShadow: '0 10px 28px -18px rgba(11,72,55,.4)',
      fontSize: 12,
    } as CSSProperties,
  };
}
