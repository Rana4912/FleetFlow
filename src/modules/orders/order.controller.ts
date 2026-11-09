import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/authenticate.js";
import { createOrder, getOrderById, listOrders } from "./order.service.js";
import { AppError } from "../../shared/errors/app-error.js";

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

export async function getOrderByIdController(
  req: AuthenticatedRequest,
  res: Response
) {
  if (
    req.user!.role !== "CUSTOMER" &&
    req.user!.role !== "ADMIN"
  ) {
    throw new AppError("Forbidden", 403);
  }
  const order = await getOrderById(
    req.user!.id,
    req.user!.role,
    req.params.orderId as string
  );

  res.status(200).json({
    success: true,
    message: "Order retrieved successfully",
    data: {
      order
    }
  });
}

export async function listOrdersController(
  req: AuthenticatedRequest,
  res: Response
) {
  if (
    req.user!.role !== "CUSTOMER" &&
    req.user!.role !== "ADMIN"
  ) {
    throw new AppError("Forbidden", 403);
  }

  const result = await listOrders(
    req.user!.id,
    req.user!.role,
    res.locals.validatedQuery
  );

  res.status(200).json({
    success: true,
    message: "Orders retrieved successfully",
    data: result
  });
}