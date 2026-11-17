import {
  describe,
  it,
  expect,
  vi,
  afterEach
} from "vitest";

import { NominatimProvider } from "../../src/infrastructure/geocoding/nominatim.provider.js";

describe("NominatimProvider", () => {
  const provider = new NominatimProvider();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should geocode an address successfully", async () => {
    const mockResponse = [
      {
        place_id: 12345,
        display_name: "Salt Lake, Kolkata, West Bengal, India",
        lat: "22.5726",
        lon: "88.3639"
      }
    ];

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
      provider: "NOMINATIM",
      providerPlaceId: "12345"
    });
  });

  it("should return null when no matching address is found", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([]), {
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
        JSON.stringify([
          {
            place_id: "invalid",
            display_name: "Kolkata"
          }
        ]),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        }
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
        JSON.stringify([
          {
            place_id: 12345,
            display_name: "Kolkata",
            lat: "95",
            lon: "88.3639"
          }
        ]),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        }
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