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
router.post(
  "/",
  authorize("receptionist", "admin"),
  validate(createPatientSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const patientData = req.validated as CreatePatient;

    // Check for duplicate mobile number
    const existing = await prisma.patient.findFirst({
      where: { mobile: patientData.mobile },
      include: {
        _count: {
          select: { visits: true }
        }
      }
    });
    if (existing) {
      res.status(409).json({
        success: false,
        error: "DUPLICATE_PATIENT",
        message: `Patient with mobile ${patientData.mobile} already exists.`,
        patient: {
          patient_id: existing.patient_id,
          unique_id: existing.unique_id,
          first_name: existing.first_name,
          last_name: existing.last_name,
          visits_count: existing._count.visits,
        }
      });
      return;
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
        blood_group: patientData.blood_group || null,
        emergency_contact: patientData.emergency_contact || null,
        insurance_details: patientData.insurance_details || null,
        unique_id,
        created_by: req.user!.sub, // From authenticated token, not body
      },
    });

    // Create Audit Log
    await prisma.adminLog.create({
      data: {
        admin_id: req.user!.sub,
        action_type: "CREATE",
        target_type: "PATIENT",
        target_id: newPatient.patient_id,
        details: `Registered new patient: ${newPatient.first_name} ${newPatient.last_name} (${newPatient.unique_id})`,
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
        include: {
          visits: {
            orderBy: { visit_date: "desc" },
            take: 1,
            select: { visit_date: true }
          }
        }
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

// ─── GET /api/patient/search/:q — Search patients (Fuzzy/Multi-field) ─────────
router.get(
  "/search/:q",
  authorize("receptionist", "admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const { q } = req.params as { q: string };
    if (!q || q.trim().length < 1) throw new HttpError(400, "Search query is required");

    const sanitizedQ = q.trim().slice(0, 100);

    // Fetch doctors matching query to support searching by doctor name
    const doctors = await prisma.doctor.findMany({
      where: {
        OR: [
          { first_name: { contains: sanitizedQ, mode: "insensitive" } },
          { last_name: { contains: sanitizedQ, mode: "insensitive" } },
        ]
      },
      select: { doctor_id: true }
    });
    const doctorIds = doctors.map(d => d.doctor_id);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sanitizedQ);

    // Perform database search matching Name, Mobile, UHID, Doctor, Disease, Visit Number
    const patients = await prisma.patient.findMany({
      where: {
        OR: [
          { first_name: { contains: sanitizedQ, mode: "insensitive" } },
          { last_name: { contains: sanitizedQ, mode: "insensitive" } },
          { unique_id: { contains: sanitizedQ.toUpperCase() } },
          { mobile: { contains: sanitizedQ } },
          { alternate_mobile: { contains: sanitizedQ } },
          { address: { contains: sanitizedQ, mode: "insensitive" } },
          {
            visits: {
              some: {
                OR: [
                  { doctor_id: { in: doctorIds } },
                  { symptoms: { hasSome: [sanitizedQ] } },
                  { known_diseases: { hasSome: [sanitizedQ] } },
                  ...(isUuid ? [{ visit_id: sanitizedQ }] : [])
                ]
              }
            }
          }
        ],
      },
      orderBy: { created_at: "desc" },
      include: {
        visits: {
          orderBy: { visit_date: "desc" },
          take: 1,
          select: { visit_date: true }
        }
      },
      take: 50,
    });

    res.status(200).json({
      success: true,
      message: "Search completed",
      data: patients,
    });
  }),
);

// ─── POST /api/patient/:id/log-download — Log record download ──────────────────
router.post(
  "/:id/log-download",
  authorize("receptionist", "admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const patient = await prisma.patient.findFirst({ where: { unique_id: id } });
    if (!patient) throw new HttpError(404, "Patient not found");

    await prisma.adminLog.create({
      data: {
        admin_id: req.user!.sub,
        action_type: "DOWNLOAD",
        target_type: "PATIENT_RECORD",
        target_id: patient.patient_id,
        details: `Downloaded complete Medical Report PDF for Patient: ${patient.first_name} ${patient.last_name} (${patient.unique_id})`,
      },
    });

    res.status(200).json({ success: true });
  })
);

// ─── GET /api/patient/:id — Get patient 360 profile by unique_id ──────────────
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
          include: {
            doctor: {
              select: {
                first_name: true,
                last_name: true,
                specialization: true,
                department: true,
              },
            },
            vitals: true,
            bill: true,
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

    // Add activity logging for record view
    await prisma.adminLog.create({
      data: {
        admin_id: req.user!.sub,
        action_type: "VIEW",
        target_type: "PATIENT_PROFILE",
        target_id: patient.patient_id,
        details: `Accessed patient 360 profile: ${patient.first_name} ${patient.last_name} (${patient.unique_id})`,
      },
    });

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

    const allowedUpdates = [
      "first_name",
      "last_name",
      "email",
      "address",
      "alternate_mobile",
      "mobile",
      "blood_group",
      "emergency_contact",
      "insurance_details"
    ];
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

    // Create Audit Log
    await prisma.adminLog.create({
      data: {
        admin_id: req.user!.sub,
        action_type: "UPDATE",
        target_type: "PATIENT",
        target_id: updated.patient_id,
        details: `Updated info for Patient: ${updated.first_name} ${updated.last_name} (${updated.unique_id})`,
      },
    });

    res.json({ success: true, data: updated });
  }),
);

export default router;
