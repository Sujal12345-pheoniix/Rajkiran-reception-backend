import { z } from "zod";

export const createUserSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8).max(128),
  role: z.enum(["admin", "receptionist"]).default("receptionist"),
});

export const updateUserSchema = z.object({
  role: z.enum(["admin", "receptionist"]).optional(),
  is_active: z.boolean().optional(),
});

export const paramsSchema = z.object({
  id: z.string().min(1),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
