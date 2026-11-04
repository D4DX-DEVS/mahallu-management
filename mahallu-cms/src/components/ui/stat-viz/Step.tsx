import { Z, VizBox, dim } from './tokens';

export interface StepProps extends VizBox {
  values: number[];
  color?: string;
}

/** Spending in steps: stepped line over a dashed baseline. */
export default function Step({ values, color = Z.gold, scale }: StepProps) {
  const { w, h } = dim(scale);
  if (values.length < 2) return null;
  const n = values.length;
  const mx = Math.max(...values);
  const mn = Math.min(...values);
  const span = mx - mn || 1;
  const sw = (w - 4) / n;
  let d = '';
  values.forEach((p, i) => {
    const y = h - 4 - ((p - mn) / span) * (h - 10);
    d += `${i === 0 ? 'M' : 'L'}${(2 + i * sw).toFixed(1)} ${y.toFixed(1)} L${(2 + (i + 1) * sw).toFixed(1)} ${y.toFixed(1)} `;
  });
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="flex-shrink-0">
      <path d={d} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <line x1={2} x2={w - 2} y1={h - 1} y2={h - 1} className="stroke-[#E3EAE6] dark:stroke-[#2B342F]" strokeDasharray="2 3" />
    </svg>
  );
}
