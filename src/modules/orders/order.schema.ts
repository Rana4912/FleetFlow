import { z } from "zod";

export const createOrderSchema = z.object({
  pickupAddress: z.string().trim().min(1),
  deliveryAddress: z.string().trim().min(1),
  weight: z.number().positive()
});