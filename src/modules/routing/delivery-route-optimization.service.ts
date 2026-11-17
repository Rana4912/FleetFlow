import type { Coordinate } from "../../infrastructure/routing/routing.types.js";

import { RouteMatrixService } from "./route-matrix.service.js";
import {
  RouteOptimizerService,
  type RouteOptimizationResult
} from "./route-optimizer.service.js";

export interface DeliveryStop {
  id: string;
  coordinate: Coordinate;
}

export class DeliveryRouteOptimizationService {
  constructor(
    private readonly routeMatrixService: RouteMatrixService,
    private readonly routeOptimizerService: RouteOptimizerService
  ) {}

  async optimize(
    stops: DeliveryStop[],
    startIndex = 0,
    returnToStart = false
  ): Promise<RouteOptimizationResult> {
    const coordinates = stops.map((stop) => stop.coordinate);

    const matrixResult =
      await this.routeMatrixService.getRouteMatrix({
        sources: coordinates,
        targets: coordinates
      });

    const stopIds = stops.map((stop) => stop.id);

    return this.routeOptimizerService.optimize(
      stopIds,
      matrixResult,
      startIndex,
      returnToStart
    );
  }
}