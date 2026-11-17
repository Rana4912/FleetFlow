
import { env } from "../../config/env.js";
import { z } from "zod";

import type {
  GeocodingProvider,
  GeocodingResult
} from "./geocoding.types.js";

import { GeocodingProviderError } from "./geocoding.errors.js";

const nominatimResponseSchema = z.array(
  z.object({
    place_id: z.number(),
    display_name: z.string().min(1),
    lat: z.string(),
    lon: z.string()
  })
);

export class NominatimProvider implements GeocodingProvider {
  readonly name = "NOMINATIM";
  async geocode(address: string): Promise<GeocodingResult | null> {
    const url = new URL("/search", env.GEOCODING_BASE_URL);

    url.searchParams.set("q", address);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("addressdetails", "1");

    let response: Response;

    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": env.GEOCODING_USER_AGENT,
          "Accept": "application/json"
        },
        signal: AbortSignal.timeout(env.GEOCODING_TIMEOUT_MS)
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

    const parsed = nominatimResponseSchema.safeParse(rawData);

    if (!parsed.success) {
      throw new GeocodingProviderError(
        "Geocoding provider returned an invalid response",
        "INVALID_PROVIDER_RESPONSE"
      );
    }

    const results = parsed.data;
    const result = results[0];

    if (!result) {
      return null;
    }

    const latitude = Number(result.lat);
    const longitude = Number(result.lon);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new GeocodingProviderError(
        "Geocoding provider returned invalid coordinates",
        "INVALID_PROVIDER_RESPONSE"
      );
    }

    return {
      formattedAddress: result.display_name,
      latitude,
      longitude,
      provider: "NOMINATIM",
      providerPlaceId: String(result.place_id)
    };
  }
}
