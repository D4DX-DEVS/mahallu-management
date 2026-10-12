import { Request } from 'express';

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface PaginationResult {
  page: number;
  limit: number;
  skip: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: PaginationResult;
}

export const MAX_LIMIT = 1000;
export const MAX_ALL_LIMIT = 5000;

/**
 * Extract pagination parameters from request query
 */
export const getPaginationParams = (req: Request): { page: number; limit: number; skip: number } => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  // Default 10. Cap 1000 (CMS pickers/exports ask for 1000-10000). `all=true` lifts the cap to 5000 for lookup lists.
  const all = req.query.all === 'true' || req.query.all === '1';
  const cap = all ? MAX_ALL_LIMIT : MAX_LIMIT;
  const requested = parseInt(req.query.limit as string) || (all ? cap : 10);
  const limit = Math.min(cap, Math.max(1, requested));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

/**
 * Create pagination response
 */
export const createPaginationResponse = <T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> => {
  const totalPages = Math.ceil(total / limit);

  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      skip: (page - 1) * limit,
      total,
      totalPages,
    },
  };
};

