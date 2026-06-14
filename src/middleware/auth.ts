import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/jwt.js";
import { HttpError } from "./errorHandler.js";

/**
 * Reads JWT from `access_token` cookie (preferred) or `Authorization: Bearer` header.
 * Attaches `req.user` on success, throws 401 on failure.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const cookieToken = req.cookies?.access_token;

  if (cookieToken) {
    try {
      req.user = await verifyAccessToken(cookieToken);
      next();
      return;
    } catch {
      throw new HttpError(401, "Invalid or expired session");
    }
  }

  // Fallback: Bearer header
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      req.user = await verifyAccessToken(header.slice(7));
      next();
      return;
    } catch {
      throw new HttpError(401, "Invalid or expired token");
    }
  }

  throw new HttpError(401, "Not authenticated");
}

/**
 * Returns middleware that restricts access to the given roles.
 * Must be used after `authenticate`.
 */
export function authorize(...roles: string[]): (req: Request, _res: Response, next: NextFunction) => void {
  return (req, _res, next) => {
    if (!req.user) {
      throw new HttpError(401, "Not authenticated");
    }
    if (!roles.includes(req.user.role)) {
      throw new HttpError(403, "Insufficient permissions");
    }
    next();
  };
}
