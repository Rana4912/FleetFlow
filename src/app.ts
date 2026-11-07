import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import { AppError } from "./shared/errors/app-error.js";
import { errorHandler } from "./middleware/error-handler.js";
import { validate } from "./middleware/validate.js";
import { createOrderSchema } from "./modules/orders/order.schema.js";
import { httpLogger } from "./config/logger.js";
import authRoutes from "./modules/auth/auth.routes.js";
import customerRoutes from "./modules/customers/customer.routes.js";
import driverRoutes from "./modules/drivers/driver.routes.js";


const app = express();

// Register logging before routes
app.use(httpLogger);

app.use(helmet());
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

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


app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/customers", customerRoutes);
app.use("/api/v1/drivers", driverRoutes);

// Unknown routes
app.use((_req, _res, next) => {
  next(new AppError("Route not found", 404));
});

// Error handler must be last
app.use(errorHandler);

export default app;
