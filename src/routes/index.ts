import { Router } from "express";
import userRoutes from "./users.js";
import authRoutes from "./auth.js";
import departmentRoutes from "./department.js";
import doctorRoutes from "./doctor.js";
import patientRoutes from "./patient.js";
import visitRoutes from "./visit.js";
import analyticsRoutes from "./analytics.js";

const router = Router();

// Health check
router.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Auth routes (no auth required)
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/department", departmentRoutes);
router.use("/doctor", doctorRoutes);
router.use("/patient", patientRoutes);
router.use("/visit", visitRoutes);
router.use("/analytics", analyticsRoutes);

export default router;
