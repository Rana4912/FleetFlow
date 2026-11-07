import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { createDriverProfileSchema } from "./driver.schema.js";
import { createProfile } from "./driver.controller.js";

const router = Router();

router.post(
  "/profile",
  authenticate,
  authorize("DRIVER"),
  validate(createDriverProfileSchema),
  createProfile
);

export default router;