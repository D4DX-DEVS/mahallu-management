import { BRAND_NAME, BRAND_TAGLINE, ICON_PATH } from '@/constants/theme';

interface BrandLogoProps {
  /** `md` for the header and footer, `lg` for the hero. */
  size?: 'md' | 'lg';
  /** `light` for dark backgrounds. */
  tone?: 'dark' | 'light';
  className?: string;
}

/**
 * The mark with the wordmark and tagline set in live type, so the tagline
 * stays readable at every size (in logo.png it is only a few pixels tall).
 */
export default function BrandLogo({ size = 'md', tone = 'dark', className = '' }: BrandLogoProps) {
  const large = size === 'lg';
  const wordmark = tone === 'light' ? 'text-white' : 'text-[#0E5A3A]';
  const tagline = tone === 'light' ? 'text-white/70' : 'text-[#3A454B]';

  return (
    <span className={`flex items-center ${large ? 'gap-4' : 'gap-3'} ${className}`}>
      <img
        src={ICON_PATH}
        alt=""
        aria-hidden="true"
        className={`shrink-0 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105 ${large ? 'h-16 w-16 rounded-[16px]' : 'h-12 w-12 rounded-[12px]'}`}
      />
      <span className="flex min-w-0 flex-col">
        <span
          className={`font-extrabold leading-none tracking-[-0.02em] ${wordmark} ${large ? 'text-[38px]' : 'text-[26px]'}`}
        >
          {BRAND_NAME}
        </span>
        <span
          className={`mt-1 font-semibold uppercase leading-tight tracking-[0.12em] ${tagline} ${
            large ? 'text-[12px]' : 'hidden text-[10px] sm:block'
          }`}
        >
          {BRAND_TAGLINE}
        </span>
      </span>
    </span>
  );
}
