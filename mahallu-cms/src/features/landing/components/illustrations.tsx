/*
 * Flat SVG artwork for the landing page: a Kerala-style white mosque, palm
 * fronds and the four "how it works" scenes. Everything is decorative, so each
 * drawing is hidden from assistive technology.
 */

interface MosqueProps {
  className?: string;
  /** Walls and domes. */
  fill?: string;
  /** Doors, windows and shadow. */
  shade?: string;
  /** Finials. */
  accent?: string;
}

export function MosqueIllustration({ className = '', fill = '#FFFFFF', shade = '#D6E2DB', accent = '#D9A62B' }: MosqueProps) {
  const minaret = (x: number) => (
    <g>
      <rect x={x} y="78" width="24" height="142" rx="4" fill={fill} />
      <rect x={x + 14} y="78" width="10" height="142" rx="3" fill={shade} opacity="0.45" />
      <rect x={x - 4} y="104" width="32" height="6" rx="2" fill={shade} />
      <rect x={x - 4} y="150" width="32" height="6" rx="2" fill={shade} />
      <path d={`M${x - 2} 78 C ${x - 2} 60 ${x + 12} 54 ${x + 12} 40 C ${x + 12} 54 ${x + 26} 60 ${x + 26} 78 Z`} fill={fill} />
      <circle cx={x + 12} cy="37" r="3" fill={accent} />
      <path d={`M${x + 8} 128 V 118 Q ${x + 12} 112 ${x + 16} 118 V 128 Z`} fill={shade} />
      <path d={`M${x + 8} 176 V 166 Q ${x + 12} 160 ${x + 16} 166 V 176 Z`} fill={shade} />
    </g>
  );

  const arch = (cx: number) => (
    <path d={`M${cx - 16} 220 V 170 Q ${cx} 146 ${cx + 16} 170 V 220 Z`} fill={shade} />
  );

  return (
    <svg viewBox="0 0 360 220" className={className} aria-hidden="true" focusable="false">
      {minaret(26)}
      {minaret(310)}
      {/* side domes */}
      <path d="M86 134 C 86 112 102 108 102 98 C 102 108 118 112 118 134 Z" fill={fill} />
      <path d="M242 134 C 242 112 258 108 258 98 C 258 108 274 112 274 134 Z" fill={fill} />
      <circle cx="102" cy="95" r="2.5" fill={accent} />
      <circle cx="258" cy="95" r="2.5" fill={accent} />
      {/* main hall */}
      <rect x="80" y="132" width="200" height="88" rx="6" fill={fill} />
      <rect x="80" y="132" width="200" height="6" fill={shade} opacity="0.6" />
      {/* central dome */}
      <path d="M112 132 C 112 86 162 78 180 50 C 198 78 248 86 248 132 Z" fill={fill} />
      <path d="M180 50 C 198 78 248 86 248 132 H 224 C 224 96 196 82 180 62 Z" fill={shade} opacity="0.35" />
      <rect x="178" y="32" width="4" height="20" rx="2" fill={accent} />
      <circle cx="180" cy="30" r="4" fill={accent} />
      {arch(128)}
      {arch(180)}
      {arch(232)}
    </svg>
  );
}

/** A burst of palm leaves. Takes its colour from `currentColor`. */
export function PalmFrond({ className = '' }: { className?: string }) {
  const leaves = [-70, -45, -20, 5, 30, 55, 80];
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true" focusable="false">
      <g fill="currentColor">
        {leaves.map((angle) => (
          <path
            key={angle}
            d="M100 180 C 96 140 70 112 30 96 C 72 100 98 130 106 178 Z"
            transform={`rotate(${angle} 100 180)`}
            opacity={0.85}
          />
        ))}
      </g>
    </svg>
  );
}

const GREEN_DARK = '#15603B';
const GREEN = '#298959';
const GREEN_LIGHT = '#8EDCB3';
const GREEN_TINT = '#E6F4EC';
const INK = '#243036';

