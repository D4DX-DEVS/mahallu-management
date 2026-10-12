/** Shared control surface (also used by Select/SearchableSelect triggers): 36px, 10px radius, lime focus ring. */
export const controlClasses =
  'w-full rounded-[10px] border border-line-strong bg-white px-3 text-[13px] text-[#18231E] transition-[border-color,box-shadow] duration-150 ' +
  'placeholder:text-[#98A59F] hover:border-[#C9D6CF] ' +
  'focus:outline-none focus:border-primary-600 focus:shadow-focus ' +
  'disabled:cursor-not-allowed disabled:bg-[#F4F7F5] disabled:opacity-60 ' +
  'dark:border-surface-border-strong dark:bg-surface-raised dark:text-surface-text dark:placeholder:text-surface-muted dark:hover:border-[#4A5750] ' +
  'dark:focus:border-brand-lime dark:focus:shadow-[0_0_0_4px_rgba(142,193,62,.2)]';

export const controlErrorClasses =
  'border-[#D9534F] hover:border-[#D9534F] focus:border-[#D9534F] focus:shadow-focus-error dark:border-red-400 dark:focus:border-red-400';

export const labelClasses = 'mb-1.5 block text-xs font-semibold text-[#3A4741] dark:text-surface-text/80';

