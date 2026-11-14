import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validateParams } from "../../middleware/validate.js";

import { dispatchParamsSchema } from "./dispatch.schema.js";
import { autoDispatchController } from "./dispatch.controller.js";

const router = Router();

router.post(
  "/:orderId",
  authenticate,
  authorize("ADMIN"),
  validateParams(dispatchParamsSchema),
  autoDispatchController
);

export default router;