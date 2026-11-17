
import {
  describe,
  it,
  expect,
  vi
} from "vitest";

import { errorHandler } from "../../src/middleware/error-handler.js";
import { AppError } from "../../src/shared/errors/app-error.js";
import { GeocodingProviderError } from "../../src/infrastructure/geocoding/geocoding.errors.js";

describe("ErrorHandler", () => {
  const createMocks = () => {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    const next = vi.fn();

    return { res, next };
  };

  it("should return 503 when geocoding provider is unavailable", () => {
    const { res, next } = createMocks();

    const error = new GeocodingProviderError(
      "Provider unavailable",
      "PROVIDER_UNAVAILABLE"
    );

    errorHandler(
      error,
      {} as never,
      res as never,
      next
    );

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Geocoding service is temporarily unavailable"
    });
  });

  it("should return 502 when geocoding provider response is invalid", () => {
    const { res, next } = createMocks();

    const error = new GeocodingProviderError(
      "Invalid response",
      "INVALID_PROVIDER_RESPONSE"
    );

    errorHandler(
      error,
      {} as never,
      res as never,
      next
    );

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Geocoding service returned an invalid response"
    });
  });

  it("should preserve AppError status and message", () => {
    const { res, next } = createMocks();

    const error = new AppError("Resource not found", 404);

    errorHandler(
      error,
      {} as never,
      res as never,
      next
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Resource not found"
    });
  });

  it("should return 500 for unknown errors", () => {
    const { res, next } = createMocks();

    errorHandler(
      new Error("Database connection details"),
      {} as never,
      res as never,
      next
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Internal server error"
    });
  });
});
