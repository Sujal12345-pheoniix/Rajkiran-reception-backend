import { Router } from "express";
import type { Request, Response } from "express";
import prisma from "../db/prisma.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { generatePatientId } from "../lib/util.js";
import { validate } from "../middleware/validate.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { HttpError } from "../middleware/errorHandler.js";
import { createPatientSchema, type CreatePatient } from "../schemas/patient.js";

const router = Router();

router.use(authenticate);

// ─── POST /api/patient — Create a new patient ─────────────────────────────────
// BUG FIX: Added validate(createPatientSchema) — was missing before
router.post(
  "/",
  authorize("receptionist", "admin"),
  validate(createPatientSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const patientData = req.validated as CreatePatient;

    // Check for duplicate mobile number
    const existing = await prisma.patient.findFirst({
      where: { mobile: patientData.mobile },
    });
    if (existing) {
      throw new HttpError(409, `Patient with mobile ${patientData.mobile} already exists (ID: ${existing.unique_id})`);
    }

    // Generate unique patient ID with collision check
    let unique_id = generatePatientId();
    let attempts = 0;
    while (attempts < 5) {
      const idExists = await prisma.patient.findFirst({ where: { unique_id } });
      if (!idExists) break;
      unique_id = generatePatientId();
      attempts++;
    }

    const newPatient = await prisma.patient.create({
      data: {
        ...patientData,
        email: patientData.email || null,
        alternate_mobile: patientData.alternate_mobile || null,
        unique_id,
        created_by: req.user!.sub, // From authenticated token, not body
      },
    });

    res.status(201).json({
      success: true,
      message: "Patient created successfully",
      data: newPatient.unique_id,
    });
  }),
);

// ─── GET /api/patient — List patients with pagination ─────────────────────────
// BUG FIX: Was using page as raw offset. Fixed to (page-1)*limit pattern.
router.get(
  "/",
  authorize("receptionist", "admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
        select: {
          patient_id: true,
          unique_id: true,
          first_name: true,
          last_name: true,
          dob: true,
          gender: true,
          mobile: true,
          email: true,
          address: true,
          created_at: true,
        },
      }),
      prisma.patient.count(),
    ]);

    res.status(200).json({
      success: true,
      data: patients,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }),
);

// ─── GET /api/patient/search/:q — Search patients ────────────────────────────
// IMPORTANT: This MUST be registered BEFORE /:id to avoid route conflict
// BUG FIX: Added mode:"insensitive" to prevent case-sensitive SQL injection risk
router.get(
  "/search/:q",
  authorize("receptionist", "admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const { q } = req.params as { q: string };
    if (!q || q.trim().length < 1) throw new HttpError(400, "Search query is required");

    const sanitizedQ = (q as string).trim().slice(0, 100); // Limit query length

    const patients = await prisma.patient.findMany({
      where: {
        OR: [
          { first_name: { contains: sanitizedQ, mode: "insensitive" } },
          { last_name: { contains: sanitizedQ, mode: "insensitive" } },
          { unique_id: { contains: sanitizedQ.toUpperCase() } },
          { mobile: { contains: sanitizedQ } },
        ],
      },
      orderBy: { created_at: "desc" },
      select: {
        patient_id: true,
        first_name: true,
        last_name: true,
        unique_id: true,
        dob: true,
        mobile: true,
        gender: true,
        address: true,
        email: true,
      },
      take: 20,
    });

    res.status(200).json({
      success: true,
      message: "Search completed",
      data: patients,
    });
  }),
);

// ─── GET /api/patient/:id — Get patient by unique_id ─────────────────────────
router.get(
  "/:id",
  authorize("receptionist", "admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    if (!id) throw new HttpError(400, "Patient ID is required");

    const patient = await prisma.patient.findFirst({
      where: { unique_id: id },
      include: {
        visits: {
          orderBy: { visit_date: "desc" },
          take: 10,
          select: {
            visit_id: true,
            visit_date: true,
            visit_type: true,
            consultation_fee: true,
            doctor: {
              select: {
                first_name: true,
                last_name: true,
                specialization: true,
              },
            },
            bill: {
              select: {
                payment_status: true,
                total_amount: true,
              },
            },
          },
        },
        patient_allergies: {
          include: { allergy: true },
        },
        patient_chronic_conditions: {
          include: { condition: true },
        },
      },
    });

    if (!patient) throw new HttpError(404, "Patient not found");

    res.status(200).json({
      success: true,
      message: "Patient retrieved successfully",
      data: patient,
    });
  }),
);

// ─── PATCH /api/patient/:id — Update patient ─────────────────────────────────
router.patch(
  "/:id",
  authorize("receptionist", "admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;

    const patient = await prisma.patient.findFirst({ where: { unique_id: id } });
    if (!patient) throw new HttpError(404, "Patient not found");

    const allowedUpdates = ["first_name", "last_name", "email", "address", "alternate_mobile", "mobile"];
    const updateData: Record<string, unknown> = {};
    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updateData[key] = req.body[key];
      }
    }

    const updated = await prisma.patient.update({
      where: { patient_id: patient.patient_id },
      data: updateData,
    });

    res.json({ success: true, data: updated });
  }),
);

export default router;
