/*
 * Shared class strings for the landing page. The marketing page deliberately
 * uses its own light palette rather than the app's theme tokens, so it reads
 * the same whether or not a signed-in visitor has dark mode on.
 */
export const CONTAINER = 'mx-auto w-full max-w-[1200px] px-5 sm:px-8';

const BTN_BASE =
  'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-[14px] font-bold transition-[background-color,color,border-color,transform,box-shadow] duration-200 ease-out hover:-translate-y-[2px] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

export const BTN_PRIMARY = `${BTN_BASE} bg-[#15603B] text-white shadow-[0_10px_24px_-12px_rgba(21,96,59,0.8)] hover:bg-[#124F31] hover:shadow-[0_16px_30px_-12px_rgba(21,96,59,0.75)] focus-visible:ring-[#15603B]`;

export const BTN_INVERSE = `${BTN_BASE} bg-white text-[#15603B] shadow-[0_10px_24px_-12px_rgba(0,0,0,0.5)] hover:bg-[#EEF6F1] hover:shadow-[0_16px_30px_-12px_rgba(0,0,0,0.5)] focus-visible:ring-white focus-visible:ring-offset-[#15603B]`;

export const CARD =
  'rounded-[18px] border border-[#E6E9EE] bg-white shadow-[0_18px_40px_-30px_rgba(25,32,36,0.35)]';
