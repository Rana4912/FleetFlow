import type { ErrorRequestHandler } from "express";
import { AppError } from "../shared/errors/app-error.js";
import { GeocodingProviderError } from "../infrastructure/geocoding/geocoding.errors.js";


export const errorHandler: ErrorRequestHandler = (
  error,
  _req,
  res,
  _next
) => {
  if (error instanceof GeocodingProviderError) {
    const statusCode =
      error.code === "PROVIDER_UNAVAILABLE" ? 503 : 502;

    const message =
      error.code === "PROVIDER_UNAVAILABLE"
        ? "Geocoding service is temporarily unavailable"
        : "Geocoding service returned an invalid response";

    res.status(statusCode).json({
      success: false,
      message
    });

    return;
  }

  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const message = error instanceof AppError
    ? error.message
    : "Internal server error";

  res.status(statusCode).json({
    success: false,
    message
  });
};
