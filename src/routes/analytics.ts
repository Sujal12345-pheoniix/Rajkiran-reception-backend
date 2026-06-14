import { Router } from "express";
import prisma from "../db/prisma.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, authorize("admin"));

router.get(
  "/",
  asyncHandler(async (req, res) => {
    // 1. Fetch real DB counts
    const [patientCount, doctorCount, departmentCount, visitCount, billSum] = await Promise.all([
      prisma.patient.count(),
      prisma.doctor.count({ where: { status: "active" } }),
      prisma.department.count({ where: { status: "active" } }),
      prisma.visit.count(),
      prisma.bill.aggregate({
        _sum: { total_amount: true },
      }),
    ]);

    // Format sum cleanly
    const totalRevenue = Number(billSum._sum.total_amount ?? 0);

    // Mock bed details mapping to standard hospital distributions
    const totalBeds = 150;
    const occupiedBeds = Math.min(totalBeds, Math.max(20, Math.floor(patientCount * 0.75)));
    const availableBeds = totalBeds - occupiedBeds;

    // Fetch lists for dashboard lists
    const recentPatients = await prisma.patient.findMany({
      take: 10,
      orderBy: { created_at: "desc" },
      select: {
        patient_id: true,
        unique_id: true,
        first_name: true,
        last_name: true,
        mobile: true,
        created_at: true,
      },
    });

    const doctorsList = await prisma.doctor.findMany({
      take: 10,
      include: { department: true },
    });

    // Mock operational parameters for Practo enterprise experience
    const labReportsPending = 12;
    const lowStockMeds = 5;
    const emergencyCases = 3;

    res.json({
      success: true,
      metrics: {
        totalPatients: patientCount,
        activeDoctors: doctorCount,
        departmentsCount: departmentCount,
        totalVisits: visitCount,
        revenue: totalRevenue,
        beds: {
          total: totalBeds,
          occupied: occupiedBeds,
          available: availableBeds,
        },
        labPending: labReportsPending,
        lowStockMeds: lowStockMeds,
        emergencyCases: emergencyCases,
      },
      recentPatients,
      doctorsList,
    });
  }),
);

export default router;
