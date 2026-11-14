import type { Request, Response } from "express";
import { autoDispatchOrder } from "./dispatch.service.js";

export async function autoDispatchController(
  req: Request,
  res: Response
) {
  const { orderId } = req.params;

  const result = await autoDispatchOrder(orderId as string);

  res.status(201).json({
    success: true,
    message: "Order automatically dispatched successfully",
    data: result
  });
}