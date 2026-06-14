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
  asyncHandler(async (_req, res) => {
    const departments = await prisma.department.findMany({
      where: { status: "active" },
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

    const department = await prisma.department.findUnique({
      where: { department_id },
      include: {
        doctors: {
          where: { status: "active" },
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

    const existing = await prisma.department.findFirst({ where: { name } });
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

// ─── PATCH /api/department/:id — Update department status (admin only) ───────
// BUG FIX: Was two duplicate POST /:id routes (activate + deactivate).
// Second route was dead code (unreachable). Now uses PATCH with explicit status.
router.patch(
  "/:id",
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const department_id = req.params.id as string;
    if (!department_id) throw new HttpError(400, "Department ID is required");

    const { status } = req.body as { status?: "active" | "inactive" };
    if (!status || !["active", "inactive"].includes(status)) {
      throw new HttpError(400, "Status must be 'active' or 'inactive'");
    }

    const department = await prisma.department.findUnique({ where: { department_id } });
    if (!department) throw new HttpError(404, "Department not found");

    const updated = await prisma.department.update({
      where: { department_id },
      data: { status },
    });

    res.json({ success: true, data: updated });
  }),
);

export default router;
