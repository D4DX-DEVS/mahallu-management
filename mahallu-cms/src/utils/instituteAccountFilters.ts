/**
 * The filters of the Institute Accounts page, turned into API query params in ONE place so the visible
 * list and the export can never disagree (the export used to ignore the institute filter). Pure, no
 * imports, so it can be checked with plain node.
 */

export interface InstituteAccountFilters {
  /** 'all' (or empty) means every institute; otherwise an institute id. */
  instituteId?: string;
  /** Free text; applied by the server (name, bank, account number, IFSC) across all pages. */
  search?: string;
}

export interface InstituteAccountParams {
  instituteId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const buildInstituteAccountParams = (
  filters: InstituteAccountFilters,
  paging: { page?: number; limit?: number } = {}
): InstituteAccountParams => {
  const params: InstituteAccountParams = {};
  if (paging.page !== undefined) params.page = paging.page;
  if (paging.limit !== undefined) params.limit = paging.limit;
  const instituteId = (filters.instituteId ?? '').trim();
  if (instituteId && instituteId !== 'all') params.instituteId = instituteId;
  const search = (filters.search ?? '').trim();
  if (search) params.search = search;
  return params;
};
