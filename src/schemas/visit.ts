import { z } from "zod";

export const visitSchema = z.object({
  patientId: z.string(),
  doctorId: z.string().optional().nullable(),
  visit_type: z.string().default("OPD"),
  symptoms: z.array(z.string()).default([]),
  known_diseases: z.array(z.string()).default([]),
  chief_complaint: z.string().optional().nullable(),
  visit_notes: z.string().optional().nullable(),
});

export const vitalSchema = z.object({
  blood_pressure: z.string().optional().nullable(),
  heart_rate: z.number().int().optional().nullable(),
  temperature: z.number().optional().nullable(),
  weight: z.number().optional().nullable(),
  height: z.number().optional().nullable(),
  oxygen_saturation: z.number().int().optional().nullable(),
  respiratory_rate: z.number().int().optional().nullable(),
  blood_sugar: z.number().int().optional().nullable(),
  pain_scale: z.number().int().min(0).max(10).optional().nullable(),
});

export const billSchema = z.object({
  consultation_fee: z.number().optional().default(0),
  registration_fee: z.number().optional().default(0),
  tests_fee: z.number().optional().default(0),
  medicines_fee: z.number().optional().default(0),
  extra_charge: z.number().optional().default(0),
  tax: z.number().optional().default(0),
  discount: z.number().optional().default(0),
  grand_total: z.number().optional().default(0),
  payment_status: z.string().optional().default("pending"),
  payment_method: z.string().optional().default("cash"),
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
export type VitalSchema = z.infer<typeof vitalSchema>;
