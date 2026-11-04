import express from "express";
import cors from "cors";
import helmet from "helmet";

import { AppError } from "./shared/errors/app-error.js";
import { errorHandler } from "./middleware/error-handler.js";
import { validate } from "./middleware/validate.js";
import { createOrderSchema } from "./modules/orders/order.schema.js";
import { httpLogger } from "./config/logger.js";

const app = express();

// Register logging before routes
app.use(httpLogger);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/v1/health", (_req, res) => {
  res.status(200).json({
    success: true,
    service: "FleetFlow",
    status: "healthy"
  });
});

app.post(
  "/api/v1/orders",
  validate(createOrderSchema),
  (req, res) => {
    res.status(201).json({
      success: true,
      message: "Order data validated successfully",
      data: req.body
    });
  }
);

// Unknown routes
app.use((_req, _res, next) => {
  next(new AppError("Route not found", 404));
});

// Error handler must be last
app.use(errorHandler);

export default app;
