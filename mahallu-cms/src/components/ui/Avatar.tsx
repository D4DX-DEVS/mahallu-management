import { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  name?: string | null;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

function initials(name?: string | null) {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
}

export default function Avatar({ name, src, size = 'md', className, ...props }: AvatarProps) {
  return (
    <span
      className={cn(
        'inline-flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/80 bg-primary/10 font-semibold text-primary',
        size === 'sm' && 'h-7 w-7 text-[10px]',
        size === 'md' && 'h-9 w-9 text-xs',
        size === 'lg' && 'h-11 w-11 text-sm',
        className
      )}
      aria-label={name ? `${name} avatar` : 'User avatar'}
      {...props}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initials(name)}
    </span>
  );
}
