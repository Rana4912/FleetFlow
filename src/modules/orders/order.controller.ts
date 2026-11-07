import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/authenticate.js";
import { createOrder } from "./order.service.js";

export async function createOrderController(
  req: AuthenticatedRequest,
  res: Response
) {
  const order = await createOrder(
    req.user!.id,
    req.body
  );

  res.status(201).json({
    success: true,
    message: "Delivery order created successfully",
    data: {
      order
    }
  });
}