import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { createProfile } from "./customer.controller.js";

const router = Router();

router.post(
  "/profile",
  authenticate,
  authorize("CUSTOMER"),
  createProfile
);

export default router;