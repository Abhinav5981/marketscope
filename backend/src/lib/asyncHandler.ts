import type { NextFunction, Request, RequestHandler, Response } from "express";

/** Wraps an async Express handler so a rejected promise reaches errorHandler instead of crashing the process. */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
