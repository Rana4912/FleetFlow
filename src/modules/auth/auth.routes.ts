import { Router } from "express";
import { registerSchema } from "./auth.schema.js";
import { loginSchema } from "./login.schema.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import {
  register,
  login,
  getCurrentUser,
  logout
} from "./auth.controller.js";
import { authRateLimit } from "../../middleware/auth-rate-limit.js";

const router = Router();

router.post("/register", validate(registerSchema), register);
router.post(
  "/login",
  authRateLimit,
  validate(loginSchema),
  login
);
router.get("/me", authenticate, getCurrentUser);
router.post("/logout", logout);

export default router;