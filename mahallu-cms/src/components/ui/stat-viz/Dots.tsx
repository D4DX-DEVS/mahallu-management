import { Z, VizBox, dim } from './tokens';

export interface DotsProps extends VizBox {
  count: number;
  color?: string;
}

/** Waiting items as fading dots (max 12 shown). */
export default function Dots({ count, color = Z.gold, scale }: DotsProps) {
  const { w, h } = dim(scale);
  const n = Math.min(Math.max(Math.round(count), 0), 12);
  if (n === 0) return null;
  const cols = Math.min(n, 6);
  const pitch = 11 * (scale ?? 1);
  const r = 4.2 * (scale ?? 1);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="flex-shrink-0">
      {Array.from({ length: n }).map((_, i) => (
        <circle key={i} cx={6 + (i % cols) * pitch} cy={8 + Math.floor(i / cols) * 12 * (scale ?? 1)} r={r} fill={color} opacity={Math.max(0.3, 1 - i * 0.12)} />
      ))}
    </svg>
  );
}
