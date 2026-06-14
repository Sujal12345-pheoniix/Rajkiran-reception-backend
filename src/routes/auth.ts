import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import prisma from "../db/prisma.js";
import { validate } from "../middleware/validate.js";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  loginSchema,
  receptionLoginSchema,
  receptionRegistrationSchema,
  registerSchema,
} from "../schemas/auth.js";
import { comparePassword, hashPassword } from "../lib/password.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  accessCookieOptions,
  refreshCookieOptions,
  clearAccessCookieOptions,
  clearRefreshCookieOptions,
} from "../lib/jwt.js";
import { HttpError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authLimiter } from "../middleware/limiter.js";

const router = Router();

// ─── POST /api/auth/login — Admin login ───────────────────────────────────────
// BUG FIX: Added validate(loginSchema) middleware that was missing
router.post(
  "/login",
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { username, password } = req.validated as {
      username: string;
      password: string;
    };

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) throw new HttpError(401, "Invalid username or password");
    if (!user.is_active) throw new HttpError(401, "Account is deactivated");

    const valid = await comparePassword(password, user.password);
    if (!valid) throw new HttpError(401, "Invalid username or password");

    await prisma.user.update({
      where: { user_id: user.user_id },
      data: { last_login: new Date() },
    });

    const payload = {
      sub: user.user_id,
      username: user.username,
      role: user.role,
    };
    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken(payload),
      signRefreshToken(payload),
    ]);

    res
      .cookie("access_token", accessToken, accessCookieOptions)
      .cookie("refresh_token", refreshToken, refreshCookieOptions)
      .json({
        user: { id: user.user_id, username: user.username, role: user.role },
      });
  }),
);

// ─── POST /api/auth/reception/login — Receptionist login ─────────────────────
router.post(
  "/reception/login",
  authLimiter,
  validate(receptionLoginSchema),
  asyncHandler(async (req, res) => {
    const { username, password } = req.validated as {
      username: string;
      password: string;
    };

    const user = await prisma.user.findFirst({
      where: { username, role: "receptionist" },
    });
    if (!user) throw new HttpError(401, "Invalid username or password");
    if (!user.is_active) throw new HttpError(401, "Account is deactivated");

    const valid = await comparePassword(password, user.password);
    if (!valid) throw new HttpError(401, "Invalid username or password");

    await prisma.user.update({
      where: { user_id: user.user_id },
      data: { last_login: new Date() },
    });

    const payload = {
      sub: user.user_id,
      username: user.username,
      role: user.role,
    };
    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken(payload),
      signRefreshToken(payload),
    ]);

    res
      .cookie("access_token", accessToken, accessCookieOptions)
      .cookie("refresh_token", refreshToken, refreshCookieOptions)
      .json({
        user: { id: user.user_id, username: user.username, role: user.role },
      });
  }),
);

// ─── POST /api/auth/register — Create first admin (bootstrap only) ─────────
// BUG FIX: Was completely unprotected — anyone could create admin accounts.
// Now protected: only an existing admin can create new users, OR it's allowed
// only when no admin exists yet (bootstrap scenario).
router.post(
  "/register",
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { username, password } = req.validated as {
      username: string;
      password: string;
    };

    // Bootstrap: allow first admin registration if no admin exists
    const adminCount = await prisma.user.count({ where: { role: "admin" } });

    // If admins exist, require authentication
    if (adminCount > 0) {
      // Check auth manually without middleware (since this is a special endpoint)
      const cookieToken = req.cookies?.access_token;
      const header = req.headers.authorization;
      const token = cookieToken ?? (header?.startsWith("Bearer ") ? header.slice(7) : null);

      if (!token) throw new HttpError(401, "Not authenticated");

      const { verifyAccessToken } = await import("../lib/jwt.js");
      let caller;
      try {
        caller = await verifyAccessToken(token);
      } catch {
        throw new HttpError(401, "Invalid or expired session");
      }
      if (caller.role !== "admin") throw new HttpError(403, "Only admins can create admin accounts");
    }

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) throw new HttpError(409, "Username already exists");

    const hashedPassword = await hashPassword(password);
    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role: "admin",
        last_login: new Date(),
      },
    });

    const payload = {
      sub: newUser.user_id,
      username: newUser.username,
      role: newUser.role,
    };
    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken(payload),
      signRefreshToken(payload),
    ]);

    res
      .cookie("access_token", accessToken, accessCookieOptions)
      .cookie("refresh_token", refreshToken, refreshCookieOptions)
      .status(201)
      .json({
        user: {
          id: newUser.user_id,
          username: newUser.username,
          role: newUser.role,
        },
      });
  }),
);

