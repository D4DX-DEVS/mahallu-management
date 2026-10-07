/**
 * Pure helpers for the Family / Member wallet pages (no imports, so they can be checked with plain node).
 *
 * The pages used to call GET /collectibles/wallet once per family taken from the first page of 10 and
 * summed those, so "Total Balance" was wrong beyond ten families and cost one request per family. The
 * server now returns one page of rows for every family/member plus `summary` over the whole filtered set
 * (GET /collectibles/wallets); these helpers only shape the request and the response.
 */

export type WalletListType = 'family' | 'member';

export interface WalletListRow {
  /** Missing when the family/member has no wallet yet (balance 0). */
  walletId?: string;
  familyId?: string;
  memberId?: string;
  name: string;
  mahallId?: string;
  /** Members only. */
  familyName?: string;
  balance: number;
  lastTransactionDate?: string | null;
}

export interface WalletListSummary {
  /** Sum of every balance in the filtered set, across all pages. */
  totalBalance: number;
  /** Families / members in the filtered set. */
  count: number;
  /** How many of them have a wallet document. */
  walletCount: number;
  /** How many of them have a balance above zero. */
  activeCount: number;
}

export interface WalletListPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface WalletListResult {
  data: WalletListRow[];
  pagination: WalletListPagination | null;
  summary: WalletListSummary;
}

export const EMPTY_WALLET_SUMMARY: WalletListSummary = { totalBalance: 0, count: 0, walletCount: 0, activeCount: 0 };

export const WALLET_PAGE_SIZE = 10;

const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** Query for GET /collectibles/wallets. An empty search is left out; the search is sent as typed. */
export const buildWalletListParams = (
  type: WalletListType,
  opts: { page?: number; limit?: number; search?: string } = {}
): Record<string, string | number> => {
  const params: Record<string, string | number> = { type };
  if (opts.page && opts.page > 0) params.page = Math.floor(opts.page);
  if (opts.limit && opts.limit > 0) params.limit = Math.min(100, Math.floor(opts.limit));
  const search = (opts.search ?? '').trim();
  if (search) params.search = search;
  return params;
};

export const normalizeWalletListSummary = (raw: unknown): WalletListSummary => {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    totalBalance: num(s.totalBalance),
    count: num(s.count),
    walletCount: num(s.walletCount),
    activeCount: num(s.activeCount),
  };
};

/** The API body -> rows, pagination and summary, tolerant of missing pieces. */
export const normalizeWalletListResponse = (body: unknown): WalletListResult => {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const rawRows: Partial<WalletListRow>[] = Array.isArray(b.data) ? (b.data as Partial<WalletListRow>[]) : [];
  const data: WalletListRow[] = rawRows.map((row) => ({
    ...row,
    name: typeof row?.name === 'string' ? row.name : '',
    balance: num(row?.balance),
  }));
  const p = b.pagination as Record<string, unknown> | null | undefined;
  const pagination: WalletListPagination | null =
    p && typeof p === 'object'
      ? {
          page: num(p.page) || 1,
          limit: num(p.limit) || data.length,
          total: num(p.total),
          totalPages: num(p.totalPages),
        }
      : null;
  return { data, pagination, summary: normalizeWalletListSummary(b.summary) };
};

/** Totals for a list that is already complete (the single family/member view shows one row). */
export const summarizeWalletRows = (rows: WalletListRow[]): WalletListSummary => {
  const totalBalance = Math.round((rows.reduce((sum, r) => sum + num(r.balance), 0) + Number.EPSILON) * 100) / 100;
  return {
    totalBalance,
    count: rows.length,
    walletCount: rows.filter((r) => !!r.walletId).length,
    activeCount: rows.filter((r) => num(r.balance) > 0).length,
  };
};

/** One row for the "?familyId=" / "?memberId=" view, from GET /collectibles/wallet and the owner's record. */
export const singleWalletRow = (
  type: WalletListType,
  owner: { id: string; name?: string; mahallId?: string },
  wallet?: { id?: string; balance?: number; lastTransactionDate?: string | null } | null
): WalletListRow => ({
  ...(wallet?.id ? { walletId: wallet.id } : {}),
  ...(type === 'family' ? { familyId: owner.id } : { memberId: owner.id }),
  name: owner.name ?? '',
  ...(owner.mahallId ? { mahallId: owner.mahallId } : {}),
  balance: num(wallet?.balance),
  lastTransactionDate: wallet?.lastTransactionDate ?? null,
});
