import { z } from "zod";

export const visitSchema = z.object({
  patientId: z.string(),
  doctorId: z.string(),
  visit_type: z.string().default("OPD"),
});

export const vitalSchema = z.object({
  blood_pressure: z.string().optional(),
  heart_rate: z.int32().optional(),
  temperature: z.number().optional(),
  weight: z.number().optional(),
  height: z.number().optional(),
});

export const billSchema = z.object({
  extra_charge: z.number().optional(),
  total_amount: z.number().optional(),
  payment_status: z.string().optional(),
  payment_method: z.string().default("cash"),
});

export const allergiesSchema = z.object({
  patientId: z.string(),
  allergies: z.array(z.string()).optional(),
});

export const createVisitSchema = z.object({
  visit: visitSchema,
  vital: vitalSchema,
  bill: billSchema,
});
export type CreateVisitSchema = z.infer<typeof createVisitSchema>;
export type VisitSchema = z.infer<typeof visitSchema>;
export type VitlalSchema = z.infer<typeof vitalSchema>;
