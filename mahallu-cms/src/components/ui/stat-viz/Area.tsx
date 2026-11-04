import { Z, VizBox, dim } from './tokens';

export interface AreaProps extends VizBox {
  values: number[];
  color?: string;
}

/** Money trend: filled area with an end dot. */
export default function Area({ values, color = Z.green, scale }: AreaProps) {
  const { w, h } = dim(scale);
  if (values.length < 2) return null;
  const n = values.length;
  const mx = Math.max(...values);
  const mn = Math.min(...values);
  const span = mx - mn || 1;
  const xs = values.map((_, i) => 2 + (i * (w - 4)) / (n - 1));
  const ys = values.map((p) => h - 3 - ((p - mn) / span) * (h - 8));
  const d = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="flex-shrink-0">
      <path d={`${d} V${h} H2Z`} fill={Z.lime} opacity={0.22} />
      <path d={d} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xs[n - 1]} cy={ys[n - 1]} r={2.6} className="fill-white dark:fill-[#171D1A]" stroke={color} strokeWidth={1.8} />
    </svg>
  );
}
