import { describe, it, expect, vi } from "vitest";

import type {
  Coordinate,
  RouteMatrixResult
} from "../../src/infrastructure/routing/routing.types.js";

import { RouteMatrixService } from "../../src/modules/routing/route-matrix.service.js";
import { RouteOptimizerService } from "../../src/modules/routing/route-optimizer.service.js";
import { DeliveryRouteOptimizationService } from "../../src/modules/routing/delivery-route-optimization.service.js";

describe("DeliveryRouteOptimizationService", () => {
  const stops = [
    { id: "A", coordinate: { latitude: 22.5726, longitude: 88.3639 } },
    { id: "B", coordinate: { latitude: 22.5800, longitude: 88.3700 } },
    { id: "C", coordinate: { latitude: 22.5900, longitude: 88.3800 } }
  ];

  const matrixResult: RouteMatrixResult = {
    sources: stops.map((stop) => stop.coordinate),
    targets: stops.map((stop) => stop.coordinate),
    provider: "TEST",
    matrix: [
      [
        { distanceMeters: 0, durationSeconds: 0 },
        { distanceMeters: 10, durationSeconds: 100 },
        { distanceMeters: 30, durationSeconds: 300 }
      ],
      [
        { distanceMeters: 10, durationSeconds: 100 },
        { distanceMeters: 0, durationSeconds: 0 },
        { distanceMeters: 15, durationSeconds: 150 }
      ],
      [
        { distanceMeters: 30, durationSeconds: 300 },
        { distanceMeters: 15, durationSeconds: 150 },
        { distanceMeters: 0, durationSeconds: 0 }
      ]
    ]
  };

  const matrixProvider = {
    name: "TEST",
    getRouteMatrix: vi.fn().mockResolvedValue(matrixResult)
  };

  const matrixService = new RouteMatrixService(matrixProvider);
  const optimizerService = new RouteOptimizerService();

  const service = new DeliveryRouteOptimizationService(
    matrixService,
    optimizerService
  );

  it("should calculate a matrix and optimize the delivery route", async () => {
    const result = await service.optimize(stops);

    expect(result.route.map((stop) => stop.stopId)).toEqual([
      "A",
      "B",
      "C"
    ]);

    expect(result.totalDistanceMeters).toBe(25);
    expect(result.totalDurationSeconds).toBe(250);

    expect(matrixProvider.getRouteMatrix).toHaveBeenCalledWith({
      sources: stops.map((stop) => stop.coordinate),
      targets: stops.map((stop) => stop.coordinate)
    });
  });

  it("should support a different starting stop", async () => {
    const result = await service.optimize(stops, 2);

    expect(result.route[0]?.stopId).toBe("C");
    expect(result.route).toHaveLength(3);
  });

  it("should support returning to the starting stop", async () => {
    const result = await service.optimize(stops, 0, true);

    expect(result.route.map((stop) => stop.stopId)).toEqual([
      "A",
      "B",
      "C",
      "A"
    ]);

    expect(result.totalDistanceMeters).toBe(55);
  });

  it("should propagate matrix provider errors", async () => {
    const failingProvider = {
      name: "TEST",
      getRouteMatrix: vi.fn().mockRejectedValue(
        new Error("Provider unavailable")
      )
    };

    const failingService = new DeliveryRouteOptimizationService(
      new RouteMatrixService(failingProvider),
      optimizerService
    );

    await expect(failingService.optimize(stops)).rejects.toThrow(
      "Provider unavailable"
    );
  });
});