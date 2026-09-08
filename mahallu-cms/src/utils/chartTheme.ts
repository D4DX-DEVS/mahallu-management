import { useEffect, useState } from 'react';
import { useThemeStore } from '@/store/themeStore';

/**
 * Chart colours resolved from the design tokens.
 *
 * Every chart in the product used to hardcode hex — `#fff` tooltips, `#e5e7eb`
 * grid lines, `#374151` bar labels — so in dark mode a white tooltip sat on a
 * dark card and dark-grey data labels sat on dark bars. Reading the tokens
 * means a chart follows the theme like everything else.
 */
export interface ChartTheme {
  grid: string;
  axis: string;
  label: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  /** Categorical series. Distinct hues, not shades of one colour. */
  categorical: string[];
  primary: string;
  success: string;
  warning: string;
  destructive: string;
  info: string;
}

function readToken(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw ? 'hsl(' + raw + ')' : fallback;
}

export function useChartTheme(): ChartTheme {
  const theme = useThemeStore((s) => s.theme);
  const [tokens, setTokens] = useState<ChartTheme>(() => resolve());

  useEffect(() => {
    // Re-read after the theme class lands on <html>.
    const frame = window.requestAnimationFrame(() => setTokens(resolve()));
    return () => window.cancelAnimationFrame(frame);
  }, [theme]);

  return tokens;
}

function resolve(): ChartTheme {
  const primary = readToken('--primary', 'hsl(175 84% 32%)');
  const success = readToken('--success', 'hsl(152 62% 33%)');
  const warning = readToken('--warning', 'hsl(32 88% 40%)');
  const destructive = readToken('--destructive', 'hsl(0 72% 46%)');
  const info = readToken('--info', 'hsl(214 80% 45%)');

  return {
    grid: readToken('--border', 'hsl(180 12% 88%)'),
    axis: readToken('--muted-foreground', 'hsl(200 9% 42%)'),
    label: readToken('--foreground', 'hsl(200 18% 12%)'),
    tooltipBg: readToken('--popover', 'hsl(0 0% 100%)'),
    tooltipBorder: readToken('--border', 'hsl(180 12% 88%)'),
    tooltipText: readToken('--popover-foreground', 'hsl(200 18% 12%)'),
    /* Distinct hues so two adjacent series stay separable, including for
     * colour-vision-deficient readers. The gender pie previously used two
     * shades of the same green. */
    categorical: [primary, info, warning, destructive, success],
    primary,
    success,
    warning,
    destructive,
    info,
  };
}

/** Shared Recharts tooltip styling. */
export function tooltipStyle(theme: ChartTheme) {
  return {
    backgroundColor: theme.tooltipBg,
    border: '1px solid ' + theme.tooltipBorder,
    borderRadius: '8px',
    color: theme.tooltipText,
    fontSize: '0.8125rem',
    boxShadow: '0 4px 12px -2px rgba(0,0,0,0.12)',
  };
}
