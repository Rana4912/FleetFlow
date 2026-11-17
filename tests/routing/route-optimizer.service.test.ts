
import {
  describe,
  it,
  expect
} from "vitest";

import {
  RouteOptimizerService
} from "../../src/modules/routing/route-optimizer.service.js";

import { AppError } from "../../src/shared/errors/app-error.js";

import type {
  RouteMatrixResult
} from "../../src/infrastructure/routing/routing.types.js";

describe("RouteOptimizerService", () => {
  const optimizer = new RouteOptimizerService();

  const stopIds = ["A", "B", "C", "D"];

  const createMatrix = (): RouteMatrixResult => ({
    sources: [
      { latitude: 22.5726, longitude: 88.3639 },
      { latitude: 22.6000, longitude: 88.4000 },
      { latitude: 22.6200, longitude: 88.4500 },
      { latitude: 22.5500, longitude: 88.3500 }
    ],
    targets: [
      { latitude: 22.5726, longitude: 88.3639 },
      { latitude: 22.6000, longitude: 88.4000 },
      { latitude: 22.6200, longitude: 88.4500 },
      { latitude: 22.5500, longitude: 88.3500 }
    ],
    provider: "MOCK",
    matrix: [
      [
        { distanceMeters: 0, durationSeconds: 0 },
        { distanceMeters: 10, durationSeconds: 100 },
        { distanceMeters: 25, durationSeconds: 250 },
        { distanceMeters: 15, durationSeconds: 150 }
      ],
      [
        { distanceMeters: 10, durationSeconds: 100 },
        { distanceMeters: 0, durationSeconds: 0 },
        { distanceMeters: 12, durationSeconds: 120 },
        { distanceMeters: 20, durationSeconds: 200 }
      ],
      [
        { distanceMeters: 25, durationSeconds: 250 },
        { distanceMeters: 12, durationSeconds: 120 },
        { distanceMeters: 0, durationSeconds: 0 },
        { distanceMeters: 8, durationSeconds: 80 }
      ],
      [
        { distanceMeters: 15, durationSeconds: 150 },
        { distanceMeters: 20, durationSeconds: 200 },
        { distanceMeters: 8, durationSeconds: 80 },
        { distanceMeters: 0, durationSeconds: 0 }
      ]
    ]
  });

  it("should calculate the nearest-neighbor route", () => {
    const result = optimizer.optimize(
      stopIds,
      createMatrix()
    );

    expect(result.route.map((stop) => stop.stopId))
      .toEqual(["A", "B", "C", "D"]);

    expect(result.totalDistanceMeters).toBe(30);
    expect(result.totalDurationSeconds).toBe(300);
  });

  it("should support a different starting stop", () => {
    const result = optimizer.optimize(
      stopIds,
      createMatrix(),
      2
    );

    expect(result.route[0]?.stopId).toBe("C");
  });

  it("should return to the starting stop when requested", () => {
    const result = optimizer.optimize(
      stopIds,
      createMatrix(),
      0,
      true
    );

    expect(result.route.map((stop) => stop.stopId))
      .toEqual(["A", "B", "C", "D", "A"]);

    expect(result.totalDistanceMeters).toBe(45);
    expect(result.totalDurationSeconds).toBe(450);
  });

  it("should reject duplicate stop IDs", () => {
    expect(() =>
      optimizer.optimize(
        ["A", "B", "A"],
        createMatrix()
      )
    ).toThrow(AppError);
  });

  it("should reject fewer than two stops", () => {
    expect(() =>
      optimizer.optimize(
        ["A"],
        createMatrix()
      )
    ).toThrow(AppError);
  });

  it("should reject an invalid starting index", () => {
    expect(() =>
      optimizer.optimize(
        stopIds,
        createMatrix(),
        10
      )
    ).toThrow(AppError);
  });

  it("should reject an incorrectly sized matrix", () => {
    const matrix = createMatrix();

    expect(() =>
      optimizer.optimize(
        stopIds,
        {
          ...matrix,
          matrix: [[
            { distanceMeters: 100, durationSeconds: 100 }
          ]]
        }
      )
    ).toThrow(AppError);
  });

  it("should reject when no unvisited stop is reachable", () => {
    const matrix = createMatrix();

    matrix.matrix[0] = [
      { distanceMeters: 0, durationSeconds: 0 },
      { distanceMeters: null, durationSeconds: null },
      { distanceMeters: null, durationSeconds: null },
      { distanceMeters: null, durationSeconds: null }
    ];

    expect(() =>
      optimizer.optimize(stopIds, matrix)
    ).toThrow(
      "No reachable unvisited stop exists"
    );
  });

  it("should reject when the return route is unavailable", () => {
    const matrix = createMatrix();

    matrix.matrix[3]![0] = {
      distanceMeters: null,
      durationSeconds: null
    };

    expect(() =>
      optimizer.optimize(
        stopIds,
        matrix,
        0,
        true
      )
    ).toThrow(
      "No route available to return to the starting stop"
    );
  });

  it("should select stops using distance rather than duration", () => {
    const matrix = createMatrix();

    matrix.matrix[0]![1] = {
      distanceMeters: 10,
      durationSeconds: 900
    };

    matrix.matrix[0]![3] = {
      distanceMeters: 15,
      durationSeconds: 10
    };

    const result = optimizer.optimize(
      stopIds,
      matrix
    );

    expect(result.route[1]?.stopId).toBe("B");
  });
});
