import { Router } from "express";
import type { Request, Response } from "express";
import prisma from "../db/prisma.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validate } from "../middleware/validate.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { HttpError } from "../middleware/errorHandler.js";
import {
  createUserSchema,
  updateUserSchema,
  paramsSchema,
  paginationSchema,
} from "../schemas/user.js";

const router = Router();

// All user management requires admin auth
router.use(authenticate, authorize("admin"));

// ─── GET /api/users — List users with pagination ──────────────────────────────
router.get(
  "/",
  validate(paginationSchema, "query"),
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = req.validated as { page: number; limit: number };
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
        select: {
          user_id: true,
          username: true,
          role: true,
          is_active: true,
          last_login: true,
          created_at: true,
        },
      }),
      prisma.user.count(),
    ]);

    res.json({
      success: true,
      data: users,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }),
);

// ─── GET /api/users/:id ────────────────────────────────────────────────────────
router.get(
  "/:id",
  validate(paramsSchema, "params"),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.validated as { id: string };
    const user = await prisma.user.findUnique({
      where: { user_id: id },
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
    res.json({ success: true, data: user });
  }),
);

// ─── POST /api/users — Create user ────────────────────────────────────────────
router.post(
  "/",
  validate(createUserSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.validated as { username: string; password: string; role?: string };

    const existing = await prisma.user.findUnique({ where: { username: body.username } });
    if (existing) throw new HttpError(409, "Username already exists");

    const { hashPassword } = await import("../lib/password.js");
    const password = await hashPassword(body.password);

    const user = await prisma.user.create({
      data: {
        username: body.username,
        password,
        role: body.role ?? "receptionist",
        created_by: req.user!.sub,
      },
      select: {
        user_id: true,
        username: true,
        role: true,
        is_active: true,
        created_at: true,
      },
    });
    res.status(201).json({ success: true, data: user });
  }),
);

// ─── PATCH /api/users/:id — Update user status/role ──────────────────────────
// BUG FIX: Was merging params and body into same req.validated, id could be
// overwritten by body. Now reads id directly from req.params.
router.patch(
  "/:id",
  validate(paramsSchema, "params"),
  validate(updateUserSchema),
  asyncHandler(async (req: Request, res: Response) => {
    // BUG FIX: Read id from req.params directly, not req.validated
    const id = req.params.id as string;
    const body = req.body as { role?: "admin" | "receptionist"; is_active?: boolean };

    // Prevent admin from deactivating themselves
    if (id === req.user!.sub && body.is_active === false) {
      throw new HttpError(400, "You cannot deactivate your own account");
    }

    const exists = await prisma.user.findUnique({ where: { user_id: id } });
    if (!exists) throw new HttpError(404, "User not found");

    const user = await prisma.user.update({
      where: { user_id: id },
      data: {
        ...(body.role !== undefined && { role: body.role }),
        ...(body.is_active !== undefined && { is_active: body.is_active }),
      },
      select: {
        user_id: true,
        username: true,
        role: true,
        is_active: true,
        last_login: true,
        created_at: true,
      },
    });
    res.json({ success: true, data: user });
  }),
);

// ─── DELETE /api/users/:id — Soft delete (deactivate) ────────────────────────
// BUG FIX: Was hard-deleting which breaks visits/bills foreign keys.
// Changed to soft-delete (set is_active = false).
router.delete(
  "/:id",
  validate(paramsSchema, "params"),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;

    if (id === req.user!.sub) {
      throw new HttpError(400, "You cannot delete your own account");
    }

    const exists = await prisma.user.findUnique({ where: { user_id: id } });
    if (!exists) throw new HttpError(404, "User not found");

    // Soft delete instead of hard delete to preserve referential integrity
    await prisma.user.update({
      where: { user_id: id },
      data: { is_active: false },
    });

    res.status(200).json({ success: true, message: "User deactivated successfully" });
  }),
);

export default router;
