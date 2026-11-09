import { z } from "zod";

export const createOrderSchema = z.object({
  pickupAddress: z
    .string()
    .trim()
    .min(5, "Pickup address must contain at least 5 characters")
    .max(255, "Pickup address cannot exceed 255 characters"),

  deliveryAddress: z
    .string()
    .trim()
    .min(5, "Delivery address must contain at least 5 characters")
    .max(255, "Delivery address cannot exceed 255 characters"),

  recipientName: z
    .string()
    .trim()
    .min(2, "Recipient name must contain at least 2 characters")
    .max(100, "Recipient name cannot exceed 100 characters"),

  recipientPhone: z
    .string()
    .trim()
    .regex(
      /^\+?[1-9]\d{7,14}$/,
      "Enter a valid recipient phone number"
    ),

  weightKg: z
    .number()
    .positive("Weight must be greater than zero")
    .max(99999999.99, "Weight exceeds the allowed limit"),

  deadline: z
    .iso.datetime({ offset: true })
    .optional()
}).strict();

export type CreateOrderInput = z.infer<
  typeof createOrderSchema
>;

export const orderIdSchema = z.object({
  orderId: z.uuid("Invalid order ID")
});

export const listOrdersQuerySchema = z.object({
  page: z.coerce.number()
    .int("Page must be an integer")
    .min(1, "Page must be at least 1")
    .default(1),

  limit: z.coerce.number()
    .int("Limit must be an integer")
    .min(1, "Limit must be at least 1")
    .max(100, "Limit cannot exceed 100")
    .default(10),

  status: z.enum([
    "CREATED",
    "CONFIRMED",
    "ASSIGNED",
    "PICKED_UP",
    "IN_TRANSIT",
    "DELIVERED",
    "FAILED",
    "CANCELLED"
  ]).optional(),

  sortOrder: z.enum(["asc", "desc"]).default("desc")
}).strict();

export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;


export const updateOrderStatusSchema = z.object({
  status: z.enum([
    "CONFIRMED",
    "ASSIGNED",
    "PICKED_UP",
    "IN_TRANSIT",
    "DELIVERED",
    "FAILED",
    "CANCELLED"
  ])
}).strict();

export type UpdateOrderStatusInput = z.infer<
  typeof updateOrderStatusSchema
>;