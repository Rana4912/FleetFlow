
import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";

import { geocodeAddressSchema } from "./location.schema.js";
import { geocodeAddressController } from "./location.controller.js";
import { geocodingRateLimit } from "../../middleware/geocoding-rate-limit.js";

const router = Router();

router.post(
  "/geocode",
  authenticate,
  authorize("ADMIN"),
  geocodingRateLimit,
  validate(geocodeAddressSchema),
  geocodeAddressController
);

export default router;
