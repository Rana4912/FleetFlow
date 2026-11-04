import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./authenticate.js";
import { AppError } from "../shared/errors/app-error.js";

type UserRole = "CUSTOMER" | "DRIVER" | "ADMIN";

export function authorize(...allowedRoles: UserRole[]) {
  return (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
  ) => {
    if (!req.user) {
      return next(new AppError("Authentication required", 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action", 403)
      );
    }

    next();
  };
}