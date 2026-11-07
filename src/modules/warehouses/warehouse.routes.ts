import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { createWarehouseSchema } from "./warehouse.schema.js";
import { createWarehouseController } from "./warehouse.controller.js";

const router = Router();

router.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  validate(createWarehouseSchema),
  createWarehouseController
);

export default router;