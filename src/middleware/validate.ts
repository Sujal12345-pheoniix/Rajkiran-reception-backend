import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";

type ValidationTarget = "body" | "query" | "params";

/**
 * Validates req[source] against the given Zod schema.
 * Uses safeParse to get typed Zod errors handled by errorHandler.
 * BUG FIX: Was using .parse() which throws raw ZodError through Express — now
 * passes to next(err) so errorHandler can format it properly.
 */
export function validate(schema: ZodSchema, source: ValidationTarget = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(result.error); // Passes to errorHandler which formats ZodError
      return;
    }
    (req as any).validated = { ...(req as any).validated, ...(result.data as Record<string, any>) };
    next();
  };
}