// ─── POST /api/auth/reception/register — Create receptionist (admin only) ────
router.post(
  "/reception/register",
  authenticate,
  authorize("admin"),
  validate(receptionRegistrationSchema),
  asyncHandler(async (req, res) => {
    // BUG FIX: created_by now comes from authenticated token, not request body
    const { username, password } = req.validated as {
      username: string;
      password: string;
      created_by?: string;
    };

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) throw new HttpError(409, "Username already taken");

    const hashedPassword = await hashPassword(password);
    const newReceptionist = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role: "receptionist",
        created_by: req.user!.sub, // BUG FIX: from authenticated user, not body
      },
      select: {
        user_id: true,
        username: true,
        role: true,
        is_active: true,
        created_at: true,
      },
    });

    res.status(201).json({ data: newReceptionist });
  }),
);

// ─── POST /api/auth/refresh — Rotate both tokens using refresh cookie ─────────
// BUG FIX: refresh_token is read from cookie (was client sending in header)
router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const refreshToken: string | undefined = req.cookies?.refresh_token;
    if (!refreshToken) throw new HttpError(401, "Refresh token missing");

    let payload;
    try {
      payload = await verifyRefreshToken(refreshToken);
    } catch {
      // Clear invalid cookies on refresh failure
      res
        .clearCookie("access_token", clearAccessCookieOptions)
        .clearCookie("refresh_token", clearRefreshCookieOptions);
      throw new HttpError(401, "Invalid or expired refresh token. Please log in again.");
    }

    const user = await prisma.user.findUnique({
      where: { user_id: payload.sub },
    });
    if (!user) {
      res
        .clearCookie("access_token", clearAccessCookieOptions)
        .clearCookie("refresh_token", clearRefreshCookieOptions);
      throw new HttpError(401, "User not found");
    }
    if (!user.is_active) {
      res
        .clearCookie("access_token", clearAccessCookieOptions)
        .clearCookie("refresh_token", clearRefreshCookieOptions);
      throw new HttpError(401, "Account is deactivated");
    }

    const newPayload = {
      sub: user.user_id,
      username: user.username,
      role: user.role,
    };
    const [newAccess, newRefresh] = await Promise.all([
      signAccessToken(newPayload),
      signRefreshToken(newPayload),
    ]);

    res
      .cookie("access_token", newAccess, accessCookieOptions)
      .cookie("refresh_token", newRefresh, refreshCookieOptions)
      .json({ ok: true });
  }),
);

// ─── POST /api/auth/logout — Clear both cookies ───────────────────────────────
// BUG FIX: path was "/api" for access and "/api/auth" for refresh.
// Cookies were set with path:"/" so they were never actually cleared.
router.post(
  "/logout",
  asyncHandler(async (_req, res) => {
    res
      .clearCookie("access_token", clearAccessCookieOptions)
      .clearCookie("refresh_token", clearRefreshCookieOptions)
      .json({ ok: true });
  }),
);

// ─── GET /api/auth/me — Authenticated profile (via cookie or Bearer) ──────────
router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { user_id: req.user!.sub },
      select: {
        user_id: true,
        username: true,
        role: true,
        is_active: true,
        last_login: true,
        created_at: true,
      },
    });
    if (!user) throw new HttpError(404, "User not found");
    if (!user.is_active) throw new HttpError(401, "Account is deactivated");
    res.json(user);
  }),
);

export default router;
