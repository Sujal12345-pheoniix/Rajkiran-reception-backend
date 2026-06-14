import { Router } from "express";
import type { Request, Response } from "express";
import prisma from "../db/prisma.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validate } from "../middleware/validate.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { HttpError } from "../middleware/errorHandler.js";
import { createVisitSchema, type CreateVisitSchema } from "../schemas/visit.js";
import { calculateAge, calculateBmi, calculateBmr } from "../lib/util.js";

const router = Router();

router.use(authenticate);

// ─── POST /api/visit — Create new visit (receptionist only) ──────────────────
router.post(
  "/",
  authorize("receptionist", "admin"),
  validate(createVisitSchema),
  asyncHandler(async (req, res) => {
    const visitData = req.validated as CreateVisitSchema;

    const patient = await prisma.patient.findFirst({
      where: { unique_id: visitData.visit.patientId },
    });
    if (!patient) throw new HttpError(404, "Patient not found");

    const doctor = await prisma.doctor.findUnique({
      where: { doctor_id: visitData.visit.doctorId },
    });
    if (!doctor) throw new HttpError(404, "Doctor not found");
    if (doctor.status !== "active") throw new HttpError(400, "Doctor is not currently active");

    const patientAge = calculateAge(patient.dob);
    let bmi: number | undefined;
    let bmr: number | undefined;

    if (visitData.vital.weight && visitData.vital.height) {
      bmi = calculateBmi(visitData.vital.weight, visitData.vital.height);
    }

    // BUG FIX: total_amount was always just consultation_fee, ignoring extra_charges
    const extraCharges = visitData.bill.extra_charge ?? 0;
    const consultationFee = Number(doctor.consultation_fee);
    const totalAmount = consultationFee + extraCharges;

    // Use Prisma transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
      const vital = await tx.vital.create({
        data: {
          blood_pressure: visitData.vital.blood_pressure,
          heart_rate: visitData.vital.heart_rate,
          temperature: visitData.vital.temperature,
          weight: visitData.vital.weight,
          height: visitData.vital.height,
          age: patientAge,
          bmi: bmi,
          bmr: bmr,
        },
      });

      const bill = await tx.bill.create({
        data: {
          consultation_fee: consultationFee,
          extra_charges: extraCharges,
          total_amount: totalAmount, // BUG FIX: now correctly includes extra charges
          payment_status: visitData.bill.payment_status ?? "pending",
          payment_method: visitData.bill.payment_method ?? "cash",
          created_by: req.user!.sub,
        },
      });

      const visit = await tx.visit.create({
        data: {
          vital_id: vital.vital_id,
          bill_id: bill.bill_id,
          patient_id: patient.patient_id,
          doctor_id: doctor.doctor_id,
          visit_type: visitData.visit.visit_type ?? "OPD",
          created_by: req.user!.sub,
          consultation_fee: consultationFee,
        },
        include: {
          patient: { select: { first_name: true, last_name: true, unique_id: true } },
          doctor: { select: { first_name: true, last_name: true } },
        },
      });

      return { visit, vital, bill };
    });

    res.status(201).json({
      success: true,
      message: "Visit created successfully",
      data: {
        visit_id: result.visit.visit_id,
        patient: result.visit.patient,
        doctor: result.visit.doctor,
        total_amount: totalAmount,
        payment_status: result.bill.payment_status,
      },
    });
  }),
);

// ─── GET /api/visit — Get visits with pagination ─────────────────────────────
// BUG FIX: Was returning ALL visits with no pagination — catastrophic at scale
router.get(
  "/",
  authorize("receptionist", "admin"),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    // Optional filters
    const dateFilter = req.query.date as string;
    const doctorId = req.query.doctor_id as string;

    const whereClause: Record<string, unknown> = {};
    if (dateFilter) {
      const start = new Date(dateFilter);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateFilter);
      end.setHours(23, 59, 59, 999);
      whereClause.visit_date = { gte: start, lte: end };
    }
    if (doctorId) {
      whereClause.doctor_id = doctorId;
    }

    const [visits, total] = await Promise.all([
      prisma.visit.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { visit_date: "desc" },
        include: {
          patient: {
            select: { first_name: true, last_name: true, unique_id: true, mobile: true },
          },
          doctor: {
            select: { first_name: true, last_name: true, specialization: true },
          },
          vitals: {
            select: {
              blood_pressure: true,
              heart_rate: true,
              temperature: true,
              weight: true,
              height: true,
              bmi: true,
              age: true,
            },
          },
          bill: {
            select: {
              total_amount: true,
              payment_status: true,
              payment_method: true,
              consultation_fee: true,
              extra_charges: true,
            },
          },
        },
      }),
      prisma.visit.count({ where: whereClause }),
    ]);

    res.status(200).json({
      success: true,
      data: visits,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }),
);

// ─── GET /api/visit/:id — Get single visit ────────────────────────────────────
router.get(
  "/:id",
  authorize("receptionist", "admin"),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;

    const visit = await prisma.visit.findUnique({
      where: { visit_id: id },
      include: {
        patient: true,
        doctor: { include: { department: true } },
        vitals: true,
        bill: true,
      },
    });

    if (!visit) throw new HttpError(404, "Visit not found");

    res.status(200).json({ success: true, data: visit });
  }),
);

export default router;
