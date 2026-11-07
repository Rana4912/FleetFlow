import type { Request, Response } from "express";
import { createVehicle } from "./vehicle.service.js";

export async function createVehicleController(
  req: Request,
  res: Response
) {
  const vehicle = await createVehicle(req.body);

  res.status(201).json({
    success: true,
    message: "Vehicle registered successfully",
    data: {
      vehicle,
    },
  });
}