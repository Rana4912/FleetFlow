import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import {
  validate,
  validateParams
} from "../../middleware/validate.js";
import {
  createOrderSchema,
  orderIdSchema
} from "./order.schema.js";

import {
  createOrderController,
  getOrderByIdController
} from "./order.controller.js";

const router = Router();

router.post(
  "/",
  authenticate,
  authorize("CUSTOMER"),
  validate(createOrderSchema),
  createOrderController
);

router.get(
  "/:orderId",
  authenticate,
  authorize("CUSTOMER", "ADMIN"),
  validateParams(orderIdSchema),
  getOrderByIdController
);

export default router;