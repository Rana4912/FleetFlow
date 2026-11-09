import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import {
  validate,
  validateParams,
  validateQuery
} from "../../middleware/validate.js";
import {
  createOrderSchema,
  orderIdSchema,
  listOrdersQuerySchema
} from "./order.schema.js";

import {
  createOrderController,
  getOrderByIdController,
  listOrdersController
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
  "/",
  authenticate,
  authorize("CUSTOMER", "ADMIN"),
  validateQuery(listOrdersQuerySchema),
  listOrdersController
);

router.get(
  "/:orderId",
  authenticate,
  authorize("CUSTOMER", "ADMIN"),
  validateParams(orderIdSchema),
  getOrderByIdController
);

export default router;