
import {
  describe,
  it,
  expect,
  vi,
  afterEach
} from "vitest";

import { GeoapifyRoutingProvider } from "../../src/infrastructure/routing/geoapify-routing.provider.js";
import { RoutingProviderError } from "../../src/infrastructure/routing/routing.errors.js";

describe("GeoapifyRoutingProvider", () => {
  const provider = new GeoapifyRoutingProvider();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const routeResponse = {
    results: [
      {
        distance: 12500,
        time: 1800,
        geometry: [
          [
            { lon: 88.3639, lat: 22.5726 },
            { lon: 88.4000, lat: 22.6000 },
            { lon: 88.4500, lat: 22.6200 }
          ]
        ]
      }
    ]
  };

  it("should calculate a route successfully", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify(routeResponse), {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        })
      );

    const result = await provider.getRoute({
      origin: {
        latitude: 22.5726,
        longitude: 88.3639
      },
      destination: {
        latitude: 22.6200,
        longitude: 88.4500
      }
    });

    expect(result).not.toBeNull();

    expect(result?.distanceMeters).toBe(12500);
    expect(result?.durationSeconds).toBe(1800);
    expect(result?.provider).toBe("GEOAPIFY");

    expect(result?.geometry).toEqual({
      type: "LineString",
      coordinates: [
        [88.3639, 22.5726],
        [88.4000, 22.6000],
        [88.4500, 22.6200]
      ]
    });

    expect(fetchMock).toHaveBeenCalledOnce();

    const calledUrl = new URL(
      fetchMock.mock.calls[0]![0] as string
    );

    expect(calledUrl.searchParams.get("mode")).toBe("drive");
    expect(calledUrl.searchParams.get("format")).toBe("json");
    expect(calledUrl.searchParams.get("units")).toBe("metric");

    expect(calledUrl.searchParams.get("waypoints")).toBe(
      "22.5726,88.3639|22.62,88.45"
    );
  });

  it("should return null when no route is found", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ results: [] }),
        { status: 200 }
      )
    );

    const result = await provider.getRoute({
      origin: {
        latitude: 22.5726,
        longitude: 88.3639
      },
      destination: {
        latitude: 22.6200,
        longitude: 88.4500
      }
    });

    expect(result).toBeNull();
  });

  it("should throw when the provider is unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("Network failure")
    );

    await expect(
      provider.getRoute({
        origin: {
          latitude: 22.5726,
          longitude: 88.3639
        },
        destination: {
          latitude: 22.6200,
          longitude: 88.4500
        }
      })
    ).rejects.toMatchObject({
      name: "RoutingProviderError",
      code: "PROVIDER_UNAVAILABLE"
    });
  });

  it("should throw when the provider returns HTTP error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Unavailable", { status: 503 })
    );

    await expect(
      provider.getRoute({
        origin: {
          latitude: 22.5726,
          longitude: 88.3639
        },
        destination: {
          latitude: 22.6200,
          longitude: 88.4500
        }
      })
    ).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE"
    });
  });

  it("should throw when the provider returns invalid JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("not-json", { status: 200 })
    );

    await expect(
      provider.getRoute({
        origin: {
          latitude: 22.5726,
          longitude: 88.3639
        },
        destination: {
          latitude: 22.6200,
          longitude: 88.4500
        }
      })
    ).rejects.toMatchObject({
      code: "INVALID_PROVIDER_RESPONSE"
    });
  });

  it("should throw when the provider returns invalid route data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              distance: -100,
              time: 1800,
              geometry: []
            }
          ]
        }),
        { status: 200 }
      )
    );

    await expect(
      provider.getRoute({
        origin: {
          latitude: 22.5726,
          longitude: 88.3639
        },
        destination: {
          latitude: 22.6200,
          longitude: 88.4500
        }
      })
    ).rejects.toMatchObject({
      code: "INVALID_PROVIDER_RESPONSE"
    });
  });
});
