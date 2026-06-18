import { Router } from "express";
import type { Request, Response } from "express";
import prisma from "../db/prisma.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validate } from "../middleware/validate.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { HttpError } from "../middleware/errorHandler.js";
import { departmentSchema } from "../schemas/department.js";

const router = Router();

router.use(authenticate);

// ─── GET /api/department — List all active departments ───────────────────────
router.get(
  "/",
  authorize("receptionist", "admin"),
  asyncHandler(async (req, res) => {
    const showAll = req.query.all === "true" && req.user!.role === "admin";
    const departments = await prisma.department.findMany({
      where: showAll ? { deleted_at: null } : { status: "active", deleted_at: null },
      orderBy: { name: "asc" },
    });
    res.json({ success: true, data: departments });
  }),
);

// ─── GET /api/department/:id — Get single department ─────────────────────────
router.get(
  "/:id",
  authorize("receptionist", "admin"),
  asyncHandler(async (req, res) => {
    const department_id = req.params.id as string;
    if (!department_id) throw new HttpError(400, "Department ID is required");

    const department = await prisma.department.findFirst({
      where: { department_id, deleted_at: null },
      include: {
        doctors: {
          where: { status: "active", deleted_at: null },
          select: {
            doctor_id: true,
            first_name: true,
            last_name: true,
            specialization: true,
            consultation_fee: true,
            status: true,
          },
        },
      },
    });

    if (!department) throw new HttpError(404, "Department not found");
    res.json({ success: true, data: department });
  }),
);

// ─── POST /api/department — Create department (admin only) ───────────────────
router.post(
  "/",
  authorize("admin"),
  validate(departmentSchema),
  asyncHandler(async (req, res) => {
    const { name, status, description } = req.validated as {
      name: string;
      status: "active" | "inactive";
      created_by?: string;
      description?: string;
    };

    const existing = await prisma.department.findFirst({ where: { name, deleted_at: null } });
    if (existing) throw new HttpError(409, "Department with this name already exists");

    const department = await prisma.department.create({
      data: {
        name,
        status: status ?? "active",
        created_by: req.user!.sub, // Use authenticated user, not body
        description,
      },
    });

    res.status(201).json({ success: true, data: department });
  }),
);

// ─── PATCH /api/department/:id — Update department (admin only) ──────────────
router.patch(
  "/:id",
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const department_id = req.params.id as string;
    if (!department_id) throw new HttpError(400, "Department ID is required");

    const { name, status, description } = req.body as { name?: string; status?: "active" | "inactive"; description?: string };

    const department = await prisma.department.findFirst({ where: { department_id, deleted_at: null } });
    if (!department) throw new HttpError(404, "Department not found");

    if (name) {
      const existing = await prisma.department.findFirst({
        where: { name, department_id: { not: department_id }, deleted_at: null }
      });
      if (existing) throw new HttpError(409, "Another department with this name already exists");
    }

    const updated = await prisma.department.update({
      where: { department_id },
      data: { name, status, description },
    });

    res.json({ success: true, data: updated });
  }),
);

// ─── DELETE /api/department/:id — Delete department (admin only) ──────────────
router.delete(
  "/:id",
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const permanent = req.query.permanent === "true";

    const department = await prisma.department.findFirst({ where: { department_id: id, deleted_at: null } });
    if (!department) throw new HttpError(404, "Department not found");

    if (permanent) {
      await prisma.department.delete({ where: { department_id: id } });
    } else {
      await prisma.department.update({
        where: { department_id: id },
        data: { deleted_at: new Date(), status: "inactive" },
      });
    }

    res.json({ success: true, message: permanent ? "Department permanently deleted" : "Department soft deleted" });
  }),
);

export default router;
