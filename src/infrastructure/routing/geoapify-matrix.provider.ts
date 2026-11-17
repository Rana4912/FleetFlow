
import { z } from "zod";

import { env } from "../../config/env.js";

import {
  RoutingProviderError
} from "./routing.errors.js";

import type {
  RouteMatrixRequest,
  RouteMatrixResult,
  RouteMatrixProvider
} from "./routing.types.js";

const matrixResponseSchema = z.object({
  sources_to_targets: z.array(
    z.array(
      z.object({
        distance: z.number().finite().nonnegative().nullable(),
        time: z.number().finite().nonnegative().nullable(),
        source_index: z.number().int().nonnegative(),
        target_index: z.number().int().nonnegative()
      })
    )
  )
});

export class GeoapifyMatrixProvider implements RouteMatrixProvider {
  readonly name = "GEOAPIFY";

  async getRouteMatrix(
    request: RouteMatrixRequest
  ): Promise<RouteMatrixResult> {
    const { sources, targets } = request;

    if (
      sources.length === 0 ||
      targets.length === 0 ||
      sources.length * targets.length > 1000
    ) {
      throw new RoutingProviderError(
        "Route matrix must contain between 1 and 1000 source-target pairs",
        "INVALID_PROVIDER_RESPONSE"
      );
    }

    const apiUrl = new URL(
      "https://api.geoapify.com/v1/routematrix"
    );

    apiUrl.searchParams.set(
      "apiKey",
      env.GEOCODING_API_KEY
    );

    let response: Response;

    try {
      response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode: "drive",
          units: "metric",
          sources: sources.map((coordinate) => ({
            location: [
              coordinate.longitude,
              coordinate.latitude
            ]
          })),
          targets: targets.map((coordinate) => ({
            location: [
              coordinate.longitude,
              coordinate.latitude
            ]
          }))
        }),
        signal: AbortSignal.timeout(
          env.GEOCODING_TIMEOUT_MS
        )
      });
    } catch {
      throw new RoutingProviderError(
        "Geoapify matrix service is unavailable",
        "PROVIDER_UNAVAILABLE"
      );
    }

    if (!response.ok) {
      throw new RoutingProviderError(
        `Geoapify matrix request failed with status ${response.status}`,
        "PROVIDER_UNAVAILABLE"
      );
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      throw new RoutingProviderError(
        "Geoapify returned invalid JSON",
        "INVALID_PROVIDER_RESPONSE"
      );
    }

    const parsed = matrixResponseSchema.safeParse(payload);

    if (!parsed.success) {
      throw new RoutingProviderError(
        "Geoapify returned an invalid matrix response",
        "INVALID_PROVIDER_RESPONSE"
      );
    }

    const matrix = parsed.data.sources_to_targets;

    if (
      matrix.length !== sources.length ||
      matrix.some((row) => row.length !== targets.length)
    ) {
      throw new RoutingProviderError(
        "Geoapify returned an incomplete route matrix",
        "INVALID_PROVIDER_RESPONSE"
      );
    }


    for (const [i, row] of matrix.entries()) {
      for (const [j, cell] of row.entries()) {
        if (
          cell.source_index !== i ||
          cell.target_index !== j
        ) {
          throw new RoutingProviderError(
            "Geoapify returned inconsistent matrix indexes",
            "INVALID_PROVIDER_RESPONSE"
          );
        }
      }
    }


    return {
      sources,
      targets,
      provider: this.name,
      matrix: matrix.map((row) =>
        row.map((cell) => ({
          distanceMeters: cell.distance,
          durationSeconds: cell.time
        }))
      )
    };
  }
}
