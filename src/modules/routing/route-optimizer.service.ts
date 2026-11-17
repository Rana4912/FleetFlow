
import { AppError } from "../../shared/errors/app-error.js";

import type {
  RouteMatrixResult
} from "../../infrastructure/routing/routing.types.js";

export interface RouteOptimizationResult {
  route: {
    stopId: string;
    matrixIndex: number;
  }[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
}

export class RouteOptimizerService {
  optimize(
    stopIds: string[],
    matrixResult: RouteMatrixResult,
    startIndex = 0,
    returnToStart = false
  ): RouteOptimizationResult {
    const size = stopIds.length;

    if (size < 2) {
      throw new AppError(
        "At least two stops are required for route optimization",
        400
      );
    }

    if (new Set(stopIds).size !== size) {
      throw new AppError(
        "Stop IDs must be unique",
        400
      );
    }

    if (
      !Number.isInteger(startIndex) ||
      startIndex < 0 ||
      startIndex >= size
    ) {
      throw new AppError(
        "Invalid starting stop index",
        400
      );
    }

    if (
      matrixResult.sources.length !== size ||
      matrixResult.targets.length !== size ||
      matrixResult.matrix.length !== size ||
      matrixResult.matrix.some((row) => row.length !== size)
    ) {
      throw new AppError("Route matrix dimensions do not match the stops", 400);
    }

    for (const row of matrixResult.matrix) {
      for (const cell of row) {
        if (
          !cell ||
          (cell.distanceMeters === null) !==
          (cell.durationSeconds === null) ||
          (cell.distanceMeters !== null &&
            (!Number.isFinite(cell.distanceMeters) ||
              cell.distanceMeters < 0)) ||
          (cell.durationSeconds !== null &&
            (!Number.isFinite(cell.durationSeconds) ||
              cell.durationSeconds < 0))
        ) {
          throw new AppError("Route matrix contains invalid values", 422);
        }
      }
    }

    const visited = new Set<number>();
    const route: RouteOptimizationResult["route"] = [];

    let currentIndex = startIndex;
    let totalDistanceMeters = 0;
    let totalDurationSeconds = 0;

    visited.add(currentIndex);

    route.push({
      stopId: stopIds[currentIndex]!,
      matrixIndex: currentIndex
    });

    while (visited.size < size) {
      const currentRow = matrixResult.matrix[currentIndex];

      if (!currentRow) {
        throw new AppError(
          "Route matrix contains an invalid row",
          422
        );
      }

      let nearestIndex = -1;
      let shortestDistance = Infinity;

      for (let i = 0; i < size; i++) {
        if (visited.has(i)) {
          continue;
        }

        const candidate = currentRow[i];

        if (
          !candidate ||
          candidate.distanceMeters === null ||
          candidate.durationSeconds === null
        ) {
          continue;
        }

        if (candidate.distanceMeters < shortestDistance) {
          shortestDistance = candidate.distanceMeters;
          nearestIndex = i;
        }
      }

      if (nearestIndex === -1) {
        throw new AppError(
          "No reachable unvisited stop exists",
          422
        );
      }

      const selectedRoute = currentRow[nearestIndex]!;

      totalDistanceMeters += selectedRoute.distanceMeters!;
      totalDurationSeconds += selectedRoute.durationSeconds!;

      visited.add(nearestIndex);

      route.push({
        stopId: stopIds[nearestIndex]!,
        matrixIndex: nearestIndex
      });

      currentIndex = nearestIndex;
    }

    if (returnToStart) {
      const returnRoute = matrixResult.matrix[currentIndex]?.[startIndex];

      if (
        !returnRoute ||
        returnRoute.distanceMeters === null ||
        returnRoute.durationSeconds === null
      ) {
        throw new AppError(
          "No route available to return to the starting stop",
          422
        );
      }

      totalDistanceMeters += returnRoute.distanceMeters;
      totalDurationSeconds += returnRoute.durationSeconds;

      route.push({
        stopId: stopIds[startIndex]!,
        matrixIndex: startIndex
      });
    }

    return {
      route,
      totalDistanceMeters,
      totalDurationSeconds
    };
  }
}
