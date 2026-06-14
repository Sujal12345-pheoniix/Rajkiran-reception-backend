import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

const isProd = () => process.env.NODE_ENV === "production";

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validation Error",
      details: err.issues.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      })),
    });
    return;
  }

  // Application-level HTTP errors (safe to show message)
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  // Prisma unique constraint violation
  if ((err as any).code === "P2002") {
    const field = (err as any).meta?.target?.[0] ?? "field";
    res.status(409).json({ error: `A record with this ${field} already exists` });
    return;
  }

  // Prisma record not found
  if ((err as any).code === "P2025") {
    res.status(404).json({ error: "Record not found" });
    return;
  }

  // CORS errors
  if (err.message?.startsWith("CORS:")) {
    res.status(403).json({ error: err.message });
    return;
  }

  // Unknown errors — NEVER expose stack traces in production
  if (!isProd()) {
    console.error("Unhandled error:", err);
    res.status(500).json({
      error: "Internal Server Error",
      ...(err.message && { detail: err.message }),
      stack: err.stack,
    });
  } else {
    // Log for monitoring but don't expose to client
    console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