function Person({ x, y, size = 1, body, skin = '#F1C9A5' }: { x: number; y: number; size?: number; body: string; skin?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`}>
      <circle cx="0" cy="-26" r="10" fill={skin} />
      <path d="M-10 -30 Q 0 -44 10 -30 Q 0 -36 -10 -30 Z" fill={INK} />
      <path d="M-18 24 V 2 C -18 -10 -8 -14 0 -14 C 8 -14 18 -10 18 2 V 24 Z" fill={body} />
    </g>
  );
}

/** One of the four "how it works" scenes, drawn at 160 x 100. */
export function StepIllustration({ step, className = '' }: { step: 1 | 2 | 3 | 4; className?: string }) {
  return (
    <svg viewBox="0 0 160 100" className={className} aria-hidden="true" focusable="false">
      <ellipse cx="80" cy="92" rx="70" ry="6" fill={GREEN_TINT} />
      {step === 1 && (
        <g transform="translate(14 8) scale(0.6)">
          <MosqueShape />
        </g>
      )}
      {step === 2 && (
        <g>
          <Person x={52} y={66} size={0.95} body={GREEN} />
          <Person x={80} y={66} size={1.1} body={GREEN_DARK} />
          <Person x={108} y={66} size={0.95} body={GREEN_LIGHT} />
        </g>
      )}
      {step === 3 && (
        <g>
          <rect x="34" y="14" width="92" height="74" rx="8" fill="#FFFFFF" stroke="#D6E2DB" strokeWidth="2" />
          <rect x="44" y="24" width="40" height="6" rx="3" fill={GREEN_TINT} />
          <rect x="44" y="34" width="26" height="4" rx="2" fill={GREEN_TINT} />
          <rect x="48" y="62" width="10" height="18" rx="2" fill={GREEN_LIGHT} />
          <rect x="64" y="52" width="10" height="28" rx="2" fill={GREEN} />
          <rect x="80" y="44" width="10" height="36" rx="2" fill={GREEN_DARK} />
          <rect x="96" y="56" width="10" height="24" rx="2" fill={GREEN} />
          <circle cx="112" cy="28" r="9" fill={GREEN_DARK} />
          <path d="M107 28 L 111 32 L 118 24" stroke="#FFFFFF" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      {step === 4 && (
        <g>
          <Person x={46} y={66} size={1.05} body={GREEN_DARK} />
          <Person x={76} y={70} size={0.7} body={GREEN_LIGHT} />
          <Person x={100} y={66} size={1.05} body={GREEN} />
          <Person x={126} y={72} size={0.6} body={GREEN_LIGHT} />
          <path
            d="M80 18 C 84 10 96 12 96 20 C 96 28 80 36 80 36 C 80 36 64 28 64 20 C 64 12 76 10 80 18 Z"
            fill="#E35F1C"
          />
        </g>
      )}
    </svg>
  );
}

/** The mosque without an <svg> wrapper, for composing into other drawings. */
function MosqueShape() {
  const fill = GREEN_TINT;
  const shade = GREEN;
  return (
    <g>
      <rect x="10" y="60" width="18" height="80" rx="3" fill={fill} stroke={shade} strokeWidth="2" />
      <path d="M8 60 C 8 46 19 42 19 32 C 19 42 30 46 30 60 Z" fill={fill} stroke={shade} strokeWidth="2" />
      <rect x="152" y="60" width="18" height="80" rx="3" fill={fill} stroke={shade} strokeWidth="2" />
      <path d="M150 60 C 150 46 161 42 161 32 C 161 42 172 46 172 60 Z" fill={fill} stroke={shade} strokeWidth="2" />
      <rect x="34" y="84" width="112" height="56" rx="4" fill={fill} stroke={shade} strokeWidth="2" />
      <path d="M52 84 C 52 52 82 46 90 28 C 98 46 128 52 128 84 Z" fill={fill} stroke={shade} strokeWidth="2" />
      <circle cx="90" cy="22" r="3" fill="#D9A62B" />
      <path d="M78 140 V 110 Q 90 96 102 110 V 140 Z" fill={shade} />
      <path d="M46 140 V 118 Q 54 108 62 118 V 140 Z" fill={shade} opacity="0.5" />
      <path d="M118 140 V 118 Q 126 108 134 118 V 140 Z" fill={shade} opacity="0.5" />
    </g>
  );
}
