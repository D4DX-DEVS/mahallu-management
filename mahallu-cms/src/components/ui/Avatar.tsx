/**
 * Avatar, AvatarStack and PersonCell - how a person (or a family) is shown wherever
 * a name appears. Photo when one exists, otherwise initials on a tint, otherwise a
 * person silhouette (no name at all).
 *
 * Usage
 *   <Avatar name="Hamza Kutty" src={member.photoUrl} size={40} />
 *   <Avatar name={family.houseName} size={32} />              // family = house initials
 *   <Avatar name={m.name} src={m.photoUrl} size={56} badge={<BloodGroupBadge value={m.bloodGroup} size="xs" />} />
 *   <Avatar name={u.name} status="active" />                  // status dot
 *   <AvatarStack items={[{name:'A B', src}, ...]} max={3} />   // overlapping, "+N" overflow
 *   // First column of a table:
 *   { key: 'name', label: 'Name', render: (v, row) =>
 *       <PersonCell name={row.name} src={row.photoUrl} subtitle={row.familyName} /> }
 *
 * Avatar props: name, src (photo url, lazy loaded, falls back to initials if it fails),
 *   size 24|32|40|56 (default 32), status ('active'|'inactive'|'pending'|'danger'|'online'),
 *   badge (ReactNode, or a short string rendered as a red corner chip), tone (1-6, else
 *   derived from a stable hash of the name so a name always keeps its colour), className.
 * PersonCell props: Avatar props + subtitle, to (optional link), className.
 * Helpers exported: initialsOf(name), toneForName(name).
 * Alt text: photo uses the person's name; initials expose role="img" with the name.
 * Dark mode: tints switch to translucent versions of the same hues.
 */
import { ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';

export type AvatarSize = 24 | 32 | 40 | 56;
export type AvatarStatus = 'active' | 'online' | 'inactive' | 'pending' | 'danger';

const TONES = [
  'bg-[#E7F1EC] text-[#0B4837] dark:bg-brand-lime/15 dark:text-brand-lime',
  'bg-[#EEF6DF] text-[#3F6B0E] dark:bg-lime-400/15 dark:text-lime-300',
  'bg-[#FFF6CC] text-[#7A5B00] dark:bg-yellow-400/15 dark:text-yellow-300',
  'bg-[#E8F0FB] text-[#1F4E8C] dark:bg-blue-400/15 dark:text-blue-300',
  'bg-[#F3ECFA] text-[#5B3A8C] dark:bg-purple-400/15 dark:text-purple-300',
  'bg-[#EEF3F0] text-[#4A5A52] dark:bg-surface-raised dark:text-surface-muted',
];

const SIZES: Record<AvatarSize, { box: string; text: string; icon: number; dot: string }> = {
  24: { box: 'h-6 w-6', text: 'text-[10px]', icon: 13, dot: 'h-2 w-2 border' },
  32: { box: 'h-8 w-8', text: 'text-[12px]', icon: 17, dot: 'h-2.5 w-2.5 border-2' },
  40: { box: 'h-10 w-10', text: 'text-[13px]', icon: 21, dot: 'h-2.5 w-2.5 border-2' },
  56: { box: 'h-14 w-14', text: 'text-[18px]', icon: 29, dot: 'h-3 w-3 border-2' },
};

const DOT: Record<AvatarStatus, string> = {
  active: 'bg-[#1E9B63]',
  online: 'bg-[#1E9B63]',
  inactive: 'bg-[#98A59F]',
  pending: 'bg-[#E0B400]',
  danger: 'bg-[#D9534F]',
};

/** Stable 1-6 tone index from a name (same name, same colour, everywhere). */
export function toneForName(name?: string | null): number {
  const s = (name || '').trim().toLowerCase();
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (Math.abs(h) % TONES.length) + 1;
}

const firstGlyphs = (word: string, n: number): string => {
  const Seg = (Intl as any).Segmenter;
  const parts: string[] = Seg
    ? Array.from(new Seg(undefined, { granularity: 'grapheme' }).segment(word), (x: any) => x.segment)
    : Array.from(word);
  return parts.slice(0, n).join('');
};

/** "Hamza Kutty" -> "HK", "Madeena" -> "MA", "" -> "". */
export function initialsOf(name?: string | null): string {
  const words = (name || '').replace(/[^\p{L}\p{M}\p{N}\s\-._]/gu, '').split(/[\s\-._]+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return firstGlyphs(words[0], 2).toUpperCase();
  return (firstGlyphs(words[0], 1) + firstGlyphs(words[words.length - 1], 1)).toUpperCase();
}

export interface AvatarProps {
  name?: string | null;
  src?: string | null;
  size?: AvatarSize;
  status?: AvatarStatus;
  badge?: ReactNode;
  tone?: 1 | 2 | 3 | 4 | 5 | 6;
  className?: string;
}

export default function Avatar({ name, src, size = 32, status, badge, tone, className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const sz = SIZES[size];
  const initials = initialsOf(name);
  const hasPhoto = !!src && !failed;
  const toneClass = TONES[(tone ?? toneForName(name)) - 1];

  return (
    <span className={cn('relative inline-flex shrink-0', sz.box, className)}>
      <span
        className={cn(
          'inline-flex h-full w-full items-center justify-center overflow-hidden rounded-full font-extrabold leading-none',
          sz.text,
          !hasPhoto && (initials ? toneClass : TONES[5])
        )}
        {...(hasPhoto ? {} : { role: 'img', 'aria-label': name?.trim() || 'No name' })}
      >
        {hasPhoto ? (
          <img
            src={src!}
            alt={name?.trim() ? `Photo of ${name.trim()}` : 'Profile photo'}
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : initials ? (
          <span aria-hidden="true">{initials}</span>
        ) : (
          <svg width={sz.icon} height={sz.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
        )}
      </span>
      {status && (
        <span
          aria-hidden="true"
          title={status}
          className={cn('absolute -bottom-px -right-px rounded-full border-white dark:border-surface-card', sz.dot, DOT[status])}
        />
      )}
      {badge != null && badge !== false && (
        <span className="absolute -bottom-1.5 -right-1.5 flex">
          {typeof badge === 'string' ? (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-[#FDECEA] px-0.5 text-[8px] font-extrabold text-[#B3261E] dark:border-surface-card dark:bg-red-500/20 dark:text-red-300">
              {badge}
            </span>
          ) : (
            badge
          )}
        </span>
      )}
    </span>
  );
}

export interface AvatarStackProps {
  items: { name?: string | null; src?: string | null }[];
  max?: number;
  size?: 24 | 32 | 40;
  className?: string;
}

export function AvatarStack({ items, max = 3, size = 32, className }: AvatarStackProps) {
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  const ring = 'rounded-full ring-2 ring-white dark:ring-surface-card';
  return (
    <span className={cn('inline-flex items-center', className)} role="group" aria-label={`${items.length} people`}>
      {shown.map((p, i) => (
        <Avatar key={i} name={p.name} src={p.src} size={size} className={cn(ring, i > 0 && '-ml-2.5')} />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            ring,
            SIZES[size].box,
            SIZES[size].text,
            '-ml-2.5 inline-flex items-center justify-center bg-[#0B4837] font-extrabold text-white dark:bg-brand-lime dark:text-primary-950'
          )}
          aria-label={`and ${rest} more`}
        >
          +{rest}
        </span>
      )}
    </span>
  );
}

export interface PersonCellProps extends Omit<AvatarProps, 'className'> {
  subtitle?: ReactNode;
  /** Makes the name a link. */
  to?: string;
  className?: string;
}

/** Avatar + name + optional subtitle: the first column of a people table. */
export function PersonCell({ subtitle, to, className, name, ...avatar }: PersonCellProps) {
  const label = name?.trim() || '-';
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <Avatar name={name} {...avatar} />
      <div className="min-w-0 flex-1 leading-tight">
        {to ? (
          <Link to={to} onClick={(e) => e.stopPropagation()} className="block break-words font-semibold text-[#18231E] line-clamp-2 sm:line-clamp-none sm:truncate hover:underline dark:text-surface-text">
            {label}
          </Link>
        ) : (
          <span className="block break-words font-semibold text-[#18231E] line-clamp-2 sm:line-clamp-none sm:truncate dark:text-surface-text">{label}</span>
        )}
        {subtitle ? <span className="mt-0.5 block break-words text-[12px] line-clamp-2 sm:line-clamp-none sm:truncate font-normal text-[#7B8983] dark:text-surface-muted">{subtitle}</span> : null}
      </div>
    </div>
  );
}
