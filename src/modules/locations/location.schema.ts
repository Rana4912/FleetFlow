
import { z } from "zod";

export const geocodeAddressSchema = z.object({
  address: z
    .string()
    .trim()
    .min(5, "Address must contain at least 5 characters")
    .max(255, "Address cannot exceed 255 characters")
}).strict();

export type GeocodeAddressInput = z.infer<
  typeof geocodeAddressSchema
>;
