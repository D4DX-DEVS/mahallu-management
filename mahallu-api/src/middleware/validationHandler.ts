import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { MESSAGES } from '../utils/userMessages';

/**
 * Turns express-validator output into something a form can show.
 *
 * The raw `errors.array()` carries the submitted value, the field path and the
 * validator's own wording — none of which belongs in front of a user. Only the
 * field name and the message written for that field go out, and the top-level
 * `message` is the first of those so a single-line toast still reads well.
 */
export const validationHandler = (req: Request, res: Response, next: NextFunction) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const errors = result.array().map((error) => {
    const field = 'path' in error ? (error.path as string) : undefined;
    return { field, message: error.msg as string, msg: error.msg as string };
  });

  return res.status(400).json({
    success: false,
    message: errors[0]?.message || MESSAGES.invalidInput,
    errors,
  });
};
