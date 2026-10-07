import { FiShield } from 'react-icons/fi';

/*
 * Rendered once, full-bleed above the entire app shell (sidebar included) so the
 * sidebar's top section and the header stay vertically aligned on every route —
 * previously this lived inside Header only, so it pushed the content-side header
 * down without the sidebar's brand row moving with it.
 */
export default function TenantBanner() {
  return (
    <div className="fixed inset-x-0 top-0 z-[65] flex h-9 flex-shrink-0 items-center justify-center gap-2 bg-primary px-4 text-label text-primary-foreground">
      <FiShield className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
      <span className="font-medium">Viewing as tenant</span> <span aria-hidden="true">·</span>
      <span className="hidden sm:inline">All data is filtered to the selected tenant</span>
    </div>
  );
}
