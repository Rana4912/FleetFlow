
import { AppError } from "../../shared/errors/app-error.js";

import type {
  Coordinate,
  RouteMatrixRequest,
  RouteMatrixResult,
  RouteMatrixProvider
} from "../../infrastructure/routing/routing.types.js";

export class RouteMatrixService {
  constructor(
    private readonly matrixProvider: RouteMatrixProvider
  ) {}

  async getRouteMatrix(
    request: RouteMatrixRequest
  ): Promise<RouteMatrixResult> {
    const { sources, targets } = request;

    if (sources.length === 0 || targets.length === 0) {
      throw new AppError(
        "Sources and targets must not be empty",
        400
      );
    }

    if (sources.length * targets.length > 1000) {
      throw new AppError(
        "Route matrix cannot exceed 1000 source-target pairs",
        400
      );
    }

    for (const source of sources) {
      this.validateCoordinate(source, "Source");
    }

    for (const target of targets) {
      this.validateCoordinate(target, "Target");
    }

    const result = await this.matrixProvider.getRouteMatrix(request);

    if (
      result.matrix.length !== sources.length ||
      result.matrix.some((row) => row.length !== targets.length)
    ) {
      throw new AppError(
        "Routing provider returned an invalid matrix",
        502
      );
    }

    return result;
  }

  private validateCoordinate(
    coordinate: Coordinate,
    field: string
  ): void {
    if (
      !Number.isFinite(coordinate.latitude) ||
      coordinate.latitude < -90 ||
      coordinate.latitude > 90
    ) {
      throw new AppError(
        `${field} latitude must be between -90 and 90`,
        400
      );
    }

    if (
      !Number.isFinite(coordinate.longitude) ||
      coordinate.longitude < -180 ||
      coordinate.longitude > 180
    ) {
      throw new AppError(
        `${field} longitude must be between -180 and 180`,
        400
      );
    }
  }
}
