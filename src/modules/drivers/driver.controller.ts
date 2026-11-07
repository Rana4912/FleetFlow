import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/authenticate.js";
import { createDriverProfile } from "./driver.service.js";

export async function createProfile(
  req: AuthenticatedRequest,
  res: Response
) {
  const driver = await createDriverProfile(
    req.user!.id,
    req.body.licenseNumber
  );

  res.status(201).json({
    success: true,
    message: "Driver profile created successfully",
    data: {
      driver,
    },
  });
}