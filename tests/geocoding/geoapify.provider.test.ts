
import {
  describe,
  it,
  expect,
  vi,
  afterEach
} from "vitest";

import { GeoapifyProvider } from "../../src/infrastructure/geocoding/geoapify.provider.js";

describe("GeoapifyProvider", () => {
  const provider = new GeoapifyProvider();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should geocode an address successfully", async () => {
    const mockResponse = {
      results: [
        {
          place_id: "geoapify-place-123",
          formatted: "Salt Lake, Kolkata, West Bengal, India",
          lat: 22.5726,
          lon: 88.3639
        }
      ]
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      })
    );

    const result = await provider.geocode("Salt Lake, Kolkata");

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result).toEqual({
      formattedAddress: "Salt Lake, Kolkata, West Bengal, India",
      latitude: 22.5726,
      longitude: 88.3639,
      provider: "GEOAPIFY",
      providerPlaceId: "geoapify-place-123"
    });
  });

  it("should return null when no matching address is found", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      })
    );

    const result = await provider.geocode("Unknown Place XYZ");

    expect(result).toBeNull();
  });

  it("should throw PROVIDER_UNAVAILABLE when provider returns HTTP error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Internal Server Error", {
        status: 500
      })
    );

    await expect(
      provider.geocode("Salt Lake, Kolkata")
    ).rejects.toMatchObject({
      name: "GeocodingProviderError",
      code: "PROVIDER_UNAVAILABLE"
    });
  });

  it("should throw PROVIDER_UNAVAILABLE when network request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("Network connection failed")
    );

    await expect(
      provider.geocode("Salt Lake, Kolkata")
    ).rejects.toMatchObject({
      name: "GeocodingProviderError",
      code: "PROVIDER_UNAVAILABLE"
    });
  });

  it("should throw INVALID_PROVIDER_RESPONSE when provider returns invalid JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("This is not JSON", {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      })
    );

    await expect(
      provider.geocode("Salt Lake, Kolkata")
    ).rejects.toMatchObject({
      name: "GeocodingProviderError",
      code: "INVALID_PROVIDER_RESPONSE"
    });
  });

  it("should throw INVALID_PROVIDER_RESPONSE when response structure is invalid", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              place_id: 123,
              formatted: "Kolkata"
            }
          ]
        }),
        { status: 200 }
      )
    );

    await expect(
      provider.geocode("Kolkata")
    ).rejects.toMatchObject({
      name: "GeocodingProviderError",
      code: "INVALID_PROVIDER_RESPONSE"
    });
  });

  it("should throw INVALID_PROVIDER_RESPONSE when coordinates are invalid", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              place_id: "geoapify-place-123",
              formatted: "Kolkata",
              lat: 95,
              lon: 88.3639
            }
          ]
        }),
        { status: 200 }
      )
    );

    await expect(
      provider.geocode("Kolkata")
    ).rejects.toMatchObject({
      name: "GeocodingProviderError",
      code: "INVALID_PROVIDER_RESPONSE"
    });
  });
});
