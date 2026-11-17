
import { z } from "zod";

import { env } from "../../config/env.js";

import type {
  GeocodingProvider,
  GeocodingResult
} from "./geocoding.types.js";

import { GeocodingProviderError } from "./geocoding.errors.js";

const geoapifyResponseSchema = z.object({
  results: z.array(
    z.object({
      place_id: z.string().min(1),
      formatted: z.string().min(1),
      lat: z.number().finite(),
      lon: z.number().finite()
    })
  )
});

export class GeoapifyProvider implements GeocodingProvider {
  readonly name = "GEOAPIFY";

  async geocode(address: string): Promise<GeocodingResult | null> {
    const url = new URL(
      "https://api.geoapify.com/v1/geocode/search"
    );

    url.searchParams.set("text", address);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("apiKey", env.GEOCODING_API_KEY);

    // Restrict results to India.
    url.searchParams.set("filter", "countrycode:in");

    // Prefer results around Kolkata.
    url.searchParams.set(
      "bias",
      "proximity:88.3639,22.5726"
    );

    url.searchParams.set("lang", "en");

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
      throw new GeocodingProviderError(
        "Geocoding provider is unavailable",
        "PROVIDER_UNAVAILABLE"
      );
    }

    if (!response.ok) {
      throw new GeocodingProviderError(
        `Geocoding provider returned HTTP ${response.status}`,
        "PROVIDER_UNAVAILABLE"
      );
    }

    let rawData: unknown;

    try {
      rawData = await response.json();
    } catch {
      throw new GeocodingProviderError(
        "Geocoding provider returned invalid JSON",
        "INVALID_PROVIDER_RESPONSE"
      );
    }

    const parsed = geoapifyResponseSchema.safeParse(rawData);

    if (!parsed.success) {
      throw new GeocodingProviderError(
        "Geocoding provider returned an invalid response",
        "INVALID_PROVIDER_RESPONSE"
      );
    }

    const result = parsed.data.results[0];

    if (!result) {
      return null;
    }

    if (
      result.lat < -90 ||
      result.lat > 90 ||
      result.lon < -180 ||
      result.lon > 180
    ) {
      throw new GeocodingProviderError(
        "Geocoding provider returned invalid coordinates",
        "INVALID_PROVIDER_RESPONSE"
      );
    }

    return {
      formattedAddress: result.formatted,
      latitude: result.lat,
      longitude: result.lon,
      provider: this.name,
      providerPlaceId: result.place_id
    };
  }
}
