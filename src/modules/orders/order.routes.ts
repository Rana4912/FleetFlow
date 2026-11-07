import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { createOrderSchema } from "./order.schema.js";
import { createOrderController } from "./order.controller.js";

const router = Router();

router.post(
  "/",
  authenticate,
  authorize("CUSTOMER"),
  validate(createOrderSchema),
  createOrderController
);

export default router;