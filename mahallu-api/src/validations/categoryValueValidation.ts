import { body } from 'express-validator';
import { MasterCategoryValue } from '../models/MasterCategory';

/**
 * Validates `field` against the live CategoryValue set for `categoryKey`,
 * replacing what used to be a hardcoded Mongoose `enum`. Checks values of
 * ANY status (not just active) — a value that was later deactivated must
 * remain a valid, saveable value on records that already carried it; only
 * new dropdown listings hide it.
 */
export const validCategoryValue = (categoryKey: string, field: string) =>
  body(field)
    .optional({ nullable: true, checkFalsy: true })
    .custom(async (value: string) => {
      const exists = await MasterCategoryValue.exists({ categoryKey, code: value });
      if (!exists) {
        throw new Error(`Invalid ${field}`);
      }
      return true;
    });
