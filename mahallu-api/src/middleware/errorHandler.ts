import { Request, Response, NextFunction } from 'express';
import { logFailure, statusForError, toUserMessage } from '../utils/userMessages';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

/**
 * Last stop for anything that escapes a handler.
 *
 * The full error — message, stack, driver detail — goes to the server log.
 * The response carries only copy the person on the other end can act on.
 */
export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logFailure(`${req.method} ${req.originalUrl}`, err);

  // A handler that already began writing cannot be given a second status line;
  // trying throws inside the error handler itself. Let Express close the socket.
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = statusForError(err, err.statusCode || 500);

  res.status(statusCode).json({
    success: false,
    message: toUserMessage(err),
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
