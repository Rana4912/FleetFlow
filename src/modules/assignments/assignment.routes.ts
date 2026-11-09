import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import {
  validate,
  validateParams
} from "../../middleware/validate.js";

import {
  createAssignmentSchema,
  assignmentParamsSchema,
  updateAssignmentStatusSchema
} from "./assignment.schema.js";

import {
  createAssignmentController,
  updateAssignmentStatusController
} from "./assignment.controller.js";

const router = Router();

// Admin creates assignments.
router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  validate(createAssignmentSchema),
  createAssignmentController
);

// Assigned drivers update delivery progress.
router.patch(
  "/:assignmentId/status",
  authenticate,
  authorize("DRIVER"),
  validateParams(assignmentParamsSchema),
  validate(updateAssignmentStatusSchema),
  updateAssignmentStatusController
);

export default router;
