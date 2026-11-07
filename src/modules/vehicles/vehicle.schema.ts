import { z } from "zod";

export const createVehicleSchema = z.object({
  registrationNumber: z
    .string()
    .trim()
    .min(5, "Registration number must contain at least 5 characters")
    .max(20, "Registration number cannot exceed 20 characters")
    .regex(
      /^[A-Za-z0-9 -]+$/,
      "Registration number contains invalid characters"
    )
    .transform((value) => value.toUpperCase()),

  capacityKg: z
    .number()
    .positive("Vehicle capacity must be greater than zero")
    .max(99999999.99, "Vehicle capacity exceeds the allowed limit")
}).strict();

export type CreateVehicleInput = z.infer<
  typeof createVehicleSchema
>;