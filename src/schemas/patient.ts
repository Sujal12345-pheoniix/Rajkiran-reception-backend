import { z } from "zod";

export const patientSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(50),
  last_name: z.string().min(1, "Last name is required").max(50),
  dob: z.coerce.date(),
  gender: z.enum(["Male", "Female", "Other"]),
  mobile: z
    .string()
    .regex(/^\d{10}$/, "Mobile number must be exactly 10 digits"),
  email: z.email().optional().or(z.literal("")),
  address: z.string().max(255).optional(),
  alternate_mobile: z
    .string()
    .regex(/^\d{10}$/, "Alternate mobile must be exactly 10 digits")
    .optional()
    .or(z.literal("")),
});

// For creation — created_by comes from authenticated user token, not body
export const createPatientSchema = patientSchema;

export type Patient = z.infer<typeof patientSchema>;
export type CreatePatient = z.infer<typeof createPatientSchema>;
