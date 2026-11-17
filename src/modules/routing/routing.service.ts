
import { AppError } from "../../shared/errors/app-error.js";
import type {
  Coordinate,
  RouteResult,
  RoutingProvider
} from "../../infrastructure/routing/routing.types.js";

export class RoutingService {
  constructor(
    private readonly routingProvider: RoutingProvider
  ) {}

  async getRoute(
    origin: Coordinate,
    destination: Coordinate
  ): Promise<RouteResult | null> {
    this.validateCoordinate(origin, "Origin");
    this.validateCoordinate(destination, "Destination");

    if (
      origin.latitude === destination.latitude &&
      origin.longitude === destination.longitude
    ) {
      throw new AppError(
        "Origin and destination cannot be the same",
        400
      );
    }

    return this.routingProvider.getRoute({
      origin,
      destination
    });
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
