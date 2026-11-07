
import { z } from "zod";

export const createDriverProfileSchema = z.object({
  licenseNumber: z
    .string()
    .trim()
    .min(5, "License number must contain at least 5 characters")
    .max(30, "License number cannot exceed 30 characters")
    .regex(
      /^[A-Za-z0-9/-]+$/,
      "License number contains invalid characters"
    )
    .transform((value) => value.toUpperCase())
}).strict();

export type CreateDriverProfileInput = z.infer<
  typeof createDriverProfileSchema
>;
