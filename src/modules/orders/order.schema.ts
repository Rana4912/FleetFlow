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