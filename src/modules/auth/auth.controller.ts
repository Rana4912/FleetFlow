import type { Request, Response } from "express";
import { registerUser } from "./auth.service.js";
import { loginUser } from "./login.service.js";
import type { RegisterInput } from "./auth.schema.js";
import type { LoginInput } from "./login.schema.js";
import type { AuthenticatedRequest } from "../../middleware/authenticate.js";
import {
  ACCESS_TOKEN_MAX_AGE_MS
} from "./token.js";

import {
  accessTokenCookieOptions
} from "./cookie.js";

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

export async function login(
  req: Request<{}, {}, LoginInput>,
  res: Response
) {
  const result = await loginUser(req.body);

  res.cookie("accessToken", result.accessToken, {
    ...accessTokenCookieOptions,
    maxAge: ACCESS_TOKEN_MAX_AGE_MS
  });

  res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      user: result.user
    }
  });
}

export function getCurrentUser(
  req: AuthenticatedRequest,
  res: Response
) {
  res.status(200).json({
    success: true,
    data: {
      user: req.user
    }
  });
}

export function logout(_req: Request, res: Response) {
  res.clearCookie("accessToken",      accessTokenCookieOptions);

  res.status(200).json({
    success: true,
    message: "Logged out successfully"
  });
}