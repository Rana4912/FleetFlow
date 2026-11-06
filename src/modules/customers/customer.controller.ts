import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/authenticate.js";
import { createCustomerProfile } from "./customer.service.js";

export async function createProfile(
  req: AuthenticatedRequest,
  res: Response
) {
  const customer = await createCustomerProfile(req.user!.id);

  res.status(201).json({
    success: true,
    message: "Customer profile created successfully",
    data: {
      customer
    }
  });
}