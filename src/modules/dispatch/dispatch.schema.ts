import { z } from "zod";

export const dispatchParamsSchema = z.object({
  orderId: z.uuid("Invalid order ID")
});