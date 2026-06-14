import { Router } from "express";
import type { Request, Response } from "express";
import prisma from "../db/prisma.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validate } from "../middleware/validate.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { HttpError } from "../middleware/errorHandler.js";
import { createDoctorSchema, type CreateDoctor } from "../schemas/doctor.js";

const router = Router();

router.use(authenticate);

// ─── GET /api/doctor — Get all active departments with their doctors ──────────
// BUG FIX: Was registered AFTER /:department_id so it was unreachable.
// Now registered FIRST so Express matches it correctly.
// BUG FIX: Also allowed admin role (was only receptionist).
router.get(
  "/",
  authorize("receptionist", "admin"),
  asyncHandler(async (_req, res) => {
    const departments = await prisma.department.findMany({
      where: { status: "active" },
      select: {
        department_id: true,
        name: true,
        status: true,
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
      orderBy: { name: "asc" },
    });
    res.status(200).json({ success: true, data: departments });
  }),
);

// ─── GET /api/doctor/:department_id — Get doctors for a department ────────────
router.get(
  "/:department_id",
  authorize("receptionist", "admin"),
  asyncHandler(async (req, res) => {
    const departmentId = req.params.department_id as string;
    if (!departmentId) throw new HttpError(400, "Department ID is required");

    const doctors = await prisma.doctor.findMany({
      where: { status: "active", department_id: departmentId },
      select: {
        doctor_id: true,
        first_name: true,
        last_name: true,
        specialization: true,
        qualification: true,
        consultation_fee: true,
        status: true,
        mobile: true,
        email: true,
      },
      orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
    });

    res.status(200).json({ success: true, data: doctors });
  }),
);

// ─── POST /api/doctor — Register new doctor (admin only) ─────────────────────
router.post(
  "/",
  authorize("admin"),
  validate(createDoctorSchema),
  asyncHandler(async (req, res) => {
    const doctor = req.validated as CreateDoctor;

    const currentDoctor = await prisma.doctor.findFirst({
      where: { email: doctor.email },
    });
    if (currentDoctor) throw new HttpError(409, "A doctor with this email already exists");

    const newDoctor = await prisma.doctor.create({
      data: {
        ...doctor,
        created_by: req.user!.sub,
      },
      select: {
        doctor_id: true,
        first_name: true,
        last_name: true,
        email: true,
        mobile: true,
        specialization: true,
        qualification: true,
        consultation_fee: true,
        status: true,
        department_id: true,
        created_at: true,
      },
    });

    res.status(201).json({ success: true, data: newDoctor });
  }),
);

// ─── PATCH /api/doctor/:id — Update doctor (admin only) ──────────────────────
router.patch(
  "/:id",
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    const updates = req.body as Partial<CreateDoctor & { status: string }>;

    const doctor = await prisma.doctor.findUnique({ where: { doctor_id: id } });
    if (!doctor) throw new HttpError(404, "Doctor not found");

    const updated = await prisma.doctor.update({
      where: { doctor_id: id },
      data: updates,
      select: {
        doctor_id: true,
        first_name: true,
        last_name: true,
        email: true,
        specialization: true,
        consultation_fee: true,
        status: true,
        department_id: true,
      },
    });

    res.json({ success: true, data: updated });
  }),
);

export default router;
