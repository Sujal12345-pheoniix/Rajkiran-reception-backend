import type { Request, Response, NextFunction } from "express";

/**
 * Express 5 does not catch async errors automatically.
 * Wrap every async route handler with this.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
