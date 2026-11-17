
import { z } from "zod";

import { env } from "../../config/env.js";

import type {
  RoutingProvider,
  RouteRequest,
  RouteResult
} from "./routing.types.js";

import { RoutingProviderError } from "./routing.errors.js";

const geoapifyRoutingResponseSchema = z.object({
  results: z.array(
    z.object({
      distance: z.number().finite().nonnegative(),
      time: z.number().finite().nonnegative(),
      geometry: z.array(
        z.array(
          z.object({
            lon: z.number().finite().min(-180).max(180),
            lat: z.number().finite().min(-90).max(90)
          })
        ).min(2)
      ).min(1)
    })
  )
});

export class GeoapifyRoutingProvider implements RoutingProvider {
  readonly name = "GEOAPIFY";

  async getRoute(
    request: RouteRequest
  ): Promise<RouteResult | null> {
    const url = new URL(
      "https://api.geoapify.com/v1/routing"
    );

    // Geoapify expects latitude,longitude.
    url.searchParams.set(
      "waypoints",
      `${request.origin.latitude},${request.origin.longitude}|${request.destination.latitude},${request.destination.longitude}`
    );

    url.searchParams.set("mode", "drive");
    url.searchParams.set("format", "json");
    url.searchParams.set("units", "metric");
    url.searchParams.set("apiKey", env.GEOCODING_API_KEY);

    let response: Response;

    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json"
        },
        signal: AbortSignal.timeout(
          env.GEOCODING_TIMEOUT_MS
        )
      });
    } catch {
      throw new RoutingProviderError(
        "Routing provider is unavailable",
        "PROVIDER_UNAVAILABLE"
      );
    }

    if (!response.ok) {
      throw new RoutingProviderError(
        `Routing provider returned HTTP ${response.status}`,
        "PROVIDER_UNAVAILABLE"
      );
    }

    let rawData: unknown;

    try {
      rawData = await response.json();
    } catch {
      throw new RoutingProviderError(
        "Routing provider returned invalid JSON",
        "INVALID_PROVIDER_RESPONSE"
      );
    }

    const parsed =
      geoapifyRoutingResponseSchema.safeParse(rawData);

    if (!parsed.success) {
      throw new RoutingProviderError(
        "Routing provider returned an invalid response",
        "INVALID_PROVIDER_RESPONSE"
      );
    }

    const route = parsed.data.results[0];

    if (!route) {
      return null;
    }

    return {
      distanceMeters: route.distance,
      durationSeconds: route.time,
      geometry: {
        type: "LineString",
        coordinates: route.geometry.flatMap(
          (leg) =>
            leg.map(
              (point) => [point.lon, point.lat] as [number, number]
            )
        )
      },
      provider: this.name
    };
  }
}
