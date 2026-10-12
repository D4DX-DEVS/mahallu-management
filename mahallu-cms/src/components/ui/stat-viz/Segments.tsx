import { Z, VizBox, dim } from './tokens';

export interface Segment {
  value: number;
  color?: string;
}
export interface SegmentsProps extends VizBox {
  segments: Segment[];
}

const DEFAULTS = [Z.deep, Z.lime, Z.yellow, Z.gold, Z.red];

/** Composition of a whole as rounded pill segments. */
export default function Segments({ segments, scale }: SegmentsProps) {
  const { w, h } = dim(scale);
  const segs = segments.filter((s) => s.value > 0);
  const tot = segs.reduce((a, s) => a + s.value, 0);
  if (!tot) return null;
  const gap = 2;
  const usable = w - gap * (segs.length - 1);
  let x = 0;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="flex-shrink-0">
      {segs.map((s, i) => {
        const ww = Math.max(4, (s.value / tot) * usable);
        const el = <rect key={i} x={x} y={h / 2 - 5} width={ww} height={10} rx={5} fill={s.color ?? DEFAULTS[i % DEFAULTS.length]} />;
        x += ww + gap;
        return el;
      })}
    </svg>
  );
}
