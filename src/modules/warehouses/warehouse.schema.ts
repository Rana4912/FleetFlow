import { z } from "zod";

export const createWarehouseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Warehouse name must contain at least 2 characters")
    .max(100, "Warehouse name cannot exceed 100 characters"),

  address: z
    .string()
    .trim()
    .min(5, "Warehouse address must contain at least 5 characters")
    .max(255, "Warehouse address cannot exceed 255 characters"),

  latitude: z
    .number()
    .min(-90, "Latitude must be at least -90")
    .max(90, "Latitude cannot exceed 90")
    .optional(),

  longitude: z
    .number()
    .min(-180, "Longitude must be at least -180")
    .max(180, "Longitude cannot exceed 180")
    .optional()
}).strict().refine(
  (data) =>
    (data.latitude === undefined) ===
    (data.longitude === undefined),
  {
    message: "Latitude and longitude must be provided together",
    path: ["latitude"]
  }
);

export type CreateWarehouseInput = z.infer<
  typeof createWarehouseSchema
>;