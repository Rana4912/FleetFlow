
import {
  describe,
  it,
  expect,
  vi
} from "vitest";

import { RoutingService } from "../../src/modules/routing/routing.service.js";
import { AppError } from "../../src/shared/errors/app-error.js";
import type {
  RoutingProvider,
  RouteRequest,
  RouteResult
} from "../../src/infrastructure/routing/routing.types.js";

describe("RoutingService", () => {
  const routeResult: RouteResult = {
    distanceMeters: 12000,
    durationSeconds: 1800,
    geometry: {
      type: "LineString",
      coordinates: [
        [88.3639, 22.5726],
        [88.4000, 22.6000]
      ]
    },
    provider: "GEOAPIFY"
  };

  const createProvider = () => {
    const provider: RoutingProvider = {
      name: "MOCK",
      getRoute: vi.fn().mockResolvedValue(routeResult)
    };

    return provider;
  };

  const origin = {
    latitude: 22.5726,
    longitude: 88.3639
  };

  const destination = {
    latitude: 22.6000,
    longitude: 88.4000
  };

  it("should return a route for valid coordinates", async () => {
    const provider = createProvider();
    const service = new RoutingService(provider);

    const result = await service.getRoute(origin, destination);

    expect(result).toEqual(routeResult);
    expect(provider.getRoute).toHaveBeenCalledWith({
      origin,
      destination
    });
  });

  it("should reject invalid origin latitude", async () => {
    const provider = createProvider();
    const service = new RoutingService(provider);

    await expect(
      service.getRoute(
        { ...origin, latitude: 91 },
        destination
      )
    ).rejects.toThrow(AppError);

    expect(provider.getRoute).not.toHaveBeenCalled();
  });

  it("should reject invalid destination longitude", async () => {
    const provider = createProvider();
    const service = new RoutingService(provider);

    await expect(
      service.getRoute(
        origin,
        { ...destination, longitude: 181 }
      )
    ).rejects.toThrow(AppError);

    expect(provider.getRoute).not.toHaveBeenCalled();
  });

  it("should reject NaN coordinates", async () => {
    const provider = createProvider();
    const service = new RoutingService(provider);

    await expect(
      service.getRoute(
        { ...origin, latitude: Number.NaN },
        destination
      )
    ).rejects.toThrow(AppError);

    expect(provider.getRoute).not.toHaveBeenCalled();
  });

  it("should reject identical origin and destination", async () => {
    const provider = createProvider();
    const service = new RoutingService(provider);

    await expect(
      service.getRoute(origin, origin)
    ).rejects.toThrow(
      "Origin and destination cannot be the same"
    );

    expect(provider.getRoute).not.toHaveBeenCalled();
  });

  it("should return null when no route is found", async () => {
    const provider = createProvider();

    vi.mocked(provider.getRoute).mockResolvedValue(null);

    const service = new RoutingService(provider);

    const result = await service.getRoute(origin, destination);

    expect(result).toBeNull();
  });

  it("should propagate routing provider errors", async () => {
    const provider = createProvider();

    vi.mocked(provider.getRoute).mockRejectedValue(
      new Error("Provider unavailable")
    );

    const service = new RoutingService(provider);

    await expect(
      service.getRoute(origin, destination)
    ).rejects.toThrow("Provider unavailable");
  });
});
