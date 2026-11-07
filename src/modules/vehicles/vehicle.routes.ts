import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";

import { createVehicleSchema } from "./vehicle.schema.js";
import { createVehicleController } from "./vehicle.controller.js";

const router = Router();

router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  validate(createVehicleSchema),
  createVehicleController
);

export default router;