import type { Request, Response } from "express";
import { registerUser } from "./auth.service.js";
import type { RegisterInput } from "./auth.schema.js";

export async function register(
  req: Request<{}, {}, RegisterInput>,
  res: Response
) {
  const user = await registerUser(req.body);

  res.status(201).json({
    success: true,
    message: "User registered successfully",
    data: user
  });
}