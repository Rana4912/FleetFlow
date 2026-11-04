import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../modules/auth/token.js";
import { AppError } from "../shared/errors/app-error.js";
import { prisma } from "../infrastructure/database/prisma.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: "CUSTOMER" | "DRIVER" | "ADMIN";
  };
}

export async function authenticate(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) {
  const token = req.cookies?.accessToken;

  if (!token) {
    return next(new AppError("Authentication required", 401));
  }

  try {
    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: {
        id: payload.sub
      },
      select: {
        id: true,
        role: true,
        isActive: true
      }
    });

    if (!user || !user.isActive) {
      return next(new AppError("Account is inactive or unavailable", 401));
    }

    req.user = {
      id: user.id,
      role: user.role
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }

    return next(new AppError("Invalid or expired token", 401));
  }
}