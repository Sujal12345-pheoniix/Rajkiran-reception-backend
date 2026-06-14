import { z } from "zod";

export const departmentSchema = z.object({
  name: z.string().min(1, "Department name is required").max(100),
  status: z.enum(["active", "inactive"]).default("active"),
  description: z.string().max(500).optional(),
  // BUG FIX: Removed created_by from schema — taken from authenticated token
});

export type DepartmentInput = z.infer<typeof departmentSchema>;
