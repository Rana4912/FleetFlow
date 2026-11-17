
import { rateLimit } from "express-rate-limit";

export const geocodingRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many geocoding requests. Please try again later."
  }
});
