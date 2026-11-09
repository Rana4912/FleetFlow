import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/authenticate.js";

import {
  createAssignment,
  updateAssignmentStatus
} from "./assignment.service.js";

import { AppError } from "../../shared/errors/app-error.js";

export async function createAssignmentController(
  req: AuthenticatedRequest,
  res: Response
) {
  const assignment = await createAssignment(req.body);

  res.status(201).json({
    success: true,
    message: "Delivery assignment created successfully",
    data: {
      assignment
    }
  });
}

export async function updateAssignmentStatusController(
  req: AuthenticatedRequest,
  res: Response
) {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }

  const assignmentId = req.params.assignmentId;

  if (typeof assignmentId !== "string") {
    throw new AppError("Invalid assignment ID", 400);
  }

  const result = await updateAssignmentStatus(
    assignmentId,
    req.user.id,
    req.body
  );

  res.status(200).json({
    success: true,
    message: "Assignment status updated successfully",
    data: result
  });
}