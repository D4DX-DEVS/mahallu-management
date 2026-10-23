import { Z, VizBox, dim } from './tokens';

export interface PairProps extends VizBox {
  a: number;
  b: number;
  colorA?: string;
  colorB?: string;
}

/** Two values compared (e.g. income vs expense). */
export default function Pair({ a, b, colorA = Z.deep, colorB = Z.lime, scale }: PairProps) {
  const { w, h } = dim(scale);
  const mx = Math.max(a, b, 1);
  const ha = Math.max(2, (Math.max(a, 0) / mx) * (h - 3));
  const hb = Math.max(2, (Math.max(b, 0) / mx) * (h - 3));
  const bw = Math.round(w * 0.3);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="flex-shrink-0">
      <rect x={4} y={h - ha} width={bw} height={ha} rx={4} fill={colorA} />
      <rect x={4 + bw + 6} y={h - hb} width={bw} height={hb} rx={4} fill={colorB} />
      <path d={`M${w - 12} ${h - 3} L${w - 4} ${h - 14 * (scale ?? 1)}`} stroke={Z.yellow} strokeWidth={3} strokeLinecap="round" />
    </svg>
  );
}
