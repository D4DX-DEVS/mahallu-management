import { useState } from 'react';
import { RiZoomInLine } from 'react-icons/ri';
import { Modal } from '@/components/ui';
import { cn } from '@/utils/cn';
import type { Shot } from '../content/types';
import shotsJson from '../content/shots.json';

const shots = shotsJson as Record<string, Shot>;

interface GuideFigureProps {
  shot: string;
  alt: string;
  caption?: string;
  /** Indicator the reader is pointing at from the step list, if any. */
  activeMark?: number | null;
  onMarkHover?: (mark: number | null) => void;
}

/*
 * Inline, a screenshot is a thumbnail that shows where to click, about the size
 * of a phone screen; the full-size picture is one click away. Stretched across a
 * wide monitor it pushed the steps it illustrates off the screen. The width is
 * also held back for tall pictures so none stands taller than MAX_HEIGHT.
 */
const MAX_WIDTH = 440;
const MAX_HEIGHT = 520;
function inlineWidth(meta: Shot | undefined): number {
  if (!meta) return MAX_WIDTH;
  return Math.round(Math.min(MAX_WIDTH, (MAX_HEIGHT * meta.w) / meta.h));
}

interface MarkedImageProps extends Pick<GuideFigureProps, 'shot' | 'alt' | 'activeMark' | 'onMarkHover'> {
  eager?: boolean;
}

/** The screenshot with its numbered indicators laid over it. */
function MarkedImage({ shot, alt, activeMark, onMarkHover, eager }: MarkedImageProps) {
  const meta = shots[shot];
  /* Indicators wait for the picture: numbered frames over an empty box point at nothing. */
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={cn('relative', !loaded && 'animate-pulse bg-muted')}>
      <img
        src={`/guide/${shot}.webp`}
        alt={alt}
        width={meta?.w}
        height={meta?.h}
        loading={eager ? 'eager' : 'lazy'}
        onLoad={() => setLoaded(true)}
        className="block h-auto w-full"
      />
      {loaded && meta?.marks.map((mark) => {
        const active = activeMark === mark.n;
        return (
          <div
            key={mark.n}
            className={cn('guide-mark', active && 'guide-mark-active')}
            style={{ left: `${mark.x}%`, top: `${mark.y}%`, width: `${mark.w}%`, height: `${mark.h}%` }}
            onMouseEnter={() => onMarkHover?.(mark.n)}
            onMouseLeave={() => onMarkHover?.(null)}
          >
            <span
              className={cn(
                'guide-mark-badge',
                // Flip the badge inside the frame when the target hugs the top or left edge.
                mark.y < 5 && 'guide-mark-badge-below',
                mark.x < 3 && 'guide-mark-badge-inset'
              )}
              aria-hidden="true"
            >
              {mark.n}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * A guide screenshot. Indicators are drawn by the page, not baked into the
 * image, so a step and its indicator can light each other up on hover and the
 * numbers stay sharp at any size. Clicking the picture opens it full width — on
 * a phone the inline picture is too small to read the labels on. The zoom
 * control sits under the picture, never on it: an overlaid button always ended
 * up covering the Save button the last indicator points at.
 */
export default function GuideFigure({ shot, alt, caption, activeMark, onMarkHover }: GuideFigureProps) {
  const [zoomed, setZoomed] = useState(false);
  return (
    <figure className="m-0" style={{ width: inlineWidth(shots[shot]), maxWidth: '100%' }}>
      {/* A plain div on purpose: the keyboard and screen-reader route to the zoom is the button below. */}
      <div
        onClick={() => setZoomed(true)}
        className="guide-thumb cursor-zoom-in overflow-hidden rounded-lg border border-border bg-white shadow-sm"
      >
        <MarkedImage shot={shot} alt={alt} activeMark={activeMark} onMarkHover={onMarkHover} />
      </div>
      <figcaption className="mt-2 flex flex-wrap items-start justify-between gap-x-3 gap-y-1 text-label text-muted-foreground">
        <span className="min-w-[9rem] flex-1">{caption}</span>
        <button
          type="button"
          onClick={() => setZoomed(true)}
          className="inline-flex flex-shrink-0 items-center gap-1 rounded-md font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RiZoomInLine className="h-4 w-4" aria-hidden="true" />
          വലുതാക്കി കാണുക
        </button>
      </figcaption>
      <Modal isOpen={zoomed} onClose={() => setZoomed(false)} showCloseButton size="xl" className="max-w-[1180px] bg-white">
        <div className="overflow-x-auto pt-6">
          <div className="min-w-[720px]">
            <MarkedImage shot={shot} alt={alt} activeMark={activeMark} eager />
          </div>
        </div>
      </Modal>
    </figure>
  );
}
