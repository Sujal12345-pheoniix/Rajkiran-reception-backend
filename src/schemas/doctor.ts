import { z } from "zod";

export const doctorSchema = z.object({
  first_name: z.string(),
  last_name: z.string(),
  email: z.email(),
  mobile: z.string(),
  specialization: z.string(),
  qualification: z.string(),
  consultation_fee: z.number(),
});

export const createDoctorSchema = z.object({
  ...doctorSchema.shape,
  department_id: z.string(),
});

export type Doctor = z.infer<typeof doctorSchema>;
export type CreateDoctor = z.infer<typeof createDoctorSchema>;
