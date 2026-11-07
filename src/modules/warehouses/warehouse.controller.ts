import type { Request, Response } from "express";
import { createWarehouse } from "./warehouse.service.js";

export async function createWarehouseController(
  req: Request,
  res: Response
) {
  const warehouse = await createWarehouse(req.body);

  res.status(201).json({
    success: true,
    message: "Warehouse created successfully",
    data: {
      warehouse
    }
  });
}